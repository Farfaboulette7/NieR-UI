import { callable } from "@decky/api";
import { useEffect, useState } from "react";

export interface NierSettings {
  /** Afficher NieRDeck à la place de l'accueil Steam (donc dès le démarrage du mode Gaming). */
  replaceHome: boolean;
  /** Habiller au style NieR le menu Steam (gauche) et l'accès rapide (droite). */
  themeSteamMenus: boolean;
  /** Remplacer la page d'un jeu Steam par la page NieR. */
  replaceGamePage: boolean;
}

const DEFAULTS: NierSettings = { replaceHome: true, themeSteamMenus: true, replaceGamePage: true };

const backendGet = callable<[], Partial<NierSettings> | null>("get_settings");
const backendSet = callable<[settings: NierSettings], boolean>("set_settings");

let current: NierSettings = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const getSettings = () => current;

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
  return [current, loaded];
}
