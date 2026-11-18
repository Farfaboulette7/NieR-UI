// Page d'un jeu de l'onglet Farfa project : les onglets de la page de jeu de FarfaLauncher
// (Informations, Installation, Langue, Sauvegardes, Nouveautés, Médias, Classement), en menu
// à gauche. A sur une ligne de droite agit (jouer, installer, choisir…), B revient à la liste.
import { Navigation } from "@decky/ui";
import { toaster } from "@decky/api";
import type { ReactNode } from "react";
import { NierGameDetail, NierMeter, NierOptionList, type NierField, type NierMenuItem, type NierOption } from "../nier-ui";
import { playSfx } from "../launcher/audio";
import { getGame, launchGame } from "../launcher/steamLibrary";
import type { PanelDef, TabView } from "../launcher/tabView";
import { ct, type CatKey } from "./i18n";
import { shortcutGameId } from "./shortcuts";
import {
  cancelInstall,
  chooseExecutable,
  ensureShortcut,
  formatDate,
  imageUrl,
  install,
  loadDetails,
  offersOf,
  openHistory,
  pickVersion,
  setLanguage,
  setOpenGame,
  syncGame,
  uninstall,
  useWay,
  wayName,
  waysOf,
  type CatDetails,
  type CatGame,
  type CatOffer,
  type catalogueState,
} from "./store";

declare const SteamClient: any;

type CatState = ReturnType<typeof catalogueState>;

const Text = ({ children }: { children: ReactNode }) => (
  <p className="nier-game-description" style={{ margin: "6px 0 12px", whiteSpace: "pre-line" }}>
    {children}
  </p>
);

const TARGETS: Record<string, string> = {
  Windows: "Windows",
  Linux: "Linux",
  Linux_Arch: "Linux (Arch)",
  SteamOS: "SteamOS",
  macOS_ARM: "macOS (Apple Silicon)",
  macOS_Intel: "macOS (Intel)",
};
const DECK = "SteamOS";

export const fullDetails = (cat: CatState, romId: number): CatDetails | undefined => {
  const d = cat.details[romId];
  return d && typeof d === "object" && "game" in d ? d : undefined;
};

export const isInstalled = (cat: CatState, romId: number, game?: CatGame) => {
  const d = fullDetails(cat, romId);
  return d ? !!d.installed : !!game?.installed;
};

export function kindLabel(game: CatGame | undefined, d: CatDetails | undefined): string {
  if (d) {
    // Installé : la façon de jouer en service (recomp ou émulateur choisi).
    const active = waysOf(d).find((w) => w.active);
    if (active) return active.kind === "emulator" ? ct("kindEmulator", { name: wayName(d, active.kind, active.id) }) : `${ct("kindRecomp")} · ${wayName(d, active.kind, active.id)}`;
    if (d.installWith === "recomp") return d.game?.pc ? ct("kindPc") : ct("kindRecomp");
    if (d.installWith === "emulator") return ct("kindEmulator", { name: d.game?.emulator?.name ?? "" });
    return ct("kindNone");
  }
  if (!game) return "…";
  if (game.pc) return ct("kindPc");
  if (game.recomp) return ct("kindRecomp");
  if (game.emulator) return ct("kindEmulator", { name: game.emulator });
  return "…";
}

export function formatSize(bytes: number): string {
  const units = ["o", "Ko", "Mo", "Go", "To"];
  let v = Math.max(0, bytes);
  let i = 0;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1).replace(".", ",")} ${units[i]}`;
}

export function formatPlaytime(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Notes de version en Markdown, lisibles en texte simple (sans tableaux, liens ni gras). */
function plainNotes(md: string): string {
  return md
    .split("\n")
    .filter((l) => !l.trim().startsWith("|"))
    .map((l) =>
      l
        .replace(/^#+\s*/, "")
        .replace(/^\s*[-*]\s+/, "• ")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/\*\*|__|`/g, ""),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function repoHost(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "github.com" ? "GitHub" : host;
  } catch {
    return url;
  }
}

