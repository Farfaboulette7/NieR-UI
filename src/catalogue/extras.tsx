// Lot E, comme dans le launcher :
// - « Téléchargements » (Downloads.tsx) : la file des installations, pause, reprise, en premier ;
// - « Demander un jeu » (GameRequests.tsx) : nom, console de la liste ou « Autre », lien et
//   message facultatifs, avec l'avertissement si le jeu semble déjà sur le serveur ;
// - « Soutenir le projet » (SupportSection.tsx) : soutien.json du gestionnaire, liens ouverts dans
//   le navigateur de Steam ;
// - la limite de débit des téléchargements (Système → FarfaLauncher).
import { callable, toaster } from "@decky/api";
import { Navigation } from "@decky/ui";
import type { ReactNode } from "react";
import { NierGameDetail, NierMeter, NierOptionList, type NierMenuItem, type NierOption } from "../nier-ui";
import { playSfx } from "../launcher/audio";
import type { PanelDef, TabView } from "../launcher/tabView";
import { ct, type CatKey } from "./i18n";
import { promptText } from "./prompt";
import {
  cancelInstall,
  catalogueState,
  downloadQueue,
  moveInstallFirst,
  notifyCatalogue,
  pauseInstall,
  resumeInstall,
  setDownloadLimit,
  setOpenList,
  type CliResult,
} from "./store";

const call = callable<[args: (string | number)[]], CliResult<any>>("catalogue_call");
const callText = callable<[args: (string | number)[], text: string], CliResult<any>>("catalogue_call_text");
const backendSoutien = callable<[], SupportInfo | null>("catalogue_soutien");

const errorText = (r: CliResult<unknown>) => r.message || r.error || "?";
const Text = ({ children }: { children: ReactNode }) => (
  <p className="nier-game-description" style={{ margin: "6px 0 12px", whiteSpace: "pre-line" }}>
    {children}
  </p>
);

/** Nom d'un jeu connu de l'onglet (listes ou fiches). */
function gameName(romId: number): string {
  const cat = catalogueState();
  const d = cat.details[romId];
  if (d && typeof d === "object" && "game" in d && d.game?.name) return d.game.name;
  for (const list of Object.values(cat.lists)) {
    const g = list.games.find((x) => x.id === romId);
    if (g) return g.name;
  }
  return `#${romId}`;
}

// ───────────── Téléchargements ─────────────

export function downloadsCount(): number {
  return downloadQueue().length;
}

function downloadRows(romId: number): NierOption[] {
  const q = downloadQueue();
  const e = q.find((x) => x.romId === romId);
  if (!e) return [];
  const rows: NierOption[] = [{ id: e.paused ? "resume" : "pause", label: e.paused ? ct("dlResume") : ct("dlPause") }];
  const waiting = q.filter((x) => !x.running);
  if (!e.running && waiting[0]?.romId !== romId) rows.push({ id: "first", label: ct("dlFirst") });
  rows.push({ id: "cancel", label: ct("dlCancel") });
  return rows;
}

