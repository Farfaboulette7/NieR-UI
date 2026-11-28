// Ce qui touche aux autres joueurs et au support, comme dans le launcher :
// - « Signaler un problème » (formulaire et envoi de InstallPanel.tsx : moteur `signaler`, avec ses
//   journaux nettoyés), proposé aussi à la fermeture d'un jeu qui a planté (« Ne plus demander ») ;
// - Avis (notes RomM) et Signalements d'un jeu (CommunityTab.tsx), à côté du Classement ;
// - « Mes signalements » et « Mes demandes » (ReportsInbox.tsx), dans l'onglet Farfa project.
// La saisie passe par la fenêtre de texte de NieRDeck (clavier de Steam), le texte par l'entrée
// standard du moteur.
import { callable, toaster } from "@decky/api";
import { ConfirmModal, showModal } from "@decky/ui";
import type { ReactNode } from "react";
import { NierAchievementList, NierGameDetail, NierOptionList, type NierMenuItem, type NierOption } from "../nier-ui";
import { playSfx } from "../launcher/audio";
import type { PanelDef, TabView } from "../launcher/tabView";
import { ct, type CatKey } from "./i18n";
import { promptText } from "./prompt";
import { notifyCatalogue, setOpenList, type CliResult } from "./store";
import { activateRequestRow, adjustRequest, requestAdjustable, requestDetail, requestRows } from "./extras";

const call = callable<[args: (string | number)[]], CliResult<any>>("catalogue_call");
const callText = callable<[args: (string | number)[], text: string], CliResult<any>>("catalogue_call_text");

const errorText = (r: CliResult<unknown>) => r.message || r.error || "?";
const Text = ({ children }: { children: ReactNode }) => (
  <p className="nier-game-description" style={{ margin: "6px 0 12px", whiteSpace: "pre-line" }}>
    {children}
  </p>
);
const dateOf = (secs: number | null | undefined) =>
  secs ? new Date(secs * 1000).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : "";
const isoDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
};

// ───────────── Statuts (ReportsInbox.tsx, GameRequests.tsx) ─────────────

const REPORT_STATUS: Record<string, CatKey> = {
  nouveau: "stReceived",
  "en cours": "stAnalysing",
  analysé: "stAnalysed",
  "à tester": "stFixing",
  "à décider": "stWaiting",
  réponse: "stMessage",
  corrigé: "stFixed",
  clos: "stClosed",
};
const reportStatus = (s: string) => (REPORT_STATUS[s] ? ct(REPORT_STATUS[s]) : s);
/** Statuts où le support doit encore répondre. */
const PENDING = ["nouveau", "en cours", "réponse"];

const REQUEST_STATUS: Record<string, CatKey> = { nouveau: "rqReceived", accepté: "rqAccepted", refusé: "rqRefused", ajouté: "rqAdded" };
const requestStatus = (s: string) => (REQUEST_STATUS[s] ? ct(REQUEST_STATUS[s]) : s);

// ───────────── Signaler un problème ─────────────

interface Crash {
  seconds: number;
  error: string | null;
}

const reportFiles: Record<number, string[] | "loading"> = {};
const reportState: Record<number, "busy" | "sent" | { error: string }> = {};

async function loadReportFiles(romId: number) {
  if (reportFiles[romId]) return;
  reportFiles[romId] = "loading";
  notifyCatalogue();
  const r = await call(["rapport-fichiers", romId]);
  reportFiles[romId] = r.data?.files ?? [];
  notifyCatalogue();
}

function crashDescription(c: Crash): string {
  const after = c.seconds < 60 ? `${c.seconds} s` : `${Math.round(c.seconds / 60)} min`;
  return ct("crashPrefill", { after, error: c.error ? ` (${ct("crashError")} : ${c.error})` : "" });
}

