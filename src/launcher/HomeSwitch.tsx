import type { ReactNode } from "react";
import { LauncherPage } from "./LauncherPage";
import { useSettings } from "./settings";

/**
 * Rendu à la place de l'accueil Steam (/library/home), qui est la première
 * page du mode Gaming. Affiche NieRDeck si l'option est activée, sinon
 * l'accueil d'origine.
 */
export function HomeSwitch({ original }: { original: ReactNode }) {
  const [settings, loaded] = useSettings();
  if (!loaded || !settings.replaceHome) return <>{original}</>;
  return <LauncherPage mode="home" />;
}
