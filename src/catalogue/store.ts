// État du Catalogue : réponses de FarfaLauncherDeck (via catalogue.py), mises en
// cache le temps de la session, et installations en cours. Hors de React, avec
// un abonnement (useCatalogue) comme settings.ts.
import { addEventListener, callable, removeEventListener, toaster } from "@decky/api";
import { useEffect, useState } from "react";
import { ct } from "./i18n";
import { createShortcut, removeShortcut } from "./shortcuts";

/** Réponse du programme : données, ou code et message d'erreur. */
export interface CliResult<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface CatInfo {
  version: string;
  serverUrl: string | null;
  connected: boolean | "offline";
  username: string | null;
  installed: number;
  pendingSessions: number;
}

export interface CatStatus extends CliResult<CatInfo> {
  cli: boolean;
  cliPath: string;
}

export interface CatConsole {
  id: number;
  name: string;
  slug: string;
  romCount: number;
  hasEmulator: boolean;
}

export interface CatGame {
  id: number;
  name: string;
  console: string;
  coverUrl: string | null;
  /** Faces de la boîte (RomM) : boîte 3D comme dans le launcher. */
  boxFaces?: { front: string; side: string; back: string | null } | null;
  /** Boîte 3D détourée (RomM), repli sans faces. */
  box3dUrl?: string | null;
  releaseYear: number | null;
  recomp: boolean;
  pc: boolean;
  emulator: string | null;
  installed: boolean;
  /** Façons d'y jouer sur le Deck (filtres Recomp / Émulation, badge), d'après le moteur. */
  modes?: { recomp: boolean; emulation: boolean };
  available?: boolean;
  detailsLoaded?: boolean;
  /** Une mise à jour attend ce jeu installé. */
  update?: boolean;
  /** Ajouté sur le serveur depuis moins de 24 h. */
  new?: boolean;
}

/** Filtres des listes de jeux, comme la bibliothèque du launcher. */
export type CatKind = "all" | "installed" | "recomp" | "emulation";
export const CAT_KINDS: CatKind[] = ["all", "installed", "recomp", "emulation"];

export interface CatDetails {
  game: any;
  installed: any | null;
  canInstall: boolean;
  installWith: "recomp" | "emulator" | "none";
}

export interface CatProgress {
  phase: string;
  done: number;
  total: number;
}

/** Liste affichée : une console, une recherche ou les jeux installés. */
interface GameList {
  games: CatGame[];
  loading: boolean;
  error?: string;
}

const backendStatus = callable<[], CatStatus>("catalogue_status");
const backendCall = callable<[args: (string | number)[]], CliResult<any>>("catalogue_call");
const backendConfigure = callable<[server: string, token: string], CliResult<CatInfo>>("catalogue_configure");
const backendInstall = callable<[romId: number, emulator: string, recomp: string], boolean>("catalogue_install");
const backendUpdateIfNewer = callable<[], CliResult<{ version: string; updated: boolean }>>("catalogue_update_cli_if_newer");

/** Langue d'un jeu installé : null = pas de choix pour ce jeu. */
export interface CatLanguage {
  language: "fr" | "en" | null;
  bo3: boolean;
}

export interface CatSaveVersion {
  version: string;
  savedAt: string;
  replacedAt: string;
  size: number;
  device?: string | null;
}

/** Façon de jouer installée (recomp ou émulateur), celle en service d'abord. */
export interface CatWay {
  kind: "recomp" | "emulator";
  id: string;
  version: string | null;
  active: boolean;
}

/** Recomp ou émulateur proposé pour un jeu, avec ce que l'onglet Informations du launcher en montre. */
export interface CatOffer {
  kind: "recomp" | "emulator";
  id: string;
  name: string;
  available: boolean;
  version: string;
  size: number;
  systems: string[];
  repo: string | null;
  advice: string | null;
  configMissing: string[];
}

export interface CatRanking {
  id: number;
  username: string;
  totalMs: number;
  sessions?: number;
}

