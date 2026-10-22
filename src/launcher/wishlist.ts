// Liste de souhaits du compte Steam, pour l'onglet Boutique.
// IWishlistService donne les appids (liste publique, ou visible par les amis
// selon la confidentialité du profil) ; IStoreBrowseService donne nom, image et prix.
// Requêtes faites par Decky (fetchNoCors), comme la fiche du Magasin.
import { fetchNoCors } from "@decky/api";
import { useEffect, useState } from "react";

declare const App: any;

export interface WishlistItem {
  appid: number;
  name: string;
  images: string[];
  /** Prix formaté, ou « Gratuit », ou "" si inconnu. */
  price: string;
  /** Réduction en %, 0 si aucune. */
  discount: number;
  releaseDate: string;
}

export interface Wishlist {
  loading: boolean;
  items: WishlistItem[];
  error?: string;
}

const API = "https://api.steampowered.com";
const ASSETS = "https://shared.cloudflare.steamstatic.com/store_item_assets/";
const CDN = "https://cdn.cloudflare.steamstatic.com/steam/apps";

const steamId = (): string | null => {
  try {
    const id = App?.m_CurrentUser?.strSteamID;
    return id ? String(id) : null;
  } catch {
    return null;
  }
};

async function getJson(url: string): Promise<any> {
  const response = await fetchNoCors(url);
  if (!response.ok) throw new Error(`Steam a répondu ${response.status}`);
  return response.json();
}

function toItem(appid: number, s: any): WishlistItem {
  const assets = s?.assets;
  const fromAssets = (file?: string) =>
    file && assets?.asset_url_format ? ASSETS + String(assets.asset_url_format).replace("${FILENAME}", file) : "";
  const option = s?.best_purchase_option;
  const released = Number(s?.release?.steam_release_date) || 0;
  return {
    appid,
    name: String(s?.name ?? `App ${appid}`),
    images: [fromAssets(assets?.header), `${CDN}/${appid}/header.jpg`].filter(Boolean),
    price: s?.is_free ? "Gratuit" : String(option?.formatted_final_price ?? ""),
    discount: Number(option?.discount_pct) || 0,
    releaseDate: released
      ? new Date(released * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
      : s?.release?.is_coming_soon
        ? "À venir"
        : "",
  };
}

/** Détails du Magasin, par paquets (l'API accepte une liste d'identifiants). */
async function storeItems(appids: number[]): Promise<Map<number, any>> {
  const out = new Map<number, any>();
  for (let i = 0; i < appids.length; i += 50) {
    const input = {
      ids: appids.slice(i, i + 50).map((appid) => ({ appid })),
      context: { language: "french", country_code: "FR", steam_realm: 1 },
      data_request: { include_basic_info: true, include_assets: true, include_release: true },
    };
    const json = await getJson(`${API}/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`);
    for (const s of json?.response?.store_items ?? []) out.set(Number(s?.appid ?? s?.id), s);
  }
  return out;
}

async function fetchWishlist(): Promise<WishlistItem[]> {
  const id = steamId();
  if (!id) throw new Error("Compte Steam introuvable.");
  const json = await getJson(`${API}/IWishlistService/GetWishlist/v1/?steamid=${id}`);
  const entries: any[] = json?.response?.items ?? [];
  // Ordre de la liste de souhaits : rang choisi par l'utilisateur, puis date d'ajout.
  entries.sort((a, b) => (Number(a?.priority) || 1e9) - (Number(b?.priority) || 1e9) || Number(a?.date_added) - Number(b?.date_added));
  const appids = entries.map((e) => Number(e?.appid)).filter((n) => n > 0);
  let details = new Map<number, any>();
  try {
    details = await storeItems(appids);
  } catch (e) {
    console.error("[NieRDeck] détails de la liste de souhaits", e);
  }
  return appids.map((appid) => toItem(appid, details.get(appid)));
}

let cache: { at: number; items: WishlistItem[] } | null = null;
const CACHE_MS = 10 * 60_000;

/** Liste de souhaits, chargée quand `enabled` (onglet affiché) puis gardée 10 min. */
export function useWishlist(enabled: boolean): Wishlist {
  const [state, setState] = useState<Wishlist>(() => (cache ? { loading: false, items: cache.items } : { loading: true, items: [] }));
  useEffect(() => {
    if (!enabled || (cache && Date.now() - cache.at < CACHE_MS)) return;
    let alive = true;
    fetchWishlist()
      .then((items) => {
        cache = { at: Date.now(), items };
        if (alive) setState({ loading: false, items });
      })
      .catch((e) => alive && setState({ loading: false, items: [], error: String(e?.message ?? e) }));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return state;
}
