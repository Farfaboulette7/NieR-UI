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
  releaseYear: number | null;
  recomp: boolean;
  pc: boolean;
  emulator: string | null;
  installed: boolean;
}

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
const backendInstall = callable<[romId: number, emulator: string], boolean>("catalogue_install");
const backendInstalling = callable<[], number[]>("catalogue_installing");
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
}

const state: CatState = { status: null, consoles: null, openList: null, lists: {}, details: {}, images: {}, progress: {}, shortcuts: {}, busy: null, notice: null };
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
  } catch (e) {
    console.error("[NieRDeck] catalogue", e);
    if (attempt < 12) setTimeout(() => void loadCatalogue(attempt + 1), 5000);
  }
  changed();
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
  if (r.error) {
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
  if (key === "installed") {
    r = await backendCall(["installes"]);
    // Jeux installés : leur état complet ; on garde ce qu'affiche la liste.
    if (r.data) {
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

export async function install(romId: number, emulator = "") {
  state.progress = { ...state.progress, [romId]: { phase: "prepare", done: 0, total: 0 } };
  changed();
  const started = await backendInstall(romId, emulator);
  if (!started) {
    const progress = { ...state.progress };
    delete progress[romId];
    state.progress = progress;
    changed();
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
  changed();
  if (key) void loadList(key);
}