export interface CatSheet {
  playtimeMs: number | null;
  ranking: CatRanking[] | null;
  shaders: Record<string, { count: number; players: number[]; sessions: { at: string; added: number }[] }> | null;
  changelog: { kind: string; name: string; version: string; date: string | null; url: string | null; notes: string } | null;
  rommPage: string;
}
const backendInstalling = callable<[], number[]>("catalogue_installing");
const backendCancel = callable<[romId: number], boolean>("catalogue_cancel");
const backendImage = callable<[url: string], string | null>("catalogue_image");
const backendShortcuts = callable<[], Record<string, number>>("catalogue_shortcuts");
const backendUpdate = callable<[], CliResult<{ version: string }>>("catalogue_update_cli");

interface CatState {
  status: CatStatus | null;
  consoles: CatConsole[] | null;
  consolesError?: string;
  lists: Record<string, GameList>;
  details: Record<number, CatDetails | "loading" | { error: string }>;
  images: Record<string, string | null | "loading">;
  progress: Record<number, CatProgress>;
  shortcuts: Record<string, number>;
  /** Liste ouverte dans l'onglet (clé de `lists`), ou null : la liste des consoles. */
  openList: string | null;
  /** Réglages / actions en cours (Système → FarfaLauncher). */
  busy: string | null;
  notice: string | null;
  languages: Record<number, CatLanguage>;
  /** Page de jeu ouverte dans l'onglet (sous la liste `openList`). */
  openGame: number | null;
  /** Reste de la fiche (temps de jeu, nouveautés, classement, shaders). */
  sheets: Record<number, CatSheet | "loading">;
  /** Historique des sauvegardes affiché à la place des actions d'un jeu. */
  history: { romId: number; versions: CatSaveVersion[] | null; error?: string; confirm: string | null } | null;
  /** Favoris (collection RomM, partagée avec le launcher). */
  favorites: Set<number>;
  /** Filtre des listes de jeux. */
  kind: CatKind;
}

const state: CatState = {
  status: null,
  consoles: null,
  openList: null,
  lists: {},
  details: {},
  images: {},
  progress: {},
  shortcuts: {},
  busy: null,
  notice: null,
  languages: {},
  history: null,
  openGame: null,
  sheets: {},
  favorites: new Set(),
  kind: "all",
};
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

export const catalogueState = () => state;

/** Serveur réglé et jeton accepté : l'onglet Catalogue s'affiche. */
export const catalogueReady = () => !!state.status?.cli && !!state.status.data?.serverUrl && state.status.data.connected !== false;

const errorText = (r: CliResult<unknown>) => r.message || r.error || "?";

/** État du moteur et des raccourcis. Au démarrage de Steam, le backend peut ne
 * pas encore répondre : nouvelles tentatives pendant une minute. */
export async function loadCatalogue(attempt = 0) {
  try {
    state.status = await backendStatus();
    state.shortcuts = (await backendShortcuts()) ?? {};
    for (const id of (await backendInstalling()) ?? []) state.progress[id] ??= { phase: "prepare", done: 0, total: 0 };
    void autoUpdateEngine();
    if (catalogueReady()) void loadFavorites();
  } catch (e) {
    console.error("[NieRDeck] catalogue", e);
    if (attempt < 12) setTimeout(() => void loadCatalogue(attempt + 1), 5000);
  }
  changed();
}

/** Une fois par démarrage : le moteur suit la dernière version publiée de FarfaLauncher. */
let autoUpdated = false;
async function autoUpdateEngine() {
  if (autoUpdated || !state.status?.cli) return;
  autoUpdated = true;
  try {
    const r = await backendUpdateIfNewer();
    if (r.data?.updated) {
      toaster.toast({ title: "NieRDeck", body: ct("updated", { version: r.data.version }) });
      await refreshStatus();
    }
  } catch (e) {
    console.error("[NieRDeck] mise à jour du moteur", e);
  }
}

// ───── événements de l'installation (catalogue.py) ─────
let eventsBound = false;
export function bindCatalogueEvents(): () => void {
  if (eventsBound) return () => {};
  eventsBound = true;
  const onProgress = addEventListener<[CatProgress & { romId: number }]>("catalogue_progress", (p) => {
    if (!p) return;
    state.progress = { ...state.progress, [p.romId]: { phase: p.phase, done: p.done, total: p.total } };
    changed();
  });
  const onDone = addEventListener<[CliResult<any> & { romId: number }]>("catalogue_done", (r) => void installFinished(r));
  return () => {
    eventsBound = false;
    removeEventListener("catalogue_progress", onProgress);
    removeEventListener("catalogue_done", onDone);
  };
}

