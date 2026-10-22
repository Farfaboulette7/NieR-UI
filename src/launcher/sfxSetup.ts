// Installation des bruitages NieR, sans que NieRDeck ne les distribue :
//  1. l'extension Decky « Audio Loader » (boutique Decky), si elle manque ;
//  2. le pack « Decky Automata », téléchargé par Audio Loader lui-même
//     (sa méthode download_theme_from_url, depuis api.deckthemes.com).
// NieRDeck lit ensuite le pack dans ~/homebrew/sounds (voir main.py).
import { fetchNoCors } from "@decky/api";
import { useEffect, useState } from "react";
import { loadMedia } from "./audio";

const AUDIO_LOADER = "Audio Loader";
const STORE_API = "https://plugins.deckbrew.xyz/plugins?query=Audio%20Loader";
const STORE_CDN = "https://cdn.tzatzikiweeb.moe/file/steam-deck-homebrew/versions";
const THEMES_API = "https://api.deckthemes.com/";
/** « Decky Automata » de Levania sur deckthemes.com (sons de NieR:Automata). */
const NIER_PACK_ID = "922621a2-229e-4294-8744-614c382861ca";

/** Types d'installation de Decky : 0 = installer. */
const INSTALL = 0;

export type SfxSetupStep = "idle" | "installingLoader" | "downloadingPack" | "done" | "error";

let step: SfxSetupStep = "idle";
let error = "";
const listeners = new Set<() => void>();
const setStep = (s: SfxSetupStep, e = "") => {
  step = s;
  error = e;
  listeners.forEach((l) => l());
};

const deckyBackend = (): any => (window as any).DeckyBackend;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Audio Loader est installé (et chargé) dans Decky. */
export function hasAudioLoader(): boolean {
  try {
    const plugins: any[] = (window as any).DeckyPluginLoader?.plugins ?? [];
    return plugins.some((p) => String(p?.name ?? "") === AUDIO_LOADER);
  } catch {
    return false;
  }
}

/** Appelle une méthode du backend d'une autre extension Decky. */
async function callPlugin(plugin: string, method: string, ...args: unknown[]): Promise<any> {
  const backend = deckyBackend();
  if (backend?.call) {
    try {
      return await backend.call("loader/call", plugin, method, ...args);
    } catch (e) {
      console.warn("[NieRDeck] loader/call", e);
    }
  }
  // Autre voie : la connexion interne de @decky/api, au nom de l'autre extension.
  const internals = (window as any).__DECKY_SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED_deckyLoaderAPIInit;
  const api = internals?.connect?.(2, plugin) ?? internals?.connect?.(1, plugin);
  if (!api?.call) throw new Error("Decky");
  return api.call(method, ...args);
}

async function installAudioLoader() {
  const response = await fetchNoCors(STORE_API);
  const list: any[] = await response.json();
  const plugin = list.find((p) => p?.name === AUDIO_LOADER);
  const version = plugin?.versions?.[0];
  if (!version?.hash) throw new Error(`${AUDIO_LOADER} introuvable dans la boutique Decky`);
  const url = version.artifact ?? `${STORE_CDN}/${version.hash}.zip`;
  // Decky affiche sa fenêtre de confirmation, puis télécharge et charge l'extension.
  await deckyBackend()?.call?.("utilities/install_plugin", url, AUDIO_LOADER, version.name, version.hash, INSTALL);
  // Attend qu'elle soit chargée (confirmation comprise).
  for (let i = 0; i < 240 && !hasAudioLoader(); i++) await sleep(500);
  if (!hasAudioLoader()) throw new Error(`${AUDIO_LOADER} n'a pas été installé`);
  await sleep(1500); // son backend démarre
}

/** Installe Audio Loader si besoin, puis le pack NieR, et recharge les bruitages de NieRDeck. */
export async function setupNierSounds() {
  if (step === "installingLoader" || step === "downloadingPack") return;
  try {
    if (!hasAudioLoader()) {
      setStep("installingLoader");
      await installAudioLoader();
    }
    setStep("downloadingPack");
    const result = await callPlugin(AUDIO_LOADER, "download_theme_from_url", NIER_PACK_ID, THEMES_API);
    if (result && result.success === false) throw new Error(String(result.message ?? "Audio Loader"));
    // Le pack est extrait dans ~/homebrew/sounds : on le relit jusqu'à le trouver.
    for (let i = 0; i < 20; i++) {
      const media = await loadMedia(true);
      if (media && Object.keys(media.sfx).length) return setStep("done");
      await sleep(1000);
    }
    throw new Error("pack introuvable après téléchargement");
  } catch (e: any) {
    console.error("[NieRDeck] bruitages NieR", e);
    setStep("error", String(e?.message ?? e));
  }
}

export function useSfxSetup(): { step: SfxSetupStep; error: string; loaderInstalled: boolean } {
  const [, setRev] = useState(0);
  useEffect(() => {
    const l = () => setRev((r) => r + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { step, error, loaderInstalled: hasAudioLoader() };
}
