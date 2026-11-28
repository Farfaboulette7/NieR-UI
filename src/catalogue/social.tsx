// Amis, statistiques entre amis et nouvelles versions, comme dans le launcher :
// - « Amis » (FriendsMenu.tsx) : en jeu, en ligne, hors ligne, avec avatars, et « Apparaître hors
//   ligne ». NieRDeck ouvert compte comme le launcher ouvert : il signale la présence chaque minute
//   (en ligne, ou en jeu pendant une partie), et passe hors ligne à la mise en veille ;
// - « Statistiques » (StatsDialog.tsx) : son profil, ceux des amis et le classement général ;
// - « Nouvelles versions » : notes des versions du launcher (celles de docs/changelog, reprises par
//   les releases GitHub), avec « Nouveau » quand le moteur vient de changer de version.
import { callable, toaster } from "@decky/api";
import type { ReactNode } from "react";
import { NierAchievementList, NierGameDetail, NierOptionList, type NierMenuItem, type NierOption } from "../nier-ui";
import { playSfx } from "../launcher/audio";
import type { PanelDef, TabView } from "../launcher/tabView";
import { ct } from "./i18n";
import { catalogueState, notifyCatalogue, setOpenList, type CliResult } from "./store";

declare const SteamClient: any;

const call = callable<[args: (string | number)[]], CliResult<any>>("catalogue_call");
const backendAvatar = callable<[userId: number], string | null>("catalogue_avatar");
const backendNotes = callable<[current: string], CliResult<LauncherNote[]>>("catalogue_launcher_notes");

const errorText = (r: CliResult<unknown>) => r.message || r.error || "?";
const Text = ({ children }: { children: ReactNode }) => (
  <p className="nier-game-description" style={{ margin: "6px 0 12px", whiteSpace: "pre-line" }}>
    {children}
  </p>
);
const back = () => {
  playSfx("back");
  setOpenList(null);
  return true;
};