export function downloadsView(): TabView {
  const q = downloadQueue();
  const cat = catalogueState();
  const find = (id?: string) => q.find((e) => `d:${e.romId}` === id);
  const phaseOf = (romId: number) => {
    const p = cat.progress[romId];
    if (!p) return "";
    const pct = p.total > 0 && !["queued", "paused"].includes(p.phase) ? ` ${Math.round((p.done / p.total) * 100)} %` : "";
    return `${ct(`phase_${p.phase}` as CatKey) ?? p.phase}${pct}`;
  };
  return {
    menuTitle: `${ct("downloads")}${q.length ? ` · ${q.length}` : ""}`,
    items: q.map((e): NierMenuItem => ({ id: `d:${e.romId}`, label: gameName(e.romId), badge: phaseOf(e.romId), muted: e.paused })),
    detail: (id, row) => {
      const e = find(id);
      if (!e) return { title: ct("downloads"), content: <NierGameDetail art={false} description={ct("dlEmpty")} /> };
      const p = cat.progress[e.romId];
      const waiting = q.filter((x) => !x.running);
      const fields = [{ label: ct("status"), value: e.running ? ct("dlRunning") : e.paused ? ct("phase_paused") : ct("phase_queued") }];
      if (!e.running) fields.push({ label: ct("dlPosition"), value: String(waiting.findIndex((x) => x.romId === e.romId) + 1) });
      return {
        title: gameName(e.romId),
        content: (
          <NierGameDetail
            art={false}
            fields={fields}
            actions={
              <>
                {p && <NierMeter label={phaseOf(e.romId)} value={p.total > 0 ? Math.round((p.done / p.total) * 100) : 0} mutedLabel="…" />}
                <NierOptionList options={downloadRows(e.romId)} selectedId={row} />
              </>
            }
          />
        ),
      };
    },
    activate: () => undefined,
    panel: (id) => {
      const e = find(id);
      if (!e) return undefined;
      return {
        rows: downloadRows(e.romId).map((r) => r.id),
        activate: (row) => {
          playSfx("confirm");
          if (row === "pause") void pauseInstall(e.romId);
          else if (row === "resume") void resumeInstall(e.romId);
          else if (row === "first") void moveInstallFirst(e.romId);
          else if (row === "cancel") void cancelInstall(e.romId);
        },
      } satisfies PanelDef;
    },
    hint: (id) => (find(id) ? ct("choose") : undefined),
    back: () => {
      playSfx("back");
      setOpenList(null);
      return true;
    },
  };
}

// ───────────── Limite de débit (Système → FarfaLauncher) ─────────────

const LIMITS = [0, 1, 2, 5, 10, 20, 50, 100];

export const limitLabel = (mb: number | undefined) => (mb ? `${mb} Mo/s` : ct("limitNone"));

export function adjustLimit(delta: number): boolean {
  const cur = catalogueState().status?.data?.downloadLimitMb ?? 0;
  const i = Math.max(0, LIMITS.findIndex((v) => v >= cur));
  const next = LIMITS[Math.max(0, Math.min(LIMITS.length - 1, i + delta))];
  if (next === cur) return true;
  playSfx(delta > 0 ? "volumeUp" : "volumeDown");
  void setDownloadLimit(next);
  return true;
}

// ───────────── Demander un jeu (GameRequests.tsx) ─────────────

interface RequestDraft {
  name: string;
  /** Index dans la liste des consoles ; -1 : « Autre », son nom dans `other`. */
  console: number;
  other: string;
  link: string;
  message: string;
  state: "idle" | "checking" | "sending" | "sent";
  /** Jeux du serveur qui ressemblent : envoyer devient « envoyer quand même ». */
  warning: { same: string[]; others: string[] } | null;
  error?: string;
}

const draft: RequestDraft = { name: "", console: 0, other: "", link: "", message: "", state: "idle", warning: null };

const consoleNames = () => (catalogueState().consoles ?? []).filter((c) => c.id !== -1).map((c) => c.name);
const chosenConsole = () => (draft.console < 0 ? draft.other.trim() : (consoleNames()[draft.console] ?? ""));

/** Nom comparable : minuscules, sans accents, ponctuation ni articles de tête (normalizeName). */
function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^(the|le|la|les) /, "")
    .trim();
}

/** Ressemblance de deux noms entre 0 et 1 (coefficient de Dice, comme le launcher). */
function similarity(a: string, b: string): number {
  const pairs = (s: string) => {
    const t = s.replace(/ /g, "");
    const out = new Map<string, number>();
    for (let i = 0; i < t.length - 1; i++) out.set(t.slice(i, i + 2), (out.get(t.slice(i, i + 2)) ?? 0) + 1);
    return out;
  };
  const pa = pairs(a);
  const pb = pairs(b);
  let common = 0;
  let total = 0;
  pa.forEach((n, k) => {
    common += Math.min(n, pb.get(k) ?? 0);
    total += n;
  });
  pb.forEach((n) => (total += n));
  return total === 0 ? 0 : (2 * common) / total;
}