/** Saisie puis envoi du rapport ; `prefill` : texte de départ (après un plantage). */
async function writeAndSend(romId: number, name: string, afterCrash: boolean, prefill = "") {
  const text = await promptText(ct("reportTitle", { name }), ct("reportLabel"), prefill);
  if (!text || text.trim().length < 5) return;
  reportState[romId] = "busy";
  notifyCatalogue();
  const r = await callText(["signaler", romId, ...(afterCrash ? ["--apres-plantage"] : [])], text);
  if (r.data) {
    reportState[romId] = "sent";
    toaster.toast({ title: name, body: ct("reportSent") });
    myReports = undefined; // la liste « Mes signalements » sera relue
  } else {
    reportState[romId] = { error: errorText(r) };
    toaster.toast({ title: name, body: ct("error", { error: errorText(r) }) });
  }
  notifyCatalogue();
}

/** Lignes de « Signaler un problème » sur la page d'un jeu installé. */
export function reportRows(romId: number): NierOption[] {
  const st = reportState[romId];
  return [{ id: "report:write", label: st === "busy" ? ct("sending") : st === "sent" ? ct("reportSentShort") : ct("reportWrite") }];
}

export function reportDetail(romId: number, row?: string): ReactNode {
  if (!reportFiles[romId]) setTimeout(() => void loadReportFiles(romId), 0);
  const files = reportFiles[romId];
  const st = reportState[romId];
  return (
    <div>
      <NierGameDetail art={false} actions={<NierOptionList options={reportRows(romId)} selectedId={row} />} />
      <Text>{ct("reportDesc")}</Text>
      {st && typeof st === "object" && <Text>{ct("error", { error: st.error })}</Text>}
      <div className="nier-ach-progress-label">{ct("reportFiles")}</div>
      <Text>{files === undefined || files === "loading" ? ct("loading") : files.map((f) => `• ${f}`).join("\n")}</Text>
    </div>
  );
}

export function activateReportRow(romId: number, name: string, row: string) {
  if (row !== "report:write" || reportState[romId] === "busy") return playSfx("unfocus");
  playSfx("confirm");
  void writeAndSend(romId, name, false);
}

/**
 * Le jeu vient de planter (résultat de fin de partie du moteur, `askReport`) : propose le rapport,
 * prérempli, avec « Ne plus demander pour ce jeu », comme le launcher.
 */
export function proposeCrashReport(romId: number, name: string, crash: Crash) {
  showModal(
    <ConfirmModal
      strTitle={ct("crashTitle")}
      strOKButtonText={ct("crashSend")}
      strMiddleButtonText={ct("crashMute")}
      strCancelButtonText={ct("crashNo")}
      onOK={() => void writeAndSend(romId, name, true, crashDescription(crash))}
      onMiddleButton={() => {
        void call(["plantage", romId, "non"]).then((r) => toaster.toast({ title: name, body: r.error ? ct("error", { error: errorText(r) }) : ct("crashMuted") }));
      }}
    >
      {ct("crashBody", { name })}
    </ConfirmModal>,
  );
}

// ───────────── Avis (notes RomM) ─────────────

interface RommNote {
  id: number;
  user_id: number;
  username: string;
  title: string;
  content: string;
  is_public: boolean;
  tags?: string[];
  updated_at: string;
}

interface Scores {
  rating: number;
  difficulty: number;
  completion: number;
}

/** Titre des avis écrits par le launcher. */
const REVIEW_TITLE = "Avis";
const COMPLETION = [0, 25, 50, 75, 100];

/** Notes d'un avis, rangées dans ses étiquettes (`note:8`, `difficulte:4`, `completion:100`) ; 0 : pas de note. */
function scoresOf(note: RommNote): Scores {
  const tag = (key: string) => {
    const t = note.tags?.find((x) => x.startsWith(`${key}:`));
    const v = t ? Number(t.slice(key.length + 1)) : NaN;
    return Number.isFinite(v) && v > 0 ? v : 0;
  };
  return { rating: tag("note"), difficulty: tag("difficulte"), completion: tag("completion") };
}

