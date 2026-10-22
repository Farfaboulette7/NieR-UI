// Données de la page d'un jeu : succès (Steam) et fiche du Magasin.
// Comme pour la bibliothèque, tout est défensif : une donnée absente
// donne un panneau vide, jamais une erreur.
import { fetchNoCors } from "@decky/api";
import { useEffect, useState } from "react";
import { steamLanguage, t } from "./i18n";
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
      name: String(a.strName ?? a.name ?? t("achievements")),
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

/** Par jeu et par langue (« 570:french »). */
const storeCache = new Map<string, StoreInfo | null>();

/** Retire le HTML et décode les entités (&amp;, &quot;...). */
const plainText = (html: string) => {
  try {
    return new DOMParser().parseFromString(html, "text/html").documentElement.textContent?.trim() ?? "";
  } catch {
    return html;
  }
};

async function fetchStoreInfo(appid: number, language: string): Promise<StoreInfo | null> {
  const key = `${appid}:${language}`;
  if (storeCache.has(key)) return storeCache.get(key)!;
  const response = await fetchNoCors(`https://store.steampowered.com/api/appdetails?appids=${appid}&l=${language}`);
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
  storeCache.set(key, info);
  return info;
}

/** Fiche du Magasin, chargée seulement quand `enabled` (panneau affiché). null = indisponible. */
export function useStoreInfo(game: SteamGame | null, enabled: boolean): { loading: boolean; info: StoreInfo | null } {
  const language = steamLanguage();
  const key = game ? `${game.appid}:${language}` : "";
  const [state, setState] = useState<{ key: string; info: StoreInfo | null } | null>(null);
  useEffect(() => {
    if (!enabled || !game || game.shortcut || state?.key === key) return;
    let alive = true;
    fetchStoreInfo(game.appid, language)
      .then((info) => alive && setState({ key, info }))
      .catch(() => alive && setState({ key, info: null }));
    return () => {
      alive = false;
    };
  }, [enabled, key]);
  if (!game || game.shortcut) return { loading: false, info: null };
  return { loading: state?.key !== key, info: state?.key === key ? state.info : null };
}

// ───────────── Contacts qui ont joué ─────────────
// Ce que montre la section « Contacts » de l'onglet Activité de Steam :
// SteamClient.Apps.GetFriendsWhoPlay donne leurs SteamID, friendStore leurs
// noms, avatars et statuts (approche de benderthemes, activity.ts).

export interface FriendWhoPlayed {
  id: string;
  name: string;
  avatar?: string;
  online: boolean;
  /** Jeu en cours, s'il joue. */
  game?: string;
  /** Joue à ce jeu en ce moment. */
  playingThis: boolean;
}

const STEAMID64_BASE = BigInt("76561197960265728");

/** SteamID 64 bits en texte, quel que soit le format reçu (objet CSteamID, accountid...). */
function steamId64(value: any): string {
  try {
    const v = value?.ConvertTo64BitString?.() ?? value?.m_ulSteamID ?? value;
    const n = BigInt(String(v));
    return String(n < STEAMID64_BASE ? n + STEAMID64_BASE : n);
  } catch {
    return String(value ?? "");
  }
}

function friendPersonas(): Map<string, any> {
  const out = new Map<string, any>();
  try {
    const fs = (globalThis as any).friendStore;
    for (const f of fs?.allFriends ?? fs?.m_FriendsUIFriendStore?.allFriends ?? []) {
      const p = f?.persona ?? f;
      const id = steamId64(p?.m_steamid ?? p?.steamid ?? f?.steamid);
      if (id) out.set(id, p);
    }
  } catch {
    /* ignore */
  }
  return out;
}

function toFriend(id: string, p: any, appid: number): FriendWhoPlayed {
  const hash = p?.m_strAvatarHash;
  const gameid = Number(p?.m_gameid ?? p?.m_unGamePlayedAppID ?? p?.game_id ?? 0);
  return {
    id,
    name: String(p?.m_strNickname || p?.m_strPlayerName || p?.display_name || p?.name || "Contact"),
    avatar: typeof hash === "string" && /^[0-9a-f]{40}$/i.test(hash) && !/^0+$/.test(hash) ? `https://avatars.steamstatic.com/${hash}_medium.jpg` : undefined,
    online: p?.is_online === true || p?.m_bIsOnline === true || Number(p?.m_ePersonaState ?? 0) > 0,
    game: String(p?.m_strGameName ?? p?.game_name ?? "") || undefined,
    playingThis: gameid === appid,
  };
}

const friendsCache = new Map<number, string[]>();

/** Contacts qui ont joué au jeu (jeux Steam seulement), en train d'y jouer en tête. */
export function useFriendsWhoPlayed(game: SteamGame | null): { loading: boolean; friends: FriendWhoPlayed[] } {
  const appid = game && !game.shortcut ? game.appid : 0;
  const [ids, setIds] = useState<{ appid: number; list: string[] } | null>(null);
  useEffect(() => {
    if (!appid) return;
    const cached = friendsCache.get(appid);
    if (cached) return setIds({ appid, list: cached });
    let alive = true;
    Promise.resolve(SteamClient?.Apps?.GetFriendsWhoPlay?.(appid))
      .then((r: any) => {
        const list = (Array.isArray(r) ? r : []).map(steamId64).filter(Boolean);
        friendsCache.set(appid, list);
        if (alive) setIds({ appid, list });
      })
      .catch(() => alive && setIds({ appid, list: [] }));
    return () => {
      alive = false;
    };
  }, [appid]);
  if (!appid) return { loading: false, friends: [] };
  if (ids?.appid !== appid) return { loading: true, friends: [] };
  const personas = friendPersonas();
  const friends = ids.list
    .map((id) => toFriend(id, personas.get(id), appid))
    // En train d'y jouer, puis en ligne, puis par nom.
    .sort((a, b) => Number(b.playingThis) - Number(a.playingThis) || Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, "fr"));
  return { loading: false, friends };
}