/** Nom et visuels connus d'un jeu (liste ou fiche). */
function knownGame(romId: number): { name: string; cover: string | null; screenshot: string | null } {
  const d = state.details[romId];
  const g = d && typeof d === "object" && "game" in d ? d.game : null;
  const summary = Object.values(state.lists).flatMap((l) => l.games).find((x) => x.id === romId);
  return {
    name: g?.name ?? summary?.name ?? `#${romId}`,
    cover: g?.coverUrl ?? summary?.coverUrl ?? null,
    screenshot: g?.screenshotUrls?.[0] ?? null,
  };
}

function markInstalled(romId: number, installed: boolean) {
  for (const list of Object.values(state.lists)) {
    for (const g of list.games) if (g.id === romId) g.installed = installed;
  }
  delete state.details[romId];
  delete state.lists.installed;
}

async function installFinished(r: CliResult<any> & { romId: number }) {
  const { romId } = r;
  const progress = { ...state.progress };
  delete progress[romId];
  state.progress = progress;
  const game = knownGame(romId);
  if (r.error === "cancelled") {
    toaster.toast({ title: "NieRDeck", body: ct("installCancelled", { name: game.name }) });
    delete state.details[romId];
  } else if (r.error) {
    toaster.toast({ title: "NieRDeck", body: ct("installFailed", { name: game.name, error: errorText(r) }) });
  } else if (r.data?.status === "needsChoice") {
    markInstalled(romId, true);
    toaster.toast({ title: "NieRDeck", body: ct("needsChoice", { name: game.name }) });
  } else {
    markInstalled(romId, true);
    await ensureShortcut(romId);
    toaster.toast({ title: "NieRDeck", body: ct("installDone", { name: game.name }) });
  }
  changed();
  void refreshStatus();
}

/** Page Steam du jeu (raccourci « jouer <id> » avec les visuels de RomM). */
export async function ensureShortcut(romId: number, force = false) {
  const cliPath = state.status?.cliPath;
  if (!cliPath) return;
  try {
    // Visuels : fiche complète si elle manque (captures d'écran pour la bannière).
    if (!(typeof state.details[romId] === "object" && "game" in (state.details[romId] as any))) await loadDetails(romId, true);
    const game = knownGame(romId);
    if (force && state.shortcuts[String(romId)]) state.shortcuts = await removeShortcut(romId, state.shortcuts[String(romId)]);
    state.shortcuts = await createShortcut(romId, game.name, cliPath, state.shortcuts[String(romId)], { cover: game.cover, hero: game.screenshot });
  } catch (e) {
    console.error("[NieRDeck] raccourci", e);
    toaster.toast({ title: "NieRDeck", body: ct("shortcutFailed", { error: String(e) }) });
  }
  changed();
}

export async function refreshStatus() {
  try {
    state.status = await backendStatus();
  } catch (e) {
    console.error("[NieRDeck] catalogue", e);
  }
  changed();
}

export async function loadConsoles(force = false) {
  if (state.consoles && !force) return;
  const r = await backendCall(["consoles"]);
  state.consoles = r.data?.consoles ?? [];
  state.consolesError = r.error ? errorText(r) : undefined;
  changed();
}