/** « 12 min », « 2 h », « 3 j ». */
function duration(fromUnix: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - fromUnix));
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86_400)} j`;
}

function playtime(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
}

// ───────────── Présence ─────────────

/** Le gestionnaire oublie un compte après 3 min sans signal : un signal par minute. */
const PRESENCE_MS = 60_000;

/** NieRDeck tourne (Deck allumé) : présence signalée chaque minute. Rend de quoi l'arrêter. */
export function bindPresence(): () => void {
  const signal = () => {
    if (catalogueState().status?.data?.serverUrl) void call(["presence"]);
  };
  const first = setTimeout(signal, 5000);
  const timer = setInterval(signal, PRESENCE_MS);
  const regs: any[] = [];
  try {
    // Mise en veille : hors ligne tout de suite ; au réveil, de nouveau là.
    regs.push(SteamClient.User.RegisterForPrepareForSystemSuspendProgress(() => void call(["presence-quitter"])));
    regs.push(SteamClient.User.RegisterForResumeSuspendedGamesProgress(() => setTimeout(signal, 3000)));
  } catch (e) {
    console.error("[NieRDeck] présence", e);
  }
  return () => {
    clearTimeout(first);
    clearInterval(timer);
    for (const r of regs) {
      try {
        r?.unregister?.();
      } catch {
        /* déjà libéré */
      }
    }
  };
}

/** Fin d'une partie : de nouveau « en ligne » sans attendre la minute suivante. */
export function presenceNow() {
  void call(["presence"]);
}

// ───────────── Avatars ─────────────

const avatars: Record<number, string | null | "loading"> = {};

function avatarOf(id: number, has: boolean): string | undefined {
  if (!has) return undefined;
  const cur = avatars[id];
  if (cur === undefined) {
    avatars[id] = "loading";
    backendAvatar(id)
      .then((url) => (avatars[id] = url ?? null))
      .catch(() => (avatars[id] = null))
      .finally(notifyCatalogue);
    return undefined;
  }
  return cur && cur !== "loading" ? cur : undefined;
}

// ───────────── Amis ─────────────

interface Friend {
  id: number;
  username: string;
  avatar: boolean;
  status: "en jeu" | "en ligne" | "hors ligne" | string;
  game?: { romId: number; name: string } | null;
  since?: number | null;
  lastSeen?: number | null;
}

let friends: { hidden: boolean; amis: Friend[] } | null | "loading" | { error: string } | undefined;
let friendsAt = 0;
let savingHidden = false;

async function loadFriends() {
  friendsAt = Date.now();
  if (friends === undefined) {
    friends = "loading";
    notifyCatalogue();
  }
  const r = await call(["amis"]);
  friends = r.error ? { error: errorText(r) } : (r.data ?? null);
  notifyCatalogue();
}

const friendsData = () => (friends && typeof friends === "object" && "amis" in friends ? friends : null);

function statusLine(f: Friend): string {
  if (f.status === "en jeu") return f.since ? ct("frPlayingFor", { d: duration(f.since) }) : ct("frPlaying");
  if (f.status === "en ligne") return ct("frOnline");
  return f.lastSeen ? ct("frSeen", { d: duration(f.lastSeen) }) : ct("frOffline");
}

const ORDER: Record<string, number> = { "en jeu": 0, "en ligne": 1, "hors ligne": 2 };

/** Nombre d'amis là (en ligne ou en jeu), pour l'entrée de l'onglet. */
export function friendsPresent(): number {
  if (friends === undefined || Date.now() - friendsAt > PRESENCE_MS) setTimeout(() => void loadFriends(), 0);
  return friendsData()?.amis.filter((f) => f.status !== "hors ligne").length ?? 0;
}

async function toggleHidden() {
  const d = friendsData();
  if (!d || savingHidden) return;
  savingHidden = true;
  const on = !d.hidden;
  playSfx(on ? "toggleOn" : "toggleOff");
  const r = await call(["hors-ligne", on ? "oui" : "non"]);
  savingHidden = false;
  if (r.error) toaster.toast({ title: "NieRDeck", body: ct("error", { error: errorText(r) }) });
  else d.hidden = on;
  notifyCatalogue();
}

export function friendsView(): TabView {
  if (friends === undefined || Date.now() - friendsAt > 20_000) setTimeout(() => void loadFriends(), 0);
  const d = friendsData();
  const list = d ? [...d.amis].sort((a, b) => (ORDER[a.status] ?? 3) - (ORDER[b.status] ?? 3) || a.username.localeCompare(b.username)) : [];
  const find = (id?: string) => list.find((f) => `f:${f.id}` === id);
  const items: NierMenuItem[] = [
    { id: "hidden", label: ct("frHidden"), badge: d ? (d.hidden ? ct("yes") : ct("no")) : "…" },
    ...list.map((f) => ({
      id: `f:${f.id}`,
      label: `${f.status === "en jeu" ? "▶ " : f.status === "en ligne" ? "● " : ""}${f.username}`,
      badge: f.status === "en jeu" ? (f.game?.name ?? ct("frPlaying")) : f.status === "en ligne" ? ct("frOnline") : ct("frOffline"),
      muted: f.status === "hors ligne",
    })),
  ];
  return {
    menuTitle: `${ct("friends")}${list.length ? ` · ${list.filter((f) => f.status !== "hors ligne").length}/${list.length}` : ""}`,
    items,
    detail: (id) => {
      if (id === "hidden" || !id) {
        const msg =
          friends === undefined || friends === "loading"
            ? ct("loading")
            : friends === null
              ? ct("frNone")
              : "error" in friends
                ? ct("error", { error: friends.error })
                : d?.hidden
                  ? ct("frHiddenOn")
                  : ct("frHiddenOff");
        return { title: ct("frHidden"), content: <NierGameDetail art={false} description={msg} /> };
      }
      const f = find(id);
      if (!f) return { title: ct("friends"), content: <NierGameDetail art={false} description={ct("loading")} /> };
      const fields = [{ label: ct("status"), value: statusLine(f) }];
      if (f.status === "en jeu" && f.game?.name) fields.push({ label: ct("frGame"), value: f.game.name });
      // Sa présence, puis ses statistiques (comme « Voir ses statistiques » du launcher).
      return { title: f.username, content: profileDetail(f.id, undefined, fields) };
    },
    activate: (id) => {
      if (id === "hidden") return void toggleHidden();
    },
    panel: (id) => (find(id) ? { rows: ["scroll"], activate: () => undefined, scroll: true } : undefined),
    hint: (id) => (id === "hidden" ? ct("frToggle") : find(id) ? ct("achBrowse") : undefined),
    back,
  };
}

// ───────────── Statistiques entre amis (StatsDialog.tsx) ─────────────

interface StatsGame {
  romId: number;
  name?: string | null;
  totalMs: number;
  sessions: number;
  last?: number;
}

interface PlayerStats {
  id: number;
  username: string;
  avatar: boolean;
  totalMs: number;
  sessions: number;
  games: number;
  weekMs: number | null;
  top: StatsGame[];
  recent: StatsGame[];
  hidden: boolean;
  me: boolean;
}

interface RankingRow {
  id: number;
  username: string;
  avatar: boolean;
  totalMs: number;
  games?: number;
  sessions?: number;
}

/** Profils lus (clé : id du joueur, 0 pour le sien) ; null : masqué ou gestionnaire trop ancien. */
const profiles: Record<number, PlayerStats | null | "loading" | { error: string }> = {};
let ranking: RankingRow[] | null | "loading" | undefined;

async function loadProfile(id: number) {
  profiles[id] = "loading";
  notifyCatalogue();
  const r = await call(id ? ["stats", id] : ["stats"]);
  profiles[id] = r.error ? { error: errorText(r) } : (r.data ?? null);
  notifyCatalogue();
}

async function loadRanking() {
  ranking = "loading";
  notifyCatalogue();
  const r = await call(["classement"]);
  ranking = Array.isArray(r.data) ? r.data : null;
  notifyCatalogue();
}

function gameRows(list: StatsGame[], withLast: boolean) {
  return list.map((g, i) => ({
    id: `g:${g.romId}:${i}`,
    name: g.name || `#${g.romId}`,
    description: [playtime(g.totalMs), ct("stSessions", { n: g.sessions }), withLast && g.last ? ct("stLast", { d: duration(g.last) }) : ""].filter(Boolean).join(" · "),
    achieved: true,
  }));
}

