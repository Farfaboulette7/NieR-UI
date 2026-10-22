// Données de la page d'un jeu : succès (Steam) et fiche du Magasin.
// Comme pour la bibliothèque, tout est défensif : une donnée absente
// donne un panneau vide, jamais une erreur.
import { fetchNoCors } from "@decky/api";
import { useEffect, useState } from "react";
import type { SteamGame } from "./steamLibrary";

declare const SteamClient: any;

// ───────────── Succès ─────────────

export interface Achievement {
  id: string;
  name: string;
  description: string;
  achieved: boolean;
  /** Date de déblocage, en secondes Unix (0 = inconnue). */
  unlockedAt: number;
  icon?: string;
}

export interface AchievementState {
  loading: boolean;
  unlocked: number;
  total: number;
  list: Achievement[];
}

/** URL d'icône : complète, ou empreinte Steam à convertir en URL du CDN. */
const iconUrl = (appid: number, value: unknown) => {
  const s = String(value ?? "");
  if (/^(https?:|data:|blob:)/.test(s)) return s;
  if (/^[0-9a-f]{40}$/i.test(s)) return `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${appid}/${s}.jpg`;
  return undefined;
};

/** Progression déjà en cache dans Steam (sans réseau). */
function cachedProgress(appid: number): { unlocked: number; total: number } | null {
  try {
    const cache = (globalThis as any).appAchievementProgressCache;
    const entry = cache?.m_achievementProgress?.mapCache?.get?.(appid) ?? cache?.GetAchievementProgress?.(appid);
    if (entry && Number(entry.total) > 0) return { unlocked: Number(entry.unlocked) || 0, total: Number(entry.total) };
  } catch {
    /* ignore */
  }
  return null;
}

async function fetchAchievements(game: SteamGame): Promise<Achievement[]> {
  const result = await SteamClient?.Apps?.GetMyAchievementsForApp?.(game.gameid);
  const raw = result?.data?.rgAchievements ?? result?.rgAchievements ?? result?.achievements;
  if (!Array.isArray(raw)) return [];
  return raw.map(
    (a: any, i: number): Achievement => ({
      id: String(a.strID ?? a.id ?? i),
      name: String(a.strName ?? a.name ?? "Succès"),
      description: String(a.strDescription ?? a.description ?? ""),
      achieved: !!(a.bAchieved ?? a.achieved),
      unlockedAt: Number(a.rtUnlocked ?? a.unlock_time ?? 0),
      icon: iconUrl(game.appid, a.strImage ?? a.strIconURL ?? a.image),
    }),
  );
}

export function useAchievements(game: SteamGame | null): AchievementState {
  const [list, setList] = useState<Achievement[] | null>(null);
  useEffect(() => {
    setList(null);
    if (!game || game.shortcut) {
      setList([]);
      return;
    }
    let alive = true;
    fetchAchievements(game)
      .then((l) => alive && setList(l))
      .catch(() => alive && setList([]));
    return () => {
      alive = false;
    };
  }, [game?.appid]);

  const items = list ?? [];
  const cached = game ? cachedProgress(game.appid) : null;
  // Débloqués d'abord (les plus récents en tête), puis les restants.
  const sorted = [...items].sort((a, b) => Number(b.achieved) - Number(a.achieved) || b.unlockedAt - a.unlockedAt);
  return {
    loading: list === null,
    unlocked: items.length ? items.filter((a) => a.achieved).length : (cached?.unlocked ?? 0),
    total: items.length || cached?.total || 0,
    list: sorted,
  };
}

// ───────────── Fiche du Magasin Steam ─────────────

export interface StoreInfo {
  description: string;
  genres: string[];
  developers: string[];
  publishers: string[];
  releaseDate: string;
  /** Captures d'écran du Magasin, puis son image d'en-tête. */
  images: string[];
}

const storeCache = new Map<number, StoreInfo | null>();

/** Retire le HTML et décode les entités (&amp;, &quot;...). */
const plainText = (html: string) => {
  try {
    return new DOMParser().parseFromString(html, "text/html").documentElement.textContent?.trim() ?? "";
  } catch {
    return html;
  }
};

async function fetchStoreInfo(appid: number): Promise<StoreInfo | null> {
  if (storeCache.has(appid)) return storeCache.get(appid)!;
  const response = await fetchNoCors(`https://store.steampowered.com/api/appdetails?appids=${appid}&l=french`);
  const json = await response.json();
  const data = json?.[appid]?.success ? json[appid].data : null;
  const info: StoreInfo | null = data
    ? {
        description: plainText(String(data.short_description ?? "")),
        genres: (data.genres ?? []).map((g: any) => String(g.description)),
        developers: (data.developers ?? []).map(String),
        publishers: (data.publishers ?? []).map(String),
        releaseDate: String(data.release_date?.date ?? ""),
        images: [
          ...(data.screenshots ?? []).slice(0, 1).map((sc: any) => String(sc?.path_full ?? "")),
          String(data.header_image ?? ""),
        ].filter(Boolean),
      }
    : null;
  storeCache.set(appid, info);
  return info;
}

/** Fiche du Magasin, chargée seulement quand `enabled` (panneau affiché). null = indisponible. */
export function useStoreInfo(game: SteamGame | null, enabled: boolean): { loading: boolean; info: StoreInfo | null } {
  const [state, setState] = useState<{ appid: number; info: StoreInfo | null } | null>(null);
  useEffect(() => {
    if (!enabled || !game || game.shortcut || state?.appid === game.appid) return;
    let alive = true;
    fetchStoreInfo(game.appid)
      .then((info) => alive && setState({ appid: game.appid, info }))
      .catch(() => alive && setState({ appid: game.appid, info: null }));
    return () => {
      alive = false;
    };
  }, [enabled, game?.appid]);
  if (!game || game.shortcut) return { loading: false, info: null };
  return { loading: state?.appid !== game.appid, info: state?.appid === game.appid ? state.info : null };
}