/** Clés de liste : `console:<id>`, `search:<texte>`, `installed`. */
export async function loadList(key: string, force = false) {
  if (state.lists[key] && !force) return;
  state.lists = { ...state.lists, [key]: { games: state.lists[key]?.games ?? [], loading: true } };
  changed();
  let r: CliResult<any>;
  if (key === "favorites") {
    r = await backendCall(["favoris"]);
    if (r.data) {
      state.favorites = new Set(r.data.romIds ?? []);
      if (r.data.offline) r = { error: "offline", message: ct("favoritesOffline") };
    }
  } else if (key === "installed") {
    // Résumés comme les autres listes (badges, filtres) ; moteur d'avant : l'état installé.
    r = await backendCall(["installes", "--resumes"]);
    // Hors ligne (il faut le serveur) ou moteur d'avant : la liste locale des jeux installés.
    if (r.error || (r.data && !(r.data.games ?? []).some((g: any) => "modes" in g))) r = await backendCall(["installes"]);
    else if (r.data) r = { data: { games: r.data.games } };
    // Jeux installés : leur état complet ; on garde ce qu'affiche la liste.
    if (r.data && (r.data.games ?? []).some((g: any) => "romId" in g)) {
      r = {
        data: {
          games: (r.data.games ?? [])
            .filter((g: any) => g.romId > 0)
            .map((g: any) => ({ id: g.romId, name: g.name, console: "", coverUrl: null, releaseYear: null, recomp: !g.shared || g.shared.kind !== "emulator", pc: !!g.pc, emulator: g.shared?.kind === "emulator" ? g.shared.runtimeName : null, installed: true })),
        },
      };
    }
  } else if (key.startsWith("search:")) {
    r = await backendCall(["recherche", key.slice(7)]);
  } else {
    const id = key.slice(8);
    // Une console entière, page après page.
    const games: CatGame[] = [];
    let offset = 0;
    for (;;) {
      r = await backendCall(["jeux", id, offset]);
      if (!r.data) break;
      games.push(...(r.data.games ?? []));
      if (!r.data.more) break;
      offset += r.data.games.length;
      state.lists = { ...state.lists, [key]: { games: [...games], loading: true } };
      changed();
    }
    if (r.data) r = { data: { games } };
  }
  state.lists = { ...state.lists, [key]: { games: r.data?.games ?? [], loading: false, error: r.error ? errorText(r) : undefined } };
  changed();
}

export async function loadDetails(romId: number, force = false) {
  const cur = state.details[romId];
  if (cur && !force && !(typeof cur === "object" && "error" in cur)) return;
  state.details = { ...state.details, [romId]: "loading" };
  changed();
  const r = await backendCall(["jeu", romId]);
  state.details = { ...state.details, [romId]: r.data ?? { error: errorText(r) } };
  changed();
  // Jeu installé : sa langue, si elle se choisit.
  if (r.data?.installed?.executable) {
    const l = await backendCall(["langue", romId]);
    if (l.data) {
      state.languages = { ...state.languages, [romId]: l.data };
      changed();
    }
  }
}

/** Recomps et émulateurs proposés pour un jeu (fiche du moteur), comme le launcher. */
export function offersOf(d: CatDetails | undefined): CatOffer[] {
  const g = d?.game;
  if (!g || g.pc) return [];
  const recomps: CatOffer[] = g.recomp
    ? (g.recomps?.length
        ? g.recomps
        : [
            {
              id: g.recompId ?? "recomp",
              name: g.runtime?.name ?? "Recomp",
              available: d!.installWith === "recomp",
              version: g.serverVersion ?? "",
              size: g.myArchive?.size ?? 0,
              systems: (g.archives ?? []).map((a: any) => a.target),
              repo: g.runtime?.repo ?? null,
            },
          ]
      ).map((r: any) => ({
        kind: "recomp" as const,
        id: r.id,
        name: r.name,
        available: !!r.available,
        version: r.version ?? "",
        size: r.size ?? 0,
        systems: r.systems ?? [],
        repo: r.repo ?? null,
        advice: r.advice ?? null,
        configMissing: [],
      }))
    : [];
  const emulators: CatOffer[] = (g.emulators ?? []).map((e: any) => ({
    kind: "emulator" as const,
    id: e.id,
    name: e.name,
    available: !!e.available && !e.configMissing?.length,
    version: e.version ?? "",
    size: e.size ?? 0,
    systems: e.systems ?? [],
    repo: e.repo ?? null,
    advice: e.advice ?? null,
    configMissing: e.configMissing ?? [],
  }));
  return [...recomps, ...emulators];
}

/** Façons de jouer installées (vides pour un jeu PC ou une installation inachevée). */
export function waysOf(d: CatDetails | undefined): CatWay[] {
  return d?.installed?.executable ? (d.installed.ways ?? []) : [];
}

export function wayName(d: CatDetails | undefined, kind: string, id: string): string {
  return offersOf(d).find((o) => o.kind === kind && o.id === id)?.name ?? id;
}