// ───────────── Actions ─────────────

function playGame(cat: CatState, romId: number) {
  const appid = cat.shortcuts[String(romId)];
  if (!appid) {
    // Page Steam pas encore créée (installé avant le plugin…) : créée, puis lancée.
    void ensureShortcut(romId).then(() => cat.shortcuts[String(romId)] && playGame(cat, romId));
    return;
  }
  const game = getGame(appid);
  if (game) launchGame(game);
  else {
    try {
      SteamClient.Apps.RunGame(shortcutGameId(appid), "", -1, 100);
    } catch {
      toaster.toast({ title: "NieRDeck", body: ct("playFailed") });
    }
  }
}

function actionRows(cat: CatState, romId: number): NierOption[] {
  const p = cat.progress[romId];
  if (p) return p.phase === "cancel" ? [] : [{ id: "cancel", label: ct("actionCancel") }];
  const d = fullDetails(cat, romId);
  // Installation qui attend le choix de l'exécutable.
  const pending: string[] = d?.installed && !d.installed.executable ? (d.installed.pendingCandidates ?? []) : [];
  if (pending.length) return pending.map((exe) => ({ id: `exe:${exe}`, label: exe }));
  if (isInstalled(cat, romId)) {
    return [
      { id: "play", label: ct("actionPlay") },
      { id: "steam", label: ct("actionSteamPage") },
      { id: "shortcut", label: ct("actionShortcut") },
      { id: "uninstall", label: ct("actionUninstall") },
    ];
  }
  if (d && !d.canInstall) return [];
  return [{ id: "install", label: ct("actionInstall") }];
}

function doAction(cat: CatState, romId: number, row: string) {
  playSfx("confirm");
  if (row === "cancel") void cancelInstall(romId);
  else if (row === "install") void install(romId);
  else if (row === "play") playGame(cat, romId);
  else if (row === "steam") {
    const appid = cat.shortcuts[String(romId)];
    if (appid) Navigation.Navigate(`/library/app/${appid}`);
  } else if (row === "shortcut") void ensureShortcut(romId, true);
  else if (row === "uninstall") void uninstall(romId);
  else if (row.startsWith("exe:")) void chooseExecutable(romId, row.slice(4));
}

function progressMeter(cat: CatState, romId: number) {
  const p = cat.progress[romId];
  if (!p) return null;
  return <NierMeter label={ct(`phase_${p.phase}` as CatKey) ?? p.phase} value={p.total > 0 ? Math.round((p.done / p.total) * 100) : 0} mutedLabel="…" />;
}

// ───────────── Installation : recomp ou émulateur ─────────────

const offerRow = (o: CatOffer) => `offer:${o.kind}:${o.id}`;

/** Ce que « Jouer » lance, sinon ce que le launcher conseille. */
function defaultOffer(d: CatDetails | undefined, offers: CatOffer[]): CatOffer | undefined {
  const active = waysOf(d).find((w) => w.active);
  if (active) return offers.find((o) => o.kind === active.kind && o.id === active.id);
  if (d?.installWith === "emulator") return offers.find((o) => o.kind === "emulator" && o.id === d.game?.emulator?.id);
  return offers.find((o) => o.kind === "recomp" && o.id === d?.game?.recompId) ?? offers.find((o) => o.available) ?? offers[0];
}

function offerLabel(d: CatDetails | undefined, o: CatOffer): NierOption {
  const way = waysOf(d).find((w) => w.kind === o.kind && w.id === o.id);
  const tags = [
    o.advice ? ct("tagAdvice") : "",
    way?.active ? ct("tagActive") : way ? ct("tagInstalled") : "",
    !o.available ? ct("tagUnavailable") : "",
  ].filter(Boolean);
  const kind = o.kind === "recomp" ? ct("modeRecomp") : ct("modeEmu");
  return { id: offerRow(o), label: `${kind} · ${o.name}`, badge: tags.join(" · ") || undefined, active: !!way?.active };
}