function scoreLine(s: Scores): string {
  return [
    s.rating && ct("revRating", { n: s.rating }),
    s.difficulty && ct("revDifficulty", { n: s.difficulty }),
    s.completion && ct("revCompletion", { n: s.completion }),
  ]
    .filter(Boolean)
    .join(" · ");
}

const reviews: Record<number, { me: number; notes: RommNote[] } | "loading" | { error: string }> = {};
/** Avis en cours d'écriture : notes, texte, et ce qui vient d'être fait. */
const drafts: Record<number, Scores & { text: string; state: "idle" | "busy" | "saved" | "deleted"; error?: string }> = {};

async function loadReviews(romId: number, force = false) {
  if (reviews[romId] && !force) return;
  if (!reviews[romId]) {
    reviews[romId] = "loading";
    notifyCatalogue();
  }
  const r = await call(["avis", romId]);
  reviews[romId] = r.data ? r.data : { error: errorText(r) };
  notifyCatalogue();
}

const reviewData = (romId: number) => {
  const d = reviews[romId];
  return d && typeof d === "object" && "notes" in d ? d : null;
};
const myReview = (romId: number) => {
  const d = reviewData(romId);
  return d ? (d.notes.find((n) => n.user_id === d.me && n.title === REVIEW_TITLE) ?? null) : null;
};

function draftOf(romId: number) {
  if (!drafts[romId]) {
    const mine = myReview(romId);
    drafts[romId] = { ...(mine ? scoresOf(mine) : { rating: 0, difficulty: 0, completion: 0 }), text: mine?.content ?? "", state: "idle" };
  }
  return drafts[romId];
}

export function reviewRows(romId: number): NierOption[] {
  if (!reviewData(romId)) return [];
  const d = draftOf(romId);
  const mine = myReview(romId);
  const none = ct("revNone");
  const rows: NierOption[] = [
    { id: "rev:rating", label: ct("revRatingRow"), badge: d.rating ? `${d.rating}/10` : none },
    { id: "rev:difficulty", label: ct("revDifficultyRow"), badge: d.difficulty ? `${d.difficulty}/10` : none },
    { id: "rev:completion", label: ct("revCompletionRow"), badge: d.completion ? `${d.completion} %` : none },
    { id: "rev:text", label: ct("revTextRow"), badge: d.text.trim() ? `${d.text.trim().slice(0, 24)}${d.text.trim().length > 24 ? "…" : ""}` : none },
    {
      id: "rev:publish",
      label: d.state === "busy" ? ct("sending") : d.state === "saved" ? ct("revPublished") : mine ? ct("revUpdate") : ct("revPublish"),
    },
  ];
  if (mine) rows.push({ id: "rev:delete", label: d.state === "deleted" ? ct("revDeleted") : ct("revDelete") });
  return rows;
}

/** ← → sur une note : la change (0 : pas de note). */
export function adjustReview(romId: number, row: string, delta: number): boolean {
  const d = draftOf(romId);
  if (row === "rev:rating" || row === "rev:difficulty") {
    const key = row === "rev:rating" ? "rating" : "difficulty";
    d[key] = Math.max(0, Math.min(10, d[key] + delta));
  } else if (row === "rev:completion") {
    const i = Math.max(0, COMPLETION.indexOf(d.completion));
    d.completion = COMPLETION[Math.max(0, Math.min(COMPLETION.length - 1, i + delta))];
  } else return false;
  d.state = "idle";
  playSfx(delta > 0 ? "volumeUp" : "volumeDown");
  notifyCatalogue();
  return true;
}

export const reviewAdjustable = (row: string) => row === "rev:rating" || row === "rev:difficulty" || row === "rev:completion";