function sameGame(wanted: string, existing: string): boolean {
  const a = normalizeName(wanted);
  const b = normalizeName(existing);
  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a))) return true;
  return similarity(a, b) >= 0.8;
}

export function requestRows(): NierOption[] {
  const none = "—";
  const names = consoleNames();
  const rows: NierOption[] = [
    { id: "rq:name", label: ct("rqName"), badge: draft.name || none },
    { id: "rq:console", label: ct("rqConsole"), badge: draft.console < 0 ? ct("rqOther") : (names[draft.console] ?? none) },
  ];
  if (draft.console < 0) rows.push({ id: "rq:other", label: ct("rqOtherName"), badge: draft.other || none });
  rows.push({ id: "rq:link", label: ct("rqLinkRow"), badge: draft.link ? draft.link.slice(0, 28) : none });
  rows.push({ id: "rq:message", label: ct("rqMessageRow"), badge: draft.message ? `${draft.message.slice(0, 24)}${draft.message.length > 24 ? "…" : ""}` : none });
  rows.push({
    id: "rq:send",
    label:
      draft.state === "checking"
        ? ct("rqChecking")
        : draft.state === "sending"
          ? ct("sending")
          : draft.state === "sent"
            ? ct("rqSentOk")
            : draft.warning
              ? ct("rqSendAnyway")
              : ct("rqSend"),
  });
  return rows;
}

export function requestDetail(row?: string): ReactNode {
  const w = draft.warning;
  return (
    <div>
      <NierOptionList options={requestRows()} selectedId={row} />
      {w && w.same.length > 0 && <Text>{ct("rqSame", { console: chosenConsole(), games: w.same.join(", ") })}</Text>}
      {w && w.same.length === 0 && w.others.length > 0 && <Text>{ct("rqOthers", { consoles: w.others.join(", "), console: chosenConsole() })}</Text>}
      {draft.error && <Text>{ct("error", { error: draft.error })}</Text>}
      <Text>{row === "rq:console" ? ct("rqConsoleHelp") : ct("rqHelp")}</Text>
    </div>
  );
}

/** ← → sur la console : la précédente / suivante, « Autre » à la fin. */
export function adjustRequest(row: string, delta: number): boolean {
  if (row !== "rq:console") return false;
  const n = consoleNames().length;
  // -1 (« Autre ») vient après la dernière console.
  const pos = draft.console < 0 ? n : draft.console;
  const next = Math.max(0, Math.min(n, pos + delta));
  draft.console = next === n ? -1 : next;
  draft.warning = null;
  if (draft.state === "sent") draft.state = "idle";
  playSfx("move");
  notifyCatalogue();
  return true;
}

async function ask(field: "name" | "other" | "link" | "message", title: CatKey, label: CatKey) {
  const v = await promptText(ct(title), ct(label), draft[field]);
  if (v === null) return;
  draft[field] = v;
  draft.warning = null;
  if (draft.state === "sent") draft.state = "idle";
  notifyCatalogue();
}

