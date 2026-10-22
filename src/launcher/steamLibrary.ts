// Lecture de la bibliothèque Steam depuis ses stores internes (collectionStore,
// appStore). Ce n'est pas une API publique : chaque accès est défensif, et en
// cas de changement côté Steam on obtient une liste vide plutôt qu'un plantage.
// Approche reprise de benderthemes (library.ts, steamData.ts).
import { Navigation } from "@decky/ui";
import { toaster } from "@decky/api";
import { useEffect, useState } from "react";
import { locale, t } from "./i18n";
import { endLaunchScreen, startLaunchScreen } from "./LaunchScreen";

declare const collectionStore: any;
declare const appStore: any;
declare const SteamClient: any;

export interface SteamGame {
  appid: number;
  /** Identifiant attendu par RunGame (différent de l'appid pour les raccourcis non-Steam). */
  gameid: string;
  name: string;
  sortName: string;
  /** Minutes jouées. */
  playtime: number;
  /** Dernière session, en secondes Unix (0 = jamais). */
  lastPlayed: number;
  installed: boolean;
  /** Taille sur le disque en octets (0 = inconnue). */
  sizeOnDisk: number;
  /** Bannières 460×215, de la plus fiable à la moins fiable. */
  banners: string[];
  /** Grandes images (« hero ») de la page du jeu. */
  heroes: string[];
  /** Raccourci non-Steam (jeu ajouté à la main, Heroic...). */
  shortcut: boolean;
}

const APP_TYPE_GAME = 1;
const APP_TYPE_SHORTCUT = 1073741824;
const CDN = "https://cdn.cloudflare.steamstatic.com/steam/apps";