export function activateReviewRow(romId: number, row: string) {
  const d = draftOf(romId);
  if (d.state === "busy") return;
  if (row === "rev:text") {
    playSfx("confirm");
    void promptText(ct("revTextTitle"), ct("revTextLabel"), d.text).then((text) => {
      if (text === null) return;
      d.text = text;
      d.state = "idle";
      notifyCatalogue();
    });
    return;
  }
  if (row === "rev:publish") {
    if (!d.text.trim() && !d.rating && !d.difficulty && !d.completion) return playSfx("unfocus");
    playSfx("confirm");
    void publishReview(romId);
    return;
  }
  if (row === "rev:delete") {
    playSfx("confirm");
    void deleteReview(romId);
    return;
  }
  playSfx("unfocus");
}

async function publishReview(romId: number) {
  const d = draftOf(romId);
  const mine = myReview(romId);
  d.state = "busy";
  notifyCatalogue();
  const n = (v: number) => (v ? v : "-");
  const r = await callText(["avis-publier", romId, mine ? mine.id : "-", n(d.rating), n(d.difficulty), n(d.completion)], d.text);
  if (r.error) {
    d.state = "idle";
    d.error = errorText(r);
  } else {
    await loadReviews(romId, true);
    d.state = "saved";
    d.error = undefined;
  }
  notifyCatalogue();
}

async function deleteReview(romId: number) {
  const d = draftOf(romId);
  const mine = myReview(romId);
  if (!mine) return;
  d.state = "busy";
  notifyCatalogue();
  const r = await call(["avis-supprimer", romId, mine.id]);
  if (r.error) {
    d.state = "idle";
    d.error = errorText(r);
  } else {
    await loadReviews(romId, true);
    Object.assign(d, { rating: 0, difficulty: 0, completion: 0, text: "", state: "deleted", error: undefined });
  }
  notifyCatalogue();
}

export function reviewsDetail(romId: number, row?: string): ReactNode {
  if (reviews[romId] === undefined) setTimeout(() => void loadReviews(romId), 0);
  const data = reviews[romId];
  if (!data || data === "loading") return <NierGameDetail art={false} description={ct("loading")} />;
  if ("error" in data) return <NierGameDetail art={false} description={ct("reviewsError", { error: data.error })} />;
  const list = [...data.notes].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const ratings = list.filter((n) => n.title === REVIEW_TITLE).map((n) => scoresOf(n).rating).filter((r) => r > 0);
  const average = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  const d = draftOf(romId);
  return (
    <div>
      {average !== null && <Text>{ct("revAverage", { avg: average.toLocaleString(undefined, { maximumFractionDigits: 1 }), n: ratings.length })}</Text>}
      <div className="nier-ach-progress-label">{ct("revMine")}</div>
      <NierOptionList options={reviewRows(romId)} selectedId={row} />
      <Text>{d.error ? ct("error", { error: d.error }) : ct("revHelp")}</Text>
      <NierAchievementList
        unlocked={0}
        total={0}
        emptyText={ct("revEmpty")}
        items={list.map((n) => ({
          id: String(n.id),
          name: `${n.username}${n.user_id === data.me ? ` ${ct("you")}` : ""}${n.title !== REVIEW_TITLE ? ` · ${n.title}` : ""}`,
          description: [scoreLine(scoresOf(n)), n.content].filter(Boolean).join("\n"),
          achieved: true,
          note: `${isoDate(n.updated_at)}${n.is_public ? "" : ` · ${ct("private")}`}`,
        }))}
      />
    </div>
  );
}

// ───────────── Signalements d'un jeu ─────────────

interface GameReport {
  id: string;
  at: number | null;
  status: string;
  description: string | null;
  reponse: string | null;
  modifications: string[];
  corrigeDans: string | null;
  username: string | null;
  mine: boolean;
}

const gameReports: Record<number, GameReport[] | null | "loading"> = {};

async function loadGameReports(romId: number) {
  gameReports[romId] = "loading";
  notifyCatalogue();
  const r = await call(["signalements", romId]);
  gameReports[romId] = Array.isArray(r.data) ? r.data : null;
  notifyCatalogue();
}

