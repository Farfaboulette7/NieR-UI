// Lecture de la bibliothèque Steam depuis ses stores internes (collectionStore,
// appStore). Ce n'est pas une API publique : chaque accès est défensif, et en
// cas de changement côté Steam on obtient une liste vide plutôt qu'un plantage.
// Approche reprise de benderthemes (library.ts, steamData.ts).
import { Navigation } from "@decky/ui";
import { toaster } from "@decky/api";
import { useEffect, useState } from "react";

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

function toGame(a: any): SteamGame | null {
  if (!a || (a.app_type !== APP_TYPE_GAME && a.app_type !== APP_TYPE_SHORTCUT)) return null;
  const shortcut = a.app_type === APP_TYPE_SHORTCUT;
  const name = String(a.display_name ?? a.sort_as ?? a.appid);
  return {
    appid: Number(a.appid),
    gameid: String(a.m_gameid ?? a.gameid ?? a.appid),
    name,
    sortName: String(a.sort_as ?? name),
    playtime: Math.round(firstPositive(a.minutes_playtime_forever, a.minutes_playtime_forever_local)),
    lastPlayed: firstPositive(a.rt_last_time_played, a.rt_last_time_locally_played),
    installed: shortcut || !!(a.installed ?? a.local_per_client_data?.installed),
    sizeOnDisk: firstPositive(a.size_on_disk, a.local_per_client_data?.size_on_disk),
    banners: [
      ...appStoreUrls(["GetCustomLandcapeImageURLs", "GetCustomLandscapeImageURLs"], a),
      ...appStoreUrls(["GetLandscapeImageURLForApp", "GetCachedLandscapeImageURLForApp"], a),
      ...(shortcut ? [] : [`${CDN}/${a.appid}/header.jpg`]),
    ],
  };
}

const isHidden = (a: any, hidden: Set<number>) => hidden.has(Number(a?.appid)) || a?.visible_in_game_list === false;

function appsOf(collection: any): any[] {
  return collection?.allApps ?? collection?.visibleApps ?? [];
}

export interface SteamLibrary {
  installed: SteamGame[];
  recent: SteamGame[];
  favorites: SteamGame[];
  /** Message si Steam n'a pas fourni sa bibliothèque. */
  error?: string;
}

const EMPTY: SteamLibrary = { installed: [], recent: [], favorites: [] };

export function readLibrary(): SteamLibrary {
  try {
    const all = collectionStore?.GetCollection?.("type-games") ?? collectionStore?.allGamesCollection;
    if (!all) return { ...EMPTY, error: "Bibliothèque Steam indisponible." };

    const hidden = new Set<number>(appsOf(collectionStore?.GetCollection?.("hidden")).map((a: any) => Number(a?.appid)));
    const toGames = (apps: any[]) => apps.filter((a) => !isHidden(a, hidden)).map(toGame).filter(Boolean) as SteamGame[];
    const byName = (x: SteamGame, y: SteamGame) => x.sortName.localeCompare(y.sortName, "fr", { sensitivity: "base" });

    const games = toGames(appsOf(all));
    return {
      installed: games.filter((g) => g.installed).sort(byName),
      recent: games
        .filter((g) => g.lastPlayed > 0)
        .sort((x, y) => y.lastPlayed - x.lastPlayed)
        .slice(0, 30),
      favorites: toGames(appsOf(collectionStore?.GetCollection?.("favorite"))).sort(byName),
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
    const iv = setInterval(() => setLibrary(readLibrary()), refreshMs);
    return () => clearInterval(iv);
  }, [refreshMs]);
  return library;
}

/** Lance un jeu installé ; sinon ouvre sa page Steam (pour l'installer). */
export function launchGame(game: SteamGame) {
  if (!game.installed) {
    Navigation.Navigate(`/library/app/${game.appid}`);
    return;
  }
  try {
    SteamClient.Apps.RunGame(game.gameid, "", -1, 100);
    toaster.toast({ title: "NieRDeck", body: `Lancement : ${game.name}` });
  } catch (e) {
    console.error("[NieRDeck] lancement", e);
    toaster.toast({ title: "NieRDeck", body: `Impossible de lancer ${game.name}.` });
  }
}

// ───────────── Mise en forme ─────────────

export function formatPlaytime(minutes: number, short = false): string {
  if (minutes <= 0) return short ? "—" : "Jamais joué";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return short || m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

export function formatLastPlayed(seconds: number): string {
  if (seconds <= 0) return "Jamais";
  const date = new Date(seconds * 1000);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} jours`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function formatSize(bytes: number): string {
  if (bytes <= 0) return "—";
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1).replace(".", ",")} Go` : `${Math.round(bytes / 1024 ** 2)} Mo`;
}