/** Joue avec une autre façon déjà installée. */
export async function useWay(romId: number, kind: string, id: string) {
  const d = state.details[romId] as CatDetails | undefined;
  const name = knownGame(romId).name;
  const way = wayName(typeof d === "object" && d && "game" in d ? d : undefined, kind, id);
  const r = await backendCall(["utiliser", romId, kind, id]);
  toaster.toast({ title: "NieRDeck", body: r.error ? ct("error", { error: errorText(r) }) : ct("wayChanged", { name, way }) });
  delete state.details[romId];
  delete state.lists.installed;
  changed();
  void loadDetails(romId, true);
}

/** Met le jeu en français ou en anglais. */
export async function setLanguage(romId: number, lang: "fr" | "en") {
  if (state.languages[romId]?.language === lang) return;
  await toggleLanguage(romId);
}

/** Bascule la langue du jeu (Français ↔ English). */
export async function toggleLanguage(romId: number) {
  const cur = state.languages[romId];
  if (!cur?.language) return;
  const next = cur.language === "fr" ? "en" : "fr";
  const r = await backendCall(["langue", romId, next]);
  if (r.error) {
    toaster.toast({ title: "NieRDeck", body: ct("error", { error: errorText(r) }) });
    return;
  }
  state.languages = { ...state.languages, [romId]: r.data };
  toaster.toast({ title: "NieRDeck", body: ct("languageChanged", { name: knownGame(romId).name, lang: ct(r.data.language === "en" ? "langEn" : "langFr") }) });
  changed();
}

export const formatDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

export async function openHistory(romId: number) {
  state.history = { romId, versions: null, confirm: null };
  changed();
  const r = await backendCall(["historique", romId]);
  if (state.history?.romId !== romId) return;
  state.history = { romId, versions: r.data?.versions ?? [], error: r.error ? errorText(r) : undefined, confirm: null };
  changed();
}

export function closeHistory() {
  state.history = null;
  changed();
}

/** Premier appui : demande confirmation ; second appui sur la même version : la remet. */
export async function pickVersion(romId: number, version: string) {
  const h = state.history;
  if (!h || h.romId !== romId) return;
  if (h.confirm !== version) {
    state.history = { ...h, confirm: version };
    changed();
    return;
  }
  const v = h.versions?.find((x) => x.version === version);
  const r = await backendCall(["restaurer", romId, version]);
  toaster.toast({
    title: "NieRDeck",
    body: r.error ? ct("error", { error: errorText(r) }) : ct("restored", { name: knownGame(romId).name, date: v ? formatDate(v.savedAt) : version }),
  });
  if (!r.error) void openHistory(romId);
  else {
    state.history = { ...h, confirm: null };
    changed();
  }
}

/** Image du serveur : `loading` pendant le téléchargement, null si elle n'existe pas. */
export function imageState(url: string | null | undefined): string | null | "loading" {
  if (!url) return null;
  imageUrl(url);
  const cur = state.images[url];
  return cur === undefined || cur === "loading" ? "loading" : cur;
}

/** Image du serveur, servie en local (null : pas d'image). */
export function imageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const cur = state.images[url];
  if (cur === undefined) {
    state.images[url] = "loading";
    backendImage(url)
      .then((local) => {
        state.images = { ...state.images, [url]: local ?? null };
        changed();
      })
      .catch(() => {
        state.images = { ...state.images, [url]: null };
        changed();
      });
    return undefined;
  }
  return cur && cur !== "loading" ? cur : undefined;
}

/** Installe le jeu avec l'émulateur ou la recomp choisis (sinon ceux conseillés). Une autre
 * façon déjà installée reste sur le disque, en réserve. */
export async function install(romId: number, emulator = "", recomp = "") {
  if (state.progress[romId]) return;
  state.progress = { ...state.progress, [romId]: { phase: "prepare", done: 0, total: 0 } };
  changed();
  const started = await backendInstall(romId, emulator, recomp);
  if (!started) {
    const progress = { ...state.progress };
    delete progress[romId];
    state.progress = progress;
    changed();
  }
}

function clearProgress(romId: number) {
  const progress = { ...state.progress };
  delete progress[romId];
  state.progress = progress;
  delete state.details[romId];
  delete state.lists.installed;
  changed();
}

/** Annule l'installation en cours. La fin arrive par l'événement catalogue_done ; pour une
 * installation lancée avant un redémarrage du plugin (pas d'événement), on attend que le
 * moteur se soit arrêté. */