async function toggleStatsHidden(p: PlayerStats) {
  const on = !p.hidden;
  playSfx(on ? "toggleOn" : "toggleOff");
  const r = await call(["stats-masquees", on ? "oui" : "non"]);
  if (r.error) toaster.toast({ title: "NieRDeck", body: ct("error", { error: errorText(r) }) });
  else p.hidden = on;
  notifyCatalogue();
}

function profileDetail(id: number, row?: string, extra: { label: string; value: string }[] = []): ReactNode {
  if (profiles[id] === undefined) setTimeout(() => void loadProfile(id), 0);
  const p = profiles[id];
  if (p === undefined || p === "loading") return <NierGameDetail art={false} description={ct("loading")} />;
  if (p === null) return <NierGameDetail art={false} fields={extra} description={ct("stUnavailable")} />;
  if ("error" in p) return <NierGameDetail art={false} fields={extra} description={ct("error", { error: p.error })} />;
  const avatar = avatarOf(p.id, p.avatar);
  const fields = [
    ...extra,
    { label: ct("stTotal"), value: playtime(p.totalMs) },
    { label: ct("stGames"), value: String(p.games) },
    { label: ct("stSessionsLabel"), value: String(p.sessions) },
  ];
  if (p.weekMs != null) fields.push({ label: ct("stWeek"), value: playtime(p.weekMs) });
  return (
    <div>
      <NierGameDetail image={avatar ? [avatar] : []} imageAlt={p.username} compact fields={fields} />
      {p.me && (
        <>
          <NierOptionList options={[{ id: "hide", label: ct("stHide"), badge: p.hidden ? ct("yes") : ct("no"), active: p.hidden }] as NierOption[]} selectedId={row} />
          <Text>{p.hidden ? ct("stHiddenOn") : ct("stHiddenOff")}</Text>
        </>
      )}
      <div className="nier-ach-progress-label">{ct("stTop")}</div>
      <NierAchievementList unlocked={0} total={0} emptyText={ct("stNone")} items={gameRows(p.top, false)} />
      {p.recent.length > 0 && (
        <>
          <div className="nier-ach-progress-label" style={{ marginTop: 14 }}>
            {ct("stRecent")}
          </div>
          <NierAchievementList unlocked={0} total={0} items={gameRows(p.recent, true)} />
        </>
      )}
    </div>
  );
}