export function gameReportsDetail(romId: number): ReactNode {
  if (gameReports[romId] === undefined) setTimeout(() => void loadGameReports(romId), 0);
  const list = gameReports[romId];
  if (list === undefined || list === "loading") return <NierGameDetail art={false} description={ct("loading")} />;
  if (list === null) return <NierGameDetail art={false} description={ct("gameReportsNone")} />;
  if (!list.length) return <NierGameDetail art={false} description={ct("gameReportsEmpty")} />;
  const fixed = list.filter((r) => r.corrigeDans || r.status === "corrigé").length;
  return (
    <div>
      <Text>{`${ct("gameReportsCount", { n: list.length })}${fixed ? ` · ${ct("gameReportsFixed", { n: fixed })}` : ""}`}</Text>
      <NierAchievementList
        unlocked={0}
        total={0}
        items={list.map((r) => ({
          id: r.id,
          name: `${r.username ?? ct("aPlayer")}${r.mine ? ` ${ct("you")}` : ""}`,
          description: [
            r.description ? `« ${r.description} »` : "",
            r.corrigeDans ? ct("fixedIn", { v: r.corrigeDans }) : "",
            r.modifications.length ? r.modifications.map((m) => `• ${m}`).join("\n") : r.reponse ?? "",
          ]
            .filter(Boolean)
            .join("\n"),
          achieved: true,
          note: `${dateOf(r.at)} · ${reportStatus(r.status)}`,
        }))}
      />
    </div>
  );
}

// ───────────── Mes signalements (ReportsInbox.tsx) ─────────────

interface ReportMessage {
  de: "joueur" | "claude";
  texte: string;
  at: number | null;
}

interface MyReport {
  id: string;
  rom: number | null;
  game: string | null;
  at: number | null;
  status: string;
  description: string | null;
  reponse: string | null;
  modifications: string[];
  corrigeDans: string | null;
  messages?: ReportMessage[];
  versionTest?: { tag: string; prete: boolean } | null;
  updatedAt: number;
}

let myReports: { reports: MyReport[]; seen: Record<string, number> } | "loading" | { error: string } | undefined;
let support: { enLigne: boolean } | null = null;
const replying: Record<string, boolean> = {};

async function loadMyReports() {
  if (myReports === undefined) {
    myReports = "loading";
    notifyCatalogue();
  }
  const [r, s] = await Promise.all([call(["mes-rapports"]), call(["support"])]);
  myReports = r.data ? { reports: r.data.reports ?? [], seen: r.data.seen ?? {} } : { error: errorText(r) };
  support = s.data ?? null;
  notifyCatalogue();
}

const reportsData = () => (myReports && typeof myReports === "object" && "reports" in myReports ? myReports : null);
const unreadReport = (r: MyReport, seen: Record<string, number>) => r.updatedAt > (seen[r.id] ?? 0);

/** Nombre de signalements avec une nouvelle pas encore lue (entrée de l'onglet). */
export function unreadReports(): number {
  if (myReports === undefined) setTimeout(() => void loadMyReports(), 0);
  const d = reportsData();
  return d ? d.reports.filter((r) => unreadReport(r, d.seen)).length : 0;
}

function markSeen(r: MyReport) {
  const d = reportsData();
  if (!d || !unreadReport(r, d.seen)) return;
  d.seen = { ...d.seen, [r.id]: r.updatedAt };
  void callText(["rapports-vus"], JSON.stringify({ [r.id]: r.updatedAt }));
  setTimeout(notifyCatalogue, 0);
}

