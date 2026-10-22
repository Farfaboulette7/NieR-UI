import { useEffect } from "react";
import { NierEmblem } from "./NierEmblem";
import { nierTokensCss } from "./tokens";

// Posée hors de .nier-root : elle porte ses propres variables de thème.
const TOKENS = nierTokensCss(".nier-intro");

/** Durée totale de l'animation d'ouverture (doit suivre overlayStyles.ts). */
const INTRO_MS = 3000;

/**
 * Ouverture du launcher : l'emblème YoRHa apparaît en fondu sur le papier,
 * puis tout s'efface pendant que l'écran derrière se défloute.
 */
export function NierIntro({ title = "YoRHa", onDone }: { title?: string; onDone?: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDone?.(), INTRO_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="nier-intro" aria-hidden="true">
      <style>{TOKENS}</style>
      <div className="nier-intro-mark">
        <NierEmblem className="nier-intro-emblem" />
        <div className="nier-intro-title">{title}</div>
        <div className="nier-intro-rule" />
      </div>
    </div>
  );
}