function installRows(cat: CatState, romId: number): NierOption[] {
  if (cat.progress[romId]) return [];
  const d = fullDetails(cat, romId);
  return offersOf(d).map((o) => offerLabel(d, o));
}

/** Ce que fait A sur une recomp ou un émulateur, et le texte qui l'annonce. */
function offerAction(cat: CatState, romId: number, d: CatDetails | undefined, o: CatOffer): { hint: string; run: () => void } | null {
  if (cat.progress[romId]) return null;
  const ways = waysOf(d);
  const way = ways.find((w) => w.kind === o.kind && w.id === o.id);
  const active = ways.find((w) => w.active);
  if (way?.active) return null;
  if (way) return { hint: ct("offerUse", { name: o.name }), run: () => void useWay(romId, o.kind, o.id) };
  if (!o.available) return null;
  const run = () => void install(romId, o.kind === "emulator" ? o.id : "", o.kind === "recomp" ? o.id : "");
  if (!d?.installed) return { hint: ct("offerNew", { name: o.name }), run };
  // Recomp partagée par plusieurs jeux : pas d'installation à côté.
  if (o.kind === "recomp" && d.game?.runtime) return null;
  if (!d.installed.executable) return null;
  return { hint: ct("offerAdd", { name: o.name, others: active ? wayName(d, active.kind, active.id) : ct("installed") }), run };
}

function installDetail(cat: CatState, romId: number, row?: string): ReactNode {
  const d = fullDetails(cat, romId);
  const g = d?.game;
  if (!d) return <NierGameDetail art={false} description={ct("loading")} />;
  const offers = offersOf(d);
  const progress = progressMeter(cat, romId);
  // Jeu PC : pas de choix, son type et Proton.
  if (!offers.length) {
    const fields: NierField[] = [{ label: ct("kind"), value: kindLabel(undefined, d) }];
    if (d.installed?.pc?.proton) fields.push({ label: ct("fProton"), value: d.installed.pc.proton.version ?? ct("protonDefault") });
    if (d.installed) fields.push({ label: ct("fLocation"), value: d.installed.gameDir });
    return <NierGameDetail art={false} actions={progress} fields={fields} />;
  }
  const o = offers.find((x) => offerRow(x) === row) ?? defaultOffer(d, offers) ?? offers[0];
  const ways = waysOf(d);
  const way = ways.find((w) => w.kind === o.kind && w.id === o.id);
  const active = ways.find((w) => w.active);
  const romBytes = (g?.romFiles ?? []).reduce((n: number, f: any) => n + (f.size ?? 0), 0);
  const fields: NierField[] = [
    { label: ct("fMode"), value: `${o.kind === "recomp" ? ct("modeRecomp") : ct("modeEmu")} · ${o.name}` },
    { label: ct("fServerVersion"), value: o.version || ct("unknown") },
    { label: ct("fInstalledVersion"), value: way ? (way.version ?? ct("unknown")) : ct("notInstalledShort") },
  ];
  if (way) fields.push({ label: ct("fLocation"), value: (way as any).gameDir ?? "—" });
  else if (o.available) fields.push({ label: ct("fDownload"), value: `${formatSize(o.size + romBytes)}${d.installed?.executable ? ` ${ct("romKept")}` : ""}` });
  if (way?.active && d.installed?.executable) fields.push({ label: ct("fExecutable"), value: d.installed.executable });
  fields.push({ label: ct("fPlatforms"), value: o.systems.length ? o.systems.map((s) => (s === DECK ? `${TARGETS[s] ?? s} ✓` : (TARGETS[s] ?? s))).join(", ") : "—" });
  const sources = [o.repo ? ct("sourceRepo", { host: repoHost(o.repo), name: o.name }) : null].filter(Boolean).join(" · ");
  if (sources) fields.push({ label: ct("fSources"), value: sources });
  const shaders = cat.sheets[romId];
  const sh = o.kind === "emulator" && typeof shaders === "object" ? shaders.shaders?.[o.id] : undefined;
  if (sh) {
    const last = sh.sessions[sh.sessions.length - 1]?.added ?? 0;
    fields.push({ label: ct("fShaders"), value: `${sh.count.toLocaleString()}${sh.players.length > 1 ? ` · ${sh.players.length} joueurs` : ""} · +${last}` });
  }
  const notes: string[] = [];
  if (!o.available) notes.push(ct("offerUnavailable", { name: o.name, systems: o.systems.map((s) => TARGETS[s] ?? s).join(", ") || "—" }));
  if (o.configMissing.length) notes.push(ct("offerConfig", { name: o.name, items: o.configMissing.join(", ") }));
  if (o.advice) notes.push(o.advice);
  if (active) notes.push(ct("offerActive", { name: wayName(d, active.kind, active.id) }));
  const action = offerAction(cat, romId, d, o);
  if (action) notes.push(action.hint);
  return (
    <div>
      <NierGameDetail
        art={false}
        actions={
          <>
            {progress}
            <NierOptionList options={installRows(cat, romId)} selectedId={row} />
          </>
        }
        fields={fields}
      />
      <Text>{row ? notes.join("\n") : ct("installDesc")}</Text>
    </div>
  );
}