export async function cancelInstall(romId: number) {
  const p = state.progress[romId];
  if (!p || p.phase === "cancel") return;
  state.progress = { ...state.progress, [romId]: { ...p, phase: "cancel" } };
  changed();
  if (!(await backendCancel(romId))) {
    // Plus d'installation en cours côté moteur : l'état affiché était périmé.
    clearProgress(romId);
    return;
  }
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    if (state.progress[romId]?.phase !== "cancel") return;
    const running = (await backendInstalling()) ?? [];
    if (!running.includes(romId)) {
      clearProgress(romId);
      toaster.toast({ title: "NieRDeck", body: ct("installCancelled", { name: knownGame(romId).name }) });
      return;
    }
  }
}

export async function uninstall(romId: number) {
  const name = knownGame(romId).name;
  const r = await backendCall(["desinstaller", romId]);
  if (r.error) {
    toaster.toast({ title: "NieRDeck", body: ct("error", { error: errorText(r) }) });
    return;
  }
  const appid = state.shortcuts[String(romId)];
  if (appid) state.shortcuts = await removeShortcut(romId, appid);
  markInstalled(romId, false);
  toaster.toast({ title: "NieRDeck", body: ct("uninstallDone", { name }) });
  changed();
  void refreshStatus();
}

export async function chooseExecutable(romId: number, exe: string) {
  const r = await backendCall(["choisir", romId, exe]);
  if (r.error) toaster.toast({ title: "NieRDeck", body: ct("error", { error: errorText(r) }) });
  else await ensureShortcut(romId);
  delete state.details[romId];
  changed();
}

/** Réglage d'une action (Système → FarfaLauncher) : message affiché, état relu. */
async function withBusy(label: string, f: () => Promise<string | null>) {
  state.busy = label;
  state.notice = null;
  changed();
  try {
    state.notice = await f();
  } catch (e) {
    state.notice = ct("error", { error: String(e) });
  }
  state.busy = null;
  await refreshStatus();
}

export const configure = (server: string, token: string) =>
  withBusy(ct("saving"), async () => {
    const r = await backendConfigure(server, token);
    // Nouveau serveur : tout ce qui était en cache est à relire.
    state.consoles = null;
    state.lists = {};
    state.details = {};
    return r.error ? ct("error", { error: errorText(r) }) : ct("saved");
  });

export const updateEngine = () =>
  withBusy(ct("updating"), async () => {
    const r = await backendUpdate();
    return r.error ? ct("error", { error: errorText(r) }) : ct("updated", { version: r.data?.version ?? "" });
  });

export const syncSaves = () =>
  withBusy(ct("syncing"), async () => {
    const r = await backendCall(["synchroniser"]);
    return r.error ? ct("error", { error: errorText(r) }) : ct("synced", { n: r.data?.games?.length ?? 0 });
  });

export const logout = () =>
  withBusy(ct("saving"), async () => {
    const r = await backendCall(["deconnexion"]);
    return r.error ? ct("error", { error: errorText(r) }) : null;
  });

/** Favoris de l'utilisateur (comme le launcher). */
export async function loadFavorites() {
  const r = await backendCall(["favoris"]);
  if (!r.data) return;
  state.favorites = new Set(r.data.romIds ?? []);
  if (!r.data.offline) state.lists = { ...state.lists, favorites: { games: r.data.games ?? [], loading: false } };
  changed();
}

/** Ajoute ou retire un favori ; le bouton change tout de suite, et revient si le serveur refuse. */
export async function toggleFavorite(romId: number, name: string) {
  const on = !state.favorites.has(romId);
  const before = state.favorites;
  state.favorites = new Set(before);
  if (on) state.favorites.add(romId);
  else state.favorites.delete(romId);
  changed();
  const r = await backendCall(["favori", romId, on ? "oui" : "non"]);
  if (r.data) {
    state.favorites = new Set(r.data.romIds ?? []);
    // La liste Favoris se relit à sa prochaine ouverture.
    const { favorites: _, ...rest } = state.lists;
    state.lists = rest;
    toaster.toast({ title: name, body: ct(on ? "favoriteAdded" : "favoriteRemoved") });
  } else {
    state.favorites = before;
    toaster.toast({ title: name, body: ct("error", { error: errorText(r) }) });
  }
  changed();
}

