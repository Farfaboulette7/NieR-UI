// Stick droit de la manette, lu dans les messages analogiques de Steam
// (SteamClient.Input.RegisterForControllerAnalogInputMessages, vérifié par CDP), pour tourner
// la boîte 3D d'un jeu. Abonné seulement tant qu'un écran s'en sert.
import { useEffect } from "react";

declare const SteamClient: any;

/** Source analogique du stick droit dans les messages de Steam (`nA`). */
const RIGHT_STICK = 3;
/** Sans nouveau message depuis ce délai, le stick est revenu au centre. */
const STALE_MS = 150;

const stick = { x: 0, y: 0, at: 0 };
let users = 0;
let reg: any = null;

function start() {
  try {
    reg = SteamClient.Input.RegisterForControllerAnalogInputMessages((msgs: { nA: number; x: number; y: number }[]) => {
      for (const m of msgs) {
        if (m.nA !== RIGHT_STICK) continue;
        stick.x = m.x;
        stick.y = m.y;
        stick.at = performance.now();
      }
    });
    SteamClient.Input.EnableControllerAnalogInputMessages(true);
  } catch (e) {
    console.error("[NieRDeck] stick droit", e);
  }
}

function stop() {
  try {
    SteamClient.Input.EnableControllerAnalogInputMessages(false);
    reg?.unregister?.();
  } catch {
    /* déjà libéré */
  }
  reg = null;
}

/** Position du stick droit (-1…1, y vers le haut positif), ou null au repos. */
export function readRightStick(): { x: number; y: number } | null {
  if (performance.now() - stick.at > STALE_MS) return null;
  return { x: stick.x, y: stick.y };
}

/** Écoute le stick droit tant que le composant est affiché. */
export function useRightStick(on: boolean) {
  useEffect(() => {
    if (!on) return;
    if (users++ === 0) start();
    return () => {
      if (--users === 0) stop();
    };
  }, [on]);
}
