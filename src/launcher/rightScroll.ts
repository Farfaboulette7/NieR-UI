// Défilement de la zone de droite au stick droit et au pavé tactile droit.
// Steam ne transmet ces entrées qu'à ses propres panneaux défilants : on lit
// directement l'état de la manette (SteamClient.Input), comme d'autres plugins.
import { useEffect, type RefObject } from "react";

declare const SteamClient: any;

const STICK_DEADZONE = 6000; // sur ±32767
const STICK_SPEED = 900; // px/s au stick poussé à fond
const PAD_SPEED = 0.03; // px de défilement par unité du pavé (±32767)

/** Zone défilante visible : la dernière ouverte (page de jeu glissée par-dessus le launcher). */
function scrollTarget(root: HTMLElement | null): HTMLElement | null {
  const all = root?.querySelectorAll<HTMLElement>(".nier-detail-content");
  return all && all.length ? all[all.length - 1] : null;
}

export function useRightScroll(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const view: Window = rootRef.current?.ownerDocument?.defaultView ?? window;
    let stick = 0; // -1..1, positif = vers le bas
    let frame = 0;
    let last = 0;
    let pad: number | null = null; // dernière position du doigt sur le pavé droit

    const tick = (now: number) => {
      const el = scrollTarget(rootRef.current);
      if (el && last) el.scrollTop += stick * STICK_SPEED * Math.min(0.05, (now - last) / 1000);
      last = now;
      frame = stick ? view.requestAnimationFrame(tick) : 0;
    };

    const onState = (states: any[]) => {
      const s = Array.isArray(states) ? states[states.length - 1] : states;
      if (!s) return;

      // Stick : vitesse continue, tant qu'il est poussé.
      const y = Number(s.sRightStickY) || 0;
      const next = Math.abs(y) < STICK_DEADZONE ? 0 : -(y - Math.sign(y) * STICK_DEADZONE) / (32767 - STICK_DEADZONE);
      if (next && !stick) {
        last = 0;
        frame = view.requestAnimationFrame(tick);
      }
      stick = next;

      // Pavé : suit le doigt, comme l'écran tactile (glisser vers le haut fait monter le contenu).
      const px = Number(s.sRightPadX) || 0;
      const py = Number(s.sRightPadY) || 0;
      const touching = px !== 0 || py !== 0;
      if (touching && pad !== null) {
        const el = scrollTarget(rootRef.current);
        if (el) el.scrollTop += (py - pad) * PAD_SPEED;
      }
      pad = touching ? py : null;
    };

    let reg: any = null;
    try {
      reg = SteamClient?.Input?.RegisterForControllerStateChanges?.(onState);
    } catch (e) {
      console.error("[NieRDeck] lecture de la manette", e);
    }
    return () => {
      try {
        reg?.unregister?.();
      } catch {
        /* déjà libéré */
      }
      if (frame) view.cancelAnimationFrame(frame);
    };
  }, []);
}