function conversation(r: MyReport, row?: string): ReactNode {
  const pending = PENDING.includes(r.status);
  const canReply = r.messages !== undefined && !pending;
  const msgs: { id: string; who: string; text: string; at: number | null }[] = [];
  if (r.description) msgs.push({ id: "m:desc", who: ct("youName"), text: r.description, at: r.at });
  if (r.reponse) {
    const changes = r.modifications.length ? `\n${ct("changes")} :\n${r.modifications.map((m) => `• ${m}`).join("\n")}` : "";
    const fixed = r.corrigeDans ? `\n${ct("fixedIn", { v: r.corrigeDans })}` : "";
    msgs.push({ id: "m:rep", who: ct("support"), text: r.reponse + changes + fixed, at: null });
  } else if (!pending) msgs.push({ id: "m:rep", who: ct("support"), text: ct("analysed"), at: null });
  (r.messages ?? []).forEach((m, i) => msgs.push({ id: `m:${i}`, who: m.de === "joueur" ? ct("youName") : ct("support"), text: m.texte, at: m.at }));
  const notes: string[] = [];
  if (r.versionTest && !r.corrigeDans && r.status !== "corrigé" && r.status !== "clos") notes.push(r.versionTest.prete ? ct("testReady") : ct("testPreparing"));
  if (pending) notes.push(r.status === "en cours" || support?.enLigne ? ct("supportThinking") : ct("supportAway"));
  return (
    <div>
      <NierGameDetail art={false} fields={[{ label: ct("status"), value: reportStatus(r.status) }]} />
      <NierAchievementList
        unlocked={0}
        total={0}
        selectedId={row}
        items={msgs.map((m) => ({ id: m.id, name: m.who, description: m.text, achieved: true, note: dateOf(m.at) }))}
      />
      {notes.length > 0 && <Text>{notes.join("\n")}</Text>}
      {r.messages !== undefined && (
        <NierOptionList
          options={[{ id: "reply", label: replying[r.id] ? ct("sending") : canReply ? ct("replyRow") : ct("replyWait") }]}
          selectedId={row}
        />
      )}
    </div>
  );
}

async function reply(r: MyReport) {
  const text = await promptText(ct("replyTitle"), ct("replyLabel"));
  if (!text || text.trim().length < 2) return;
  replying[r.id] = true;
  notifyCatalogue();
  const res = await callText(["repondre-rapport", r.id], text);
  replying[r.id] = false;
  if (res.data) {
    toaster.toast({ title: r.game ?? "NieRDeck", body: ct("replySent") });
    await loadMyReports();
  } else toaster.toast({ title: r.game ?? "NieRDeck", body: ct("error", { error: errorText(res) }) });
  notifyCatalogue();
}

