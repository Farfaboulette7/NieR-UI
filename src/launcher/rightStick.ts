// Stick droit de la manette, lu dans les messages analogiques de Steam
// (SteamClient.Input.RegisterForControllerAnalogInputMessages, vérifié par CDP), pour tourner
// la boîte 3D d'un jeu. Abonné seulement tant qu'un écran s'en sert.
import { useEffect } from "react";

declare const SteamClient: any;

/** Source analogique du stick droit dans les messages de Steam (2e argument), relevée par CDP
 *  sur le Deck : seule source qui parle pendant qu'on pousse le stick droit. */
const RIGHT_STICK = 47;
/** Degrés de rotation par unité de mouvement. Les valeurs de Steam s'accumulent comme un
 *  curseur (relevé par CDP : ~1 300 unités/s stick à peine poussé, ~10 000 à fond). */
const DEG_PER_UNIT = 0.02;
/** Écart entre deux messages au-delà duquel c'est un saut (reprise), pas un mouvement. */
const MAX_STEP = 2000;

/** Dernière position reçue et mouvement accumulé depuis la dernière lecture. */
let last: { x: number; y: number } | null = null;
const moved = { x: 0, y: 0 };
let users = 0;
let reg: any = null;

function start() {
  try {
    // Steam appelle (manette, source, appuyé, x, y), et non avec une liste d'objets comme le
    // disent les types de @decky/ui (vérifié par CDP). Un message par mouvement, ~500 par seconde.
    reg = SteamClient.Input.RegisterForControllerAnalogInputMessages((_pad: number, source: number, _pressed: boolean, x: number, y: number) => {
      if (source !== RIGHT_STICK) return;
      // Position accumulée (comme un curseur) : seul le mouvement entre deux messages compte.
      if (last && Math.abs(x - last.x) < MAX_STEP && Math.abs(y - last.y) < MAX_STEP) {
        moved.x += x - last.x;
        moved.y += y - last.y;
      }
      last = { x, y };
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
  last = null;
}

/** Rotation (degrés) demandée par le stick droit depuis la dernière lecture, ou null s'il n'a
 *  pas bougé. Gauche-droite : tour ; haut-bas : inclinaison. */
export function readRightStick(): { dry: number; drx: number } | null {
  if (!moved.x && !moved.y) return null;
  const r = { dry: moved.x * DEG_PER_UNIT, drx: -moved.y * DEG_PER_UNIT };
  moved.x = moved.y = 0;
  return r;
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