export function statsView(): TabView {
  if (ranking === undefined) setTimeout(() => void loadRanking(), 0);
  const rows = Array.isArray(ranking) ? ranking : [];
  const mine = profiles[0];
  const meId = mine && typeof mine === "object" && "id" in mine ? mine.id : null;
  const items: NierMenuItem[] = [
    { id: "me", label: ct("stMe") },
    ...rows.map((r, i) => ({ id: `p:${r.id}`, label: `${i + 1}. ${r.username}${r.id === meId ? ` ${ct("you")}` : ""}`, badge: playtime(r.totalMs) })),
  ];
  const idOf = (id?: string) => (id === "me" || !id ? 0 : Number(id.slice(2)));
  return {
    menuTitle: ct("stats"),
    items,
    detail: (id, row) => {
      const pid = idOf(id);
      const r = rows.find((x) => x.id === pid);
      return { title: pid === 0 ? ct("stMe") : (r?.username ?? ct("stats")), content: profileDetail(pid === meId ? 0 : pid, row) };
    },
    activate: () => undefined,
    panel: (id) => {
      const p = profiles[idOf(id) === meId ? 0 : idOf(id)];
      if (!p || typeof p !== "object" || !("me" in p) || !p.me) return { rows: ["scroll"], activate: () => undefined, scroll: true };
      // ↑ ↓ font défiler le profil, A change « Masquer mes statistiques ».
      return {
        rows: ["hide"],
        scroll: true,
        activate: () => void toggleStatsHidden(p),
      } satisfies PanelDef;
    },
    hint: (id) => {
      const p = profiles[idOf(id) === meId ? 0 : idOf(id)];
      return p && typeof p === "object" && "me" in p && p.me ? ct("choose") : ct("achBrowse");
    },
    back,
  };
}

// ───────────── Nouvelles versions ─────────────

interface LauncherNote {
  version: string;
  date: string;
  lines: { kind: "title" | "text"; text: string }[];
}

let notes: LauncherNote[] | "loading" | { error: string } | undefined;
const NOTES_SEEN = "nierdeck.notesSeen";

function seenVersion(): string | null {
  try {
    return localStorage.getItem(NOTES_SEEN);
  } catch {
    return null;
  }
}

/** Le moteur vient de changer de version (et ses notes n'ont pas été lues). */
export function newVersion(): boolean {
  const v = catalogueState().status?.data?.version;
  return !!v && seenVersion() !== v;
}

async function loadNotes(current: string) {
  notes = "loading";
  notifyCatalogue();
  const r = await backendNotes(current).catch((e) => ({ error: "call", message: String(e) }) as CliResult<LauncherNote[]>);
  notes = r.data ?? { error: errorText(r) };
  notifyCatalogue();
}

export function versionsView(): TabView {
  const current = catalogueState().status?.data?.version ?? "";
  if (notes === undefined && current) setTimeout(() => void loadNotes(current), 0);
  // Ouvertes : lues.
  if (current && seenVersion() !== current) {
    try {
      localStorage.setItem(NOTES_SEEN, current);
    } catch {
      /* rien à retenir */
    }
  }
  const list = Array.isArray(notes) ? notes : [];
  const find = (id?: string) => list.find((n) => `v:${n.version}` === id);
  return {
    menuTitle: ct("versions"),
    items: list.map((n): NierMenuItem => ({ id: `v:${n.version}`, label: `v${n.version}`, badge: n.version === current ? ct("vInstalled") : undefined })),
    detail: (id) => {
      const n = find(id);
      if (!n) {
        const msg = notes === undefined || notes === "loading" ? ct("loading") : !Array.isArray(notes) ? ct("error", { error: notes.error }) : ct("vNone");
        return { title: ct("versions"), content: <NierGameDetail art={false} description={msg} /> };
      }
      const date = n.date ? new Date(n.date).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : "";
      return {
        title: `FaRFa project v${n.version}`,
        content: (
          <div>
            {date && <Text>{date}</Text>}
            {n.lines.map((l, i) =>
              l.kind === "title" ? (
                <div key={i} className="nier-ach-progress-label" style={{ marginTop: 10 }}>
                  {l.text}
                </div>
              ) : (
                <Text key={i}>{l.text}</Text>
              ),
            )}
          </div>
        ),
      };
    },
    activate: () => undefined,
    // A : la zone de droite défile (↑ ↓), les notes peuvent être longues.
    panel: (id) => (find(id) ? { rows: ["scroll"], activate: () => undefined, scroll: true } : undefined),
    hint: (id) => (find(id) ? ct("achBrowse") : undefined),
    back,
  };
}
