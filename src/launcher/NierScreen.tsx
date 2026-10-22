import { useRef, type ReactNode } from "react";
import { NierStage } from "../nier-ui";
import { toggleMusicPause, useMusicPresence } from "./audio";
import { GamepadRoot, type NierActionHandler } from "./GamepadRoot";
import { useHiddenSteamChrome } from "./steamChrome";

/**
 * Écran plein écran commun au launcher et à la page de jeu : masque les barres
 * Steam, capte la manette, fait jouer la musique de fond et met la surface 1280 px à l'échelle de l'écran.
 */
export function NierScreen({ zIndex, onAction, children }: { zIndex: number; onAction: NierActionHandler; children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useHiddenSteamChrome(rootRef);
  useMusicPresence(rootRef);
  return (
    <div ref={rootRef} data-nierdeck-root="" style={{ position: "fixed", inset: 0, zIndex }}>
      <GamepadRoot
        onAction={(action, repeat) => {
          // Y : pause / lecture de la musique, sur tous les écrans NieRDeck.
          if (action === "music") {
            if (!repeat) toggleMusicPause();
            return true;
          }
          return onAction(action, repeat);
        }}
      >
        <NierStage>{children}</NierStage>
      </GamepadRoot>
    </div>
  );
}