/** Jeux nouveaux déjà ouverts (badge « Nouveau » retiré), comme le launcher : id → date (ms). */
const SEEN_KEY = "nierdeck.seenGames";
const NEW_FOR_MS = 24 * 3600 * 1000;
const seen: Map<number, number> = (() => {
  try {
    return new Map(Object.entries(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}") as Record<string, number>).map(([k, v]) => [Number(k), v]));
  } catch {
    return new Map();
  }
})();

export function markSeen(romId: number) {
  if (seen.has(romId)) return;
  seen.set(romId, Date.now());
  try {
    const keep = [...seen].filter(([, at]) => Date.now() - at < NEW_FOR_MS * 2);
    localStorage.setItem(SEEN_KEY, JSON.stringify(Object.fromEntries(keep)));
  } catch {
    /* tant pis : le badge reviendra jusqu'à la fin de la journée */
  }
}

export const isNewGame = (g: CatGame) => !!g.new && !seen.has(g.id);

/** Le jeu passe-t-il le filtre (matchesKind du launcher) ? */
export function matchesKind(g: CatGame, kind: CatKind): boolean {
  if (kind === "all") return true;
  if (kind === "installed") return g.installed || !!state.progress[g.id];
  return !!g.modes?.[kind];
}

export function setKind(kind: CatKind) {
  state.kind = kind;
  changed();
}

/** Filtre suivant / précédent (L2 / R2), en boucle. */
export function stepKind(delta: number) {
  setKind(CAT_KINDS[(CAT_KINDS.indexOf(state.kind) + delta + CAT_KINDS.length) % CAT_KINDS.length]);
}

/**
 * Badge d'un jeu dans une liste, mêmes règles que les cartes du launcher (Library.tsx :
 * Installation… > Mise à jour disponible > Installé > comment y jouer, playBadge).
 */
export function gameBadge(g: CatGame): string | undefined {
  if (state.progress[g.id]) return ct("badgeInstalling");
  if (g.update) return ct("badgeUpdate");
  if (g.installed) return ct("badgeInstalled");
  // Moteur d'avant les badges : rien de plus à dire.
  if (!g.modes) return undefined;
  if (g.pc) return g.available === false && g.detailsLoaded ? ct("badgeUnavailable") : undefined;
  if (g.modes.recomp && g.modes.emulation) return ct("badgeRecompEmu");
  if (g.modes.recomp) return ct("badgeRecomp");
  if (g.modes.emulation) return ct("badgeEmu");
  if (g.recomp) return ct("badgeUnavailable");
  return ct("badgeNoEmu");
}

/** Abonnement React à l'état du Catalogue. */
export function useCatalogue(): CatState {
  const [, setRev] = useState(0);
  useEffect(() => {
    const l = () => setRev((r) => r + 1);
    listeners.add(l);
    // Launcher ouvert sans état connu (backend pas prêt au chargement) : relu.
    if (!state.status) void loadCatalogue(12);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
}

/** Ouvre une liste de jeux dans l'onglet (null : retour aux consoles). */
export function setOpenList(key: string | null) {
  state.openList = key;
  state.openGame = null;
  changed();
  if (key) void loadList(key);
}

/** Ouvre la page d'un jeu (null : retour à la liste). */
export function setOpenGame(romId: number | null) {
  state.openGame = romId;
  if (romId != null) markSeen(romId);
  state.history = null;
  changed();
  if (romId != null) {
    void loadDetails(romId).then(() => void loadSheet(romId));
  }
}

export async function loadSheet(romId: number, force = false) {
  if (state.sheets[romId] && !force) return;
  state.sheets = { ...state.sheets, [romId]: "loading" };
  changed();
  const d = state.details[romId];
  const console = d && typeof d === "object" && "game" in d ? (d.game?.console ?? "") : "";
  const r = await backendCall(["fiche", romId, console]);
  const sheets = { ...state.sheets };
  if (r.data) sheets[romId] = r.data;
  else delete sheets[romId];
  state.sheets = sheets;
  changed();
}

/** Synchronise la sauvegarde d'un jeu (fiche → Sauvegardes). */
export async function syncGame(romId: number) {
  const r = await backendCall(["synchroniser", romId]);
  toaster.toast({ title: "NieRDeck", body: r.error ? ct("error", { error: errorText(r) }) : ct("synced", { n: r.data?.games?.length ?? 0 }) });
}
