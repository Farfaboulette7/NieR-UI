import { useRef, type ReactNode } from "react";
import { NierStage } from "../nier-ui";
import { GamepadRoot, type NierActionHandler } from "./GamepadRoot";
import { useRightScroll } from "./rightScroll";
import { useHiddenSteamChrome } from "./steamChrome";

/**
 * Écran plein écran commun au launcher et à la page de jeu : masque les barres
 * Steam, capte la manette (stick et pavé droits : défilement de la zone de droite) et met la surface 1280 px à l'échelle de l'écran.
 */
export function NierScreen({ zIndex, onAction, children }: { zIndex: number; onAction: NierActionHandler; children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useHiddenSteamChrome(rootRef);
  useRightScroll(rootRef);
  return (
    <div ref={rootRef} data-nierdeck-root="" style={{ position: "fixed", inset: 0, zIndex }}>
      <GamepadRoot onAction={onAction}>
        <NierStage>{children}</NierStage>
      </GamepadRoot>
    </div>
  );
}
