import { callable } from "@decky/api";
import { useEffect, useState } from "react";

export interface NierSettings {
  /** Afficher NieRDeck à la place de l'accueil Steam (donc dès le démarrage du mode Gaming). */
  replaceHome: boolean;
  /** Habiller au style NieR le menu Steam (gauche) et l'accès rapide (droite). */
  themeSteamMenus: boolean;
  /** Remplacer la page d'un jeu Steam par la page NieR. */
  replaceGamePage: boolean;
  /** Volume des bruitages, 0 à 100. */
  sfxVolume: number;
  /** Volume de la musique de fond, 0 à 100. */
  musicVolume: number;
  /** Musique de fond activée. */
  musicEnabled: boolean;
  /** Morceaux au hasard (sinon dans l'ordre de l'album). */
  musicShuffle: boolean;
  /** Dernier morceau joué (reprise quand la lecture aléatoire est coupée). */
  musicTrack: string;
}

const DEFAULTS: NierSettings = { replaceHome: true, themeSteamMenus: true, replaceGamePage: true, sfxVolume: 60, musicVolume: 40, musicEnabled: true, musicShuffle: true, musicTrack: "" };

const backendGet = callable<[], Partial<NierSettings> | null>("get_settings");
const backendSet = callable<[settings: NierSettings], boolean>("set_settings");

let current: NierSettings = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

// Pendant une mise à jour, l'accueil et la page de jeu NieR sont rendus à Steam (sans toucher aux
// réglages enregistrés) : l'installateur de Decky reste sinon bloqué.
let suspended = false;
const SUSPENDED: Partial<NierSettings> = { replaceHome: false, replaceGamePage: false };
const effective = () => (suspended ? { ...current, ...SUSPENDED } : current);

export const getSettings = () => effective();

/** Coupe (ou rétablit) le remplacement de l'accueil et de la page de jeu ; le thème reste. */
export function suspendEffects(on: boolean) {
  if (suspended === on) return;
  suspended = on;
  emit();
}

/** Écoute les changements hors de React. Retourne la fonction de désabonnement. */
export function onSettingsChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadSettings() {
  try {
    const saved = await backendGet();
    if (saved) current = { ...DEFAULTS, ...saved };
  } catch (e) {
    console.error("[NieRDeck] lecture des réglages", e);
  } finally {
    loaded = true;
    emit();
  }
}

export function updateSettings(patch: Partial<NierSettings>) {
  current = { ...current, ...patch };
  emit();
  backendSet(current).catch((e) => console.error("[NieRDeck] écriture des réglages", e));
}

/** Réglages courants, et s'ils ont fini de charger. */
export function useSettings(): [NierSettings, boolean] {
  const [, setRev] = useState(0);
  useEffect(() => onSettingsChange(() => setRev((r) => r + 1)), []);
  return [effective(), loaded];
}