// ───────────── Langue ─────────────

function languageRows(cat: CatState, romId: number): NierOption[] {
  const lang = cat.languages[romId]?.language;
  if (!lang) return [];
  return [
    { id: "lang:fr", label: ct("langFr"), active: lang === "fr" },
    { id: "lang:en", label: ct("langEn"), active: lang === "en" },
  ];
}

// ───────────── Sauvegardes ─────────────

function savesRows(cat: CatState, romId: number): NierOption[] {
  const d = fullDetails(cat, romId);
  if (!d?.installed?.executable || d.installed.saves?.off) return [];
  const h = cat.history?.romId === romId ? cat.history : null;
  const versions: NierOption[] = (h?.versions ?? []).map((v) => ({
    id: `restore:${v.version}`,
    label: h?.confirm === v.version ? ct("historyConfirm", { date: formatDate(v.savedAt) }) : ct("historyRow", { date: formatDate(v.savedAt), device: v.device || ct("unknownDevice") }),
  }));
  return [{ id: "sync", label: ct("rowSyncGame") }, ...versions];
}

function savesDetail(cat: CatState, romId: number, row?: string): ReactNode {
  const d = fullDetails(cat, romId);
  const inst = d?.installed;
  if (!inst?.executable) return <NierGameDetail art={false} description={ct("notInstalledHint")} />;
  // Historique lu à la première visite de l'onglet.
  if (!inst.saves?.off && cat.history?.romId !== romId) setTimeout(() => void openHistory(romId), 0);
  const h = cat.history?.romId === romId ? cat.history : null;
  const dir = inst.saves?.off ? ct("savesOff") : (inst.saves?.dir ?? ct("savesUnknown"));
  const historyText = h?.error ? ct("error", { error: h.error }) : !h?.versions ? ct("loading") : h.versions.length ? ct("historyDesc") : ct("historyEmpty");
  return (
    <div>
      <NierGameDetail art={false} fields={[{ label: ct("fSaves"), value: dir }]} actions={<NierOptionList options={savesRows(cat, romId)} selectedId={row} />} />
      <Text>{`${ct("savesDesc")}\n\n${historyText}`}</Text>
    </div>
  );
}

// ───────────── La page ─────────────

type PageItem = "actions" | "info" | "install" | "language" | "saves" | "news" | "media" | "ranking";

function pageItems(cat: CatState, romId: number): PageItem[] {
  const d = fullDetails(cat, romId);
  const sheet = cat.sheets[romId];
  const items: PageItem[] = ["actions", "info", "install"];
  if (cat.languages[romId]?.language) items.push("language");
  if (d?.installed?.executable) items.push("saves");
  if (typeof sheet === "object" && sheet.changelog) items.push("news");
  if (d?.game?.screenshotUrls?.length) items.push("media");
  items.push("ranking");
  return items;
}