/** Liste « Mes signalements » (une discussion par signalement). */
export function myReportsView(): TabView {
  if (myReports === undefined) setTimeout(() => void loadMyReports(), 0);
  const d = reportsData();
  const reports = d ? [...d.reports].sort((a, b) => b.updatedAt - a.updatedAt) : [];
  const find = (id?: string) => reports.find((r) => `r:${r.id}` === id);
  return {
    menuTitle: `${ct("myReports")}${reports.length ? ` · ${reports.length}` : ""}`,
    items: reports.map(
      (r): NierMenuItem => ({ id: `r:${r.id}`, label: `${d && unreadReport(r, d.seen) ? "● " : ""}${r.game ?? `#${r.rom ?? "?"}`}`, badge: reportStatus(r.status) }),
    ),
    detail: (id, row) => {
      const r = find(id);
      if (!r) {
        const msg = myReports === undefined || myReports === "loading" ? ct("loading") : typeof myReports === "object" && "error" in myReports ? ct("error", { error: myReports.error }) : ct("myReportsEmpty");
        return { title: ct("myReports"), content: <NierGameDetail art={false} description={msg} /> };
      }
      markSeen(r);
      return { title: r.game ?? ct("myReports"), content: conversation(r, row) };
    },
    activate: () => undefined,
    panel: (id) => {
      const r = find(id);
      if (!r) return undefined;
      const rows = conversationRows(r);
      return {
        rows,
        initial: rows[rows.length - 1],
        activate: (row) => {
          if (row !== "reply") return;
          if (!(r.messages !== undefined && !PENDING.includes(r.status)) || replying[r.id]) return playSfx("unfocus");
          playSfx("confirm");
          void reply(r);
        },
      } satisfies PanelDef;
    },
    hint: (id) => (find(id) ? ct("readHint") : undefined),
    back: () => {
      playSfx("back");
      setOpenList(null);
      return true;
    },
  };
}

function conversationRows(r: MyReport): string[] {
  const rows: string[] = [];
  if (r.description) rows.push("m:desc");
  if (r.reponse || !PENDING.includes(r.status)) rows.push("m:rep");
  (r.messages ?? []).forEach((_, i) => rows.push(`m:${i}`));
  if (r.messages !== undefined) rows.push("reply");
  return rows;
}

// ───────────── Mes demandes ─────────────

interface GameRequest {
  id: string;
  name: string;
  console: string;
  link: string;
  message: string;
  status: string;
  response: string;
  createdAt: number;
  updatedAt: number;
}

let myRequests: GameRequest[] | "loading" | { error: string } | undefined;

async function loadMyRequests() {
  myRequests = "loading";
  notifyCatalogue();
  const r = await call(["mes-demandes"]);
  myRequests = Array.isArray(r.data) ? r.data : { error: errorText(r) };
  notifyCatalogue();
}

export function requestsCount(): number | undefined {
  return Array.isArray(myRequests) ? myRequests.length : undefined;
}

export function myRequestsView(): TabView {
  if (myRequests === undefined) setTimeout(() => void loadMyRequests(), 0);
  const list = Array.isArray(myRequests) ? [...myRequests].sort((a, b) => b.updatedAt - a.updatedAt) : [];
  const find = (id?: string) => list.find((q) => `q:${q.id}` === id);
  return {
    menuTitle: `${ct("myRequests")}${list.length ? ` · ${list.length}` : ""}`,
    items: [{ id: "new", label: ct("requestGame") }, ...list.map((q): NierMenuItem => ({ id: `q:${q.id}`, label: q.name, badge: requestStatus(q.status) }))],
    detail: (id, row) => {
      if (id === "new" || !id) return { title: ct("requestGame"), content: requestDetail(row) };
      const q = find(id);
      if (!q) {
        const msg = myRequests === undefined || myRequests === "loading" ? ct("loading") : !Array.isArray(myRequests) ? ct("error", { error: myRequests.error }) : ct("myRequestsEmpty");
        return { title: ct("myRequests"), content: <NierGameDetail art={false} description={msg} /> };
      }
      const fields = [
        { label: ct("console"), value: q.console || "—" },
        { label: ct("status"), value: requestStatus(q.status) },
        { label: ct("rqSent"), value: dateOf(q.createdAt) },
      ];
      if (q.link) fields.push({ label: ct("rqLink"), value: q.link });
      return {
        title: q.name,
        content: (
          <div>
            <NierGameDetail art={false} fields={fields} />
            {q.message && <Text>{`${ct("rqYourMessage")} : ${q.message}`}</Text>}
            {q.response && <Text>{`${ct("rqAnswer")} : ${q.response}`}</Text>}
          </div>
        ),
      };
    },
    activate: () => undefined,
    // « Demander un jeu » : A sur une ligne la remplit (clavier de Steam), ← → change la console.
    panel: (id) =>
      id === "new" || !id
        ? ({
            rows: requestRows().map((r) => r.id),
            activate: (row) => activateRequestRow(row, () => void loadMyRequests()),
            adjust: (row, delta) => adjustRequest(row, delta),
            adjustable: requestAdjustable,
          } satisfies PanelDef)
        : undefined,
    hint: (id) => (id === "new" || !id ? ct("choose") : undefined),
    back: () => {
      playSfx("back");
      setOpenList(null);
      return true;
    },
  };
}