async function sendRequest(force: boolean) {
  const console = chosenConsole();
  if (draft.name.trim().length < 2 || !console) {
    draft.error = ct("rqMissing");
    notifyCatalogue();
    return;
  }
  if (draft.link.trim() && !/^https?:\/\//.test(draft.link.trim())) {
    draft.error = ct("rqBadLink");
    notifyCatalogue();
    return;
  }
  draft.error = undefined;
  // Garde-fou du launcher : le jeu est peut-être déjà sur le serveur.
  if (!force) {
    draft.state = "checking";
    notifyCatalogue();
    const r = await call(["recherche", draft.name.trim()]);
    const platforms = catalogueState().consoles ?? [];
    const games: { name: string; console: string }[] = ((r.data?.games ?? []) as { name: string; platformId: number; console?: string }[]).map((g) => ({
      name: g.name,
      console: platforms.find((c) => c.id === g.platformId)?.name ?? g.console ?? "?",
    }));
    const matches = games.filter((g) => sameGame(draft.name, g.name));
    const same = matches.filter((g) => draft.console >= 0 && g.console === console).map((g) => g.name);
    const others = Array.from(new Set(matches.filter((g) => !(draft.console >= 0 && g.console === console)).map((g) => g.console)));
    if (same.length || others.length) {
      draft.warning = { same, others };
      draft.state = "idle";
      notifyCatalogue();
      return;
    }
  }
  draft.state = "sending";
  notifyCatalogue();
  const r = await callText(["demander"], JSON.stringify({ name: draft.name, console, link: draft.link, message: draft.message }));
  if (r.data) {
    toaster.toast({ title: draft.name, body: ct("rqSentToast") });
    Object.assign(draft, { name: "", other: "", link: "", message: "", warning: null, state: "sent" });
  } else {
    draft.state = "idle";
    draft.error = errorText(r);
  }
  notifyCatalogue();
}

export function activateRequestRow(row: string, onSent: () => void) {
  if (draft.state === "checking" || draft.state === "sending") return;
  playSfx("confirm");
  if (row === "rq:name") void ask("name", "rqName", "rqNameLabel");
  else if (row === "rq:other") void ask("other", "rqOtherName", "rqOtherLabel");
  else if (row === "rq:link") void ask("link", "rqLinkRow", "rqLinkLabel");
  else if (row === "rq:message") void ask("message", "rqMessageRow", "rqMessageLabel");
  else if (row === "rq:send") void sendRequest(!!draft.warning).then(() => draft.state === "sent" && onSent());
}

export const requestAdjustable = (row: string) => row === "rq:console";

// ───────────── Soutenir le projet (SupportSection.tsx) ─────────────

type SupportLink = { type: "text"; label: string; value: string } | { type: "url"; label: string; value: string; showQr: boolean };
interface SupportInfo {
  message: string;
  links: SupportLink[];
}

let support: SupportInfo | null | "loading" | undefined;
const opened = new Set<string>();

/** null : section cachée (fichier absent, désactivé, gestionnaire injoignable), comme le launcher. */
export function supportInfo(): SupportInfo | null {
  if (support === undefined) {
    support = "loading";
    backendSoutien()
      .then((i) => (support = i ?? null))
      .catch(() => (support = null))
      .finally(notifyCatalogue);
  }
  return support && support !== "loading" ? support : null;
}

export function supportRows(): NierOption[] {
  const s = supportInfo();
  if (!s) return [];
  return s.links.map((l, i) =>
    l.type === "url"
      ? { id: `sp:${i}`, label: opened.has(l.value) ? ct("spOpened", { label: l.label }) : ct("spOpen", { label: l.label }) }
      : { id: `sp:${i}`, label: l.label, badge: l.value },
  );
}

export function supportDetail(row?: string): ReactNode {
  const s = supportInfo();
  if (!s) return <NierGameDetail art={false} description={ct("loading")} />;
  return (
    <div>
      {s.message && <Text>{s.message}</Text>}
      <NierOptionList options={supportRows()} selectedId={row} />
      <Text>{ct("spHelp")}</Text>
    </div>
  );
}

/** A sur un lien : ouvert dans le navigateur de Steam (seulement les liens https du fichier). */
export function activateSupportRow(row: string) {
  const s = supportInfo();
  const l = s?.links[Number(row.slice(3))];
  if (!l || l.type !== "url" || !/^https:\/\//.test(l.value)) return playSfx("unfocus");
  playSfx("confirm");
  Navigation.NavigateToExternalWeb(l.value);
  opened.add(l.value);
  notifyCatalogue();
}