const ITEM_LABEL: Record<PageItem, CatKey> = {
  actions: "pageActions",
  info: "pageInfo",
  install: "pageInstall",
  language: "pageLanguage",
  saves: "pageSaves",
  news: "pageNews",
  media: "pageMedia",
  ranking: "pageRanking",
};

function rowsOf(cat: CatState, romId: number, item: PageItem): NierOption[] {
  const d = fullDetails(cat, romId);
  switch (item) {
    case "actions":
      return actionRows(cat, romId);
    case "install":
      return installRows(cat, romId);
    case "language":
      return languageRows(cat, romId);
    case "saves":
      return savesRows(cat, romId);
    case "media":
      return (d?.game?.screenshotUrls ?? []).map((_: string, i: number) => ({ id: `shot:${i}`, label: ct("shotN", { n: i + 1 }) }));
    default:
      return [];
  }
}

function activateRow(cat: CatState, romId: number, item: PageItem, row: string) {
  const d = fullDetails(cat, romId);
  if (item === "actions") return doAction(cat, romId, row);
  if (item === "install") {
    const o = offersOf(d).find((x) => offerRow(x) === row);
    const action = o && offerAction(cat, romId, d, o);
    if (!action) return playSfx("unfocus");
    playSfx("confirm");
    return action.run();
  }
  if (item === "language" && row.startsWith("lang:")) {
    playSfx("confirm");
    return void setLanguage(romId, row.slice(5) as "fr" | "en");
  }
  if (item === "saves") {
    playSfx("confirm");
    if (row === "sync") return void syncGame(romId);
    if (row.startsWith("restore:")) return void pickVersion(romId, row.slice(8));
  }
}