/** Premier nombre positif parmi les candidats. */
const firstPositive = (...values: unknown[]) => {
  for (const v of values) {
    const n = typeof v === "string" ? parseFloat(v) : Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
};

/** URLs renvoyées par une méthode d'appStore (les noms varient selon les versions de Steam). */
function appStoreUrls(methods: string[], app: any): string[] {
  for (const m of methods) {
    try {
      const fn = appStore?.[m];
      if (typeof fn !== "function") continue;
      const r = fn.call(appStore, app);
      if (Array.isArray(r) && r.length) return r.filter((u) => typeof u === "string" && u);
      if (typeof r === "string" && r) return [r];
    } catch {
      /* ignore */
    }
  }
  return [];
}

// ───────────── Temps de jeu des jeux non-Steam ─────────────
// Pour les raccourcis (jeux ajoutés à la main, Heroic...), l'aperçu de la
// bibliothèque ne contient pas le temps de jeu : Steam le garde dans les
// « détails » de l'app, chargés seulement quand on ouvre sa page. On les
// demande nous-mêmes, une fois par jeu, et on garde le résultat.
const detailsPlaytime = new Map<number, number>();
const detailsRequested = new Set<number>();

function requestDetailsPlaytime(appid: number) {
  if (detailsRequested.has(appid)) return;
  detailsRequested.add(appid);
  try {
    let reg: any = null;
    const stop = () => {
      try {
        reg?.unregister?.();
      } catch {
        /* déjà libéré */
      }
      reg = null;
    };
    reg = SteamClient?.Apps?.RegisterForAppDetails?.(appid, (details: any) => {
      const minutes = firstPositive(details?.nPlaytimeForever, details?.minutes_playtime_forever);
      if (minutes > 0) {
        detailsPlaytime.set(appid, Math.round(minutes));
        stop();
      }
    });
    setTimeout(stop, 15_000); // pas de réponse : on n'écoute pas indéfiniment
  } catch (e) {
    console.error("[NieRDeck] détails de l'app", appid, e);
  }
}

/** Temps de jeu déjà chargé par Steam (si la page du jeu a été ouverte). */
function storedDetailsPlaytime(appid: number): number {
  try {
    const store = (globalThis as any).appDetailsStore;
    const details = store?.GetAppDetails?.(appid) ?? store?.m_mapAppData?.get?.(appid)?.details;
    return firstPositive(details?.nPlaytimeForever, details?.minutes_playtime_forever);
  } catch {
    return 0;
  }
}

function readPlaytime(a: any, appid: number, shortcut: boolean): number {
  const overview = firstPositive(a.minutes_playtime_forever, a.minutes_playtime_forever_local, a.minutes_playtime_forever_total);
  if (overview > 0) return Math.round(overview);
  const known = detailsPlaytime.get(appid) ?? storedDetailsPlaytime(appid);
  if (known > 0) return Math.round(known);
  // Seulement pour les jeux déjà lancés au moins une fois, pour ne pas interroger Steam pour rien.
  if (shortcut || firstPositive(a.rt_last_time_played, a.rt_last_time_locally_played) > 0) requestDetailsPlaytime(appid);
  return 0;
}

// ───────────── Installé sur ce Deck, ou seulement sur un autre PC ─────────────
// Avec la retransmission (Remote Play), Steam compte comme « installé » un jeu
// présent sur un autre PC du réseau, et liste aussi les raccourcis non-Steam de
// ce PC. Les données de l'aperçu ne suffisent pas à les distinguer : on demande
// à Steam ce qui est vraiment sur le Deck.
//  - jeux Steam : le contenu des dossiers d'installation montés ;
//  - raccourcis non-Steam : ceux du Deck (GetAllShortcuts, comme le plugin SteamGridDB).

interface LocalIndex {
  steam: Set<number>;
  shortcuts: Set<number> | null; // null : API indisponible
}

let localIndex: LocalIndex | null = null;
let localError = "";
let localAsk: Promise<void> | null = null;
let localAt = 0;
const LOCAL_REFRESH_MS = 30_000;

async function readLocalIndex(): Promise<LocalIndex> {
  const steam = new Set<number>();
  const folders: any[] = (await SteamClient?.InstallFolder?.GetInstallFolders?.()) ?? [];
  for (const folder of folders) {
    if (folder?.bIsMounted === false) continue; // carte SD retirée
    for (const app of folder?.vecApps ?? []) steam.add(Number(app?.nAppID));
  }
  let shortcuts: Set<number> | null = null;
  try {
    const list: any[] | undefined = await SteamClient?.Apps?.GetAllShortcuts?.();
    // Liste vide : plutôt une API muette que zéro raccourci, on ne filtre pas.
    if (Array.isArray(list) && list.length) shortcuts = new Set(list.map((s) => Number(s?.appid ?? s?.data?.appid ?? s)));
  } catch {
    shortcuts = null;
  }
  return { steam, shortcuts };
}

/** Relit (au plus toutes les 30 s) ce qui est installé sur le Deck. */
export function refreshLocalIndex(force = false) {
  if (localAsk || (!force && Date.now() - localAt < LOCAL_REFRESH_MS)) return;
  localAsk = readLocalIndex()
    .then((index) => {
      // Dossiers vides alors qu'on avait des jeux : lecture ratée, on garde l'ancienne.
      if (index.steam.size || !localIndex?.steam.size) localIndex = index;
      localAt = Date.now();
    })
    .catch((e) => {
      localError = String(e?.message ?? e);
      console.error("[NieRDeck] jeux installés sur le Deck", e);
    })
    .finally(() => (localAsk = null));
}

/** Pour Système → Diagnostic : ce que NieRDeck sait des jeux présents sur le Deck. */
export function libraryDiagnostic(): { steam: string; shortcuts: string } {
  if (!localIndex) return { steam: localError || "…", shortcuts: localError || "…" };
  return {
    steam: String(localIndex.steam.size),
    shortcuts: localIndex.shortcuts ? String(localIndex.shortcuts.size) : "—",
  };
}

function installedHere(a: any, appid: number, shortcut: boolean): boolean {
  if (shortcut) return localIndex?.shortcuts ? localIndex.shortcuts.has(appid) : true;
  if (localIndex) return localIndex.steam.has(appid);
  return !!(a?.local_per_client_data?.installed ?? a?.installed);
}

function toGame(a: any): SteamGame | null {
  if (!a || (a.app_type !== APP_TYPE_GAME && a.app_type !== APP_TYPE_SHORTCUT)) return null;
  const shortcut = a.app_type === APP_TYPE_SHORTCUT;
  const appid = Number(a.appid);
  const installed = installedHere(a, appid, shortcut);
  // Raccourci non-Steam d'un autre PC : ni installé ici, ni possédé.
  if (shortcut && !installed) return null;
  const name = String(a.display_name ?? a.sort_as ?? a.appid);
  return {
    appid,
    gameid: String(a.m_gameid ?? a.gameid ?? a.appid),
    name,
    sortName: String(a.sort_as ?? name),
    playtime: readPlaytime(a, appid, shortcut),
    lastPlayed: firstPositive(a.rt_last_time_played, a.rt_last_time_locally_played),
    installed,
    sizeOnDisk: firstPositive(a.size_on_disk, a.local_per_client_data?.size_on_disk),
    banners: [
      ...appStoreUrls(["GetCustomLandcapeImageURLs", "GetCustomLandscapeImageURLs"], a),
      ...appStoreUrls(["GetLandscapeImageURLForApp", "GetCachedLandscapeImageURLForApp"], a),
      ...(shortcut ? [] : [`${CDN}/${a.appid}/header.jpg`]),
    ],
    heroes: [
      ...appStoreUrls(["GetCustomHeroImageURLs"], a),
      ...appStoreUrls(["GetHeroImageURLForApp", "GetCachedHeroImageURLForApp"], a),
      ...(shortcut ? [] : [`${CDN}/${a.appid}/library_hero.jpg`]),
    ],
    shortcut,
  };
}

/** Un jeu de la bibliothèque par son identifiant (null s'il est inconnu). */
export function getGame(appid: number): SteamGame | null {
  try {
    return toGame(appStore?.GetAppOverviewByAppID?.(appid));
  } catch {
    return null;
  }
}

const isHidden = (a: any, hidden: Set<number>) => hidden.has(Number(a?.appid)) || a?.visible_in_game_list === false;

function appsOf(collection: any): any[] {
  return collection?.allApps ?? collection?.visibleApps ?? [];
}

export interface SteamCollection {
  id: string;
  name: string;
  games: SteamGame[];
}

export interface SteamLibrary {
  installed: SteamGame[];
  recent: SteamGame[];
  /** Collections du compte (favoris en tête), comme l'onglet Collections de Steam. */
  collections: SteamCollection[];
  /** Message si Steam n'a pas fourni sa bibliothèque. */
  error?: string;
}

const EMPTY: SteamLibrary = { installed: [], recent: [], collections: [] };

export function readLibrary(): SteamLibrary {
  try {
    const all = collectionStore?.GetCollection?.("type-games") ?? collectionStore?.allGamesCollection;
    if (!all) return { ...EMPTY, error: t("libraryUnavailable") };

    const hidden = new Set<number>(appsOf(collectionStore?.GetCollection?.("hidden")).map((a: any) => Number(a?.appid)));
    const toGames = (apps: any[]) => apps.filter((a) => !isHidden(a, hidden)).map(toGame).filter(Boolean) as SteamGame[];
    const byName = (x: SteamGame, y: SteamGame) => x.sortName.localeCompare(y.sortName, locale(), { sensitivity: "base" });

    const games = toGames(appsOf(all));

    // Approche de benderthemes (library.ts) : favoris d'abord, puis les collections de l'utilisateur.
    const collections: SteamCollection[] = [];
    const addCollection = (c: any) => {
      const id = String(c?.id ?? "");
      if (!id || id === "hidden" || collections.some((o) => o.id === id)) return;
      const list = toGames(appsOf(c)).sort(byName);
      if (list.length) collections.push({ id, name: String(c.displayName || id), games: list });
    };
    addCollection(collectionStore?.GetCollection?.("favorite"));
    const user: any[] = [...(collectionStore?.userCollections ?? [])].sort((x: any, y: any) =>
      String(x?.displayName ?? "").localeCompare(String(y?.displayName ?? ""), locale(), { numeric: true, sensitivity: "base" }),
    );
    user.forEach(addCollection);
    return {
      installed: games.filter((g) => g.installed).sort(byName),
      recent: games
        .filter((g) => g.lastPlayed > 0)
        .sort((x, y) => y.lastPlayed - x.lastPlayed)
        .slice(0, 30),
      collections,
    };
  } catch (e) {
    console.error("[NieRDeck] lecture de la bibliothèque", e);
    return { ...EMPTY, error: String(e) };
  }
}

/** Bibliothèque relue régulièrement (installations, sessions de jeu...). */
export function useSteamLibrary(refreshMs = 5000): SteamLibrary {
  const [library, setLibrary] = useState(readLibrary);
  useEffect(() => {
    // Ce qui est installé sur le Deck est relu à part (asynchrone), puis régulièrement.
    refreshLocalIndex(true);
    const iv = setInterval(() => {
      refreshLocalIndex();
      setLibrary(readLibrary());
    }, refreshMs);
    const quick = setTimeout(() => setLibrary(readLibrary()), 800);
    return () => {
      clearInterval(iv);
      clearTimeout(quick);
    };
  }, [refreshMs]);
  return library;
}

/** Ouvre la page d'un jeu dans le Magasin Steam. */
export function openStorePage(appid: number) {
  Navigation.NavigateToSteamWeb(`https://store.steampowered.com/app/${appid}/`);
}

/** Ouvre la page du jeu (la page NieR si elle remplace celle de Steam). */
export function openGamePage(game: SteamGame) {
  Navigation.Navigate(`/library/app/${game.appid}`);
}

/** Lance un jeu installé (l'installation passe par la page Steam d'origine). */
export function launchGame(game: SteamGame) {
  try {
    // Écran « Lancement en cours » jusqu'au démarrage : il cache l'attente et la transition de Steam.
    startLaunchScreen(game.appid, game.gameid, game.name);
    SteamClient.Apps.RunGame(game.gameid, "", -1, 100);
  } catch (e) {
    console.error("[NieRDeck] lancement", e);
    endLaunchScreen();
    toaster.toast({ title: "NieRDeck", body: t("launchFailed", { name: game.name }) });
  }
}

// ───────────── Mise en forme ─────────────

export function formatPlaytime(minutes: number, short = false): string {
  if (minutes <= 0) return short ? "—" : t("neverPlayed");
  if (minutes < 60) return t("minutes", { n: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return short || m === 0 ? t("hours", { h }) : t("hoursMinutes", { h, m: String(m).padStart(2, "0") });
}

export function formatLastPlayed(seconds: number): string {
  if (seconds <= 0) return t("never");
  const date = new Date(seconds * 1000);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (days <= 0) return t("today");
  if (days === 1) return t("yesterday");
  if (days < 7) return t("daysAgo", { n: days });
  return date.toLocaleDateString(locale(), { day: "numeric", month: "long", year: "numeric" });
}

export function formatSize(bytes: number): string {
  if (bytes <= 0) return "—";
  const gb = bytes / 1024 ** 3;
  const decimal = (n: number) => (locale() === "fr-FR" ? n.toFixed(1).replace(".", ",") : n.toFixed(1));
  return gb >= 1 ? t("gigabytes", { n: decimal(gb) }) : t("megabytes", { n: Math.round(bytes / 1024 ** 2) });
}
