import type { ReactNode } from "react";
import { NIER_CHROME_CSS } from "./chromeStyles";
import { NIER_FONTS_CSS } from "./fonts";
import { nierTokensCss } from "./tokens";
import { NIER_OVERLAY_CSS } from "./overlayStyles";
import { NierEmblem } from "./NierEmblem";

const STYLES = NIER_FONTS_CSS + nierTokensCss(".nier-launch") + NIER_CHROME_CSS + NIER_OVERLAY_CSS;

/**
 * Écran « lancement en cours », posé au-dessus de tout (y compris des pages
 * Steam) : fond flouté, emblème, nom du jeu et barre de progression animée.
 */
export function NierLaunchOverlay({
  heading,
  title,
  closing = false,
  hint,
}: {
  heading: string;
  title: string;
  /** Disparition en fondu. */
  closing?: boolean;
  /** Aide affichée sous la barre (ex. « B : forcer l'arrêt »). */
  hint?: ReactNode;
}) {
  return (
    <div className="nier-launch" data-closing={closing}>
      <style>{STYLES}</style>
      <div className="nier-launch-panel">
        <NierEmblem className="nier-launch-emblem" />
        <div className="nier-launch-text">
          <div className="nier-launch-heading">{heading}</div>
          <div className="nier-launch-title">{title}</div>
          <div className="nier-launch-bar">
            <span />
          </div>
          {hint && <div className="nier-launch-hint">{hint}</div>}
        </div>
      </div>
    </div>
  );
}