function pageDetail(cat: CatState, romId: number, game: CatGame | undefined, item: PageItem, row?: string): ReactNode {
  const d = fullDetails(cat, romId);
  const g = d?.game;
  const sheet = cat.sheets[romId];
  const sh = typeof sheet === "object" ? sheet : null;
  const failed = cat.details[romId];
  const error = failed && typeof failed === "object" && "error" in failed ? failed.error : undefined;
  if (error) return <NierGameDetail art={false} description={ct("error", { error })} />;
  const cover = imageUrl(g?.coverUrl ?? game?.coverUrl);
  switch (item) {
    case "actions": {
      const rows = actionRows(cat, romId);
      const status = cat.progress[romId] ? ct("statusInstalling") : isInstalled(cat, romId, game) ? ct("statusInstalled") : ct("statusNotInstalled");
      return (
        <NierGameDetail
          image={cover}
          imageAlt={g?.name ?? game?.name}
          compact
          actions={
            <>
              {progressMeter(cat, romId)}
              {rows.length > 0 && <NierOptionList options={rows} selectedId={row} />}
            </>
          }
          fields={[
            { label: ct("kind"), value: kindLabel(game, d) },
            { label: ct("status"), value: status },
          ]}
        />
      );
    }
    case "info": {
      const fields: NierField[] = [{ label: ct("console"), value: g?.console || game?.console || "—" }];
      const year = g?.releaseYear ?? game?.releaseYear;
      if (year) fields.push({ label: ct("fRelease"), value: String(year) });
      if (g?.developers?.length) fields.push({ label: ct("fDev"), value: g.developers.join(", ") });
      if (g?.genres?.length) fields.push({ label: ct("fGenres"), value: g.genres.join(", ") });
      fields.push({
        label: ct("fPlaytime"),
        value: sheet === "loading" || (!sh && !d) ? "…" : !sh || sh.playtimeMs == null ? ct("unavailable") : sh.playtimeMs === 0 ? ct("neverPlayed") : formatPlaytime(sh.playtimeMs),
      });
      fields.push({ label: ct("kind"), value: kindLabel(game, d) });
      if (sh?.rommPage) fields.push({ label: ct("fSources"), value: `${ct("rommPage")} · ${sh.rommPage}` });
      return (
        <div>
          <NierGameDetail image={cover} imageAlt={g?.name ?? game?.name} compact fields={fields} />
          {g?.summary && <Text>{g.summary}</Text>}
        </div>
      );
    }
    case "install":
      return installDetail(cat, romId, row);
    case "language":
      return (
        <div>
          <NierGameDetail art={false} actions={<NierOptionList options={languageRows(cat, romId)} selectedId={row} />} />
          <Text>{cat.languages[romId]?.language ? ct("langDesc") : ct("languageNone")}</Text>
        </div>
      );
    case "saves":
      return savesDetail(cat, romId, row);
    case "news": {
      const log = sh?.changelog;
      if (!log) return <NierGameDetail art={false} description={ct("noNews")} />;
      const date = log.date ? ` · ${formatDate(log.date)}` : "";
      return (
        <div>
          <Text>{`${ct("newsVersion", { kind: log.kind, name: log.name, version: log.version })}${date}`}</Text>
          <Text>{plainNotes(log.notes ?? "") || ct("noNews")}</Text>
        </div>
      );
    }
    case "media": {
      const shots: string[] = g?.screenshotUrls ?? [];
      if (!shots.length) return <NierGameDetail art={false} description={ct("noShots")} />;
      const i = row ? Number(row.slice(5)) : 0;
      return (
        <NierGameDetail
          image={imageUrl(shots[i] ?? shots[0])}
          imageAlt={g?.name}
          actions={<NierOptionList options={rowsOf(cat, romId, "media")} selectedId={row} />}
        />
      );
    }
    case "ranking": {
      if (sheet === "loading") return <NierGameDetail art={false} description={ct("loading")} />;
      const rows = sh?.ranking ?? [];
      if (!rows.length) return <NierGameDetail art={false} description={ct("noRanking")} />;
      return (
        <div>
          <NierGameDetail art={false} fields={rows.slice(0, 10).map((r, i) => ({ label: `${i + 1}. ${r.username}`, value: formatPlaytime(r.totalMs) }))} />
          <Text>{ct("rankingDesc")}</Text>
        </div>
      );
    }
  }
}

/** Page d'un jeu : ses onglets à gauche, leur contenu à droite. */
export function gamePageView(cat: CatState, romId: number, game: CatGame | undefined): TabView {
  if (!cat.details[romId]) setTimeout(() => void loadDetails(romId), 0);
  const d = fullDetails(cat, romId);
  const name = d?.game?.name ?? game?.name ?? `#${romId}`;
  const items = pageItems(cat, romId);
  const asItem = (id?: string) => (items.includes(id as PageItem) ? (id as PageItem) : "actions");
  return {
    menuTitle: name,
    items: items.map(
      (i): NierMenuItem => ({
        id: i,
        label: ct(ITEM_LABEL[i]),
        badge: i === "actions" && cat.progress[romId] ? "↓" : undefined,
      }),
    ),
    detail: (id, row) => ({ title: `${name} · ${ct(ITEM_LABEL[asItem(id)])}`, content: pageDetail(cat, romId, game, asItem(id), row) }),
    activate: () => {},
    panel: (id) => {
      const item = asItem(id);
      const rows = rowsOf(cat, romId, item);
      if (!rows.length) return undefined;
      // Installation : le curseur arrive sur ce que « Jouer » lance (ou ce qui est conseillé).
      const initial = item === "install" ? (() => {
        const o = defaultOffer(d, offersOf(d));
        return o ? offerRow(o) : undefined;
      })() : undefined;
      return { rows: rows.map((r) => r.id), initial, activate: (row) => activateRow(cat, romId, item, row) } satisfies PanelDef;
    },
    hint: (id) => (rowsOf(cat, romId, asItem(id)).length ? ct("choose") : undefined),
    back: () => {
      playSfx("back");
      setOpenGame(null);
      return true;
    },
  };
}
