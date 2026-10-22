// Défilement de la zone de droite au stick droit et au pavé tactile droit.
// Steam ne transmet ces entrées qu'à ses propres panneaux défilants : on lit
// directement la manette (SteamClient.Input), par deux canaux :
//  - l'état brut (RegisterForControllerStateChanges) : stick et pavé droits ;
//  - les messages analogiques de l'interface (RegisterForControllerAnalogInputMessages),
//    en secours si l'état brut n'arrive pas (un seul abonné possible côté Steam).
import { useEffect, useState, type RefObject } from "react";

declare const SteamClient: any;

const STICK_DEADZONE = 6000; // sur ±32767
const STICK_SPEED = 900; // px/s au stick poussé à fond
const PAD_SPEED = 0.03; // px de défilement par unité du pavé (±32767)

// ───── Diagnostic, affiché dans le panneau d'accès rapide ─────
const diag = { states: 0, analog: 0, stickY: 0, actions: new Map<number, string>() };
export function useInputDiagnostic(): string {
  const [text, setText] = useState("");
  useEffect(() => {
    const iv = setInterval(() => {
      const actions = [...diag.actions].map(([a, v]) => `${a}:${v}`).join(" ");
      setText(`états ${diag.states} (stick ${diag.stickY}) · analogique ${diag.analog}${actions ? ` [${actions}]` : ""}`);
    }, 500);
    return () => clearInterval(iv);
  }, []);
  return text;
}

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
    let pending = 0; // reste de défilement < 1 px (scrollTop arrondit)
    let pad: number | null = null; // dernière position du doigt sur le pavé droit
    let lastState = 0; // date du dernier état brut reçu
    let analogStop = 0; // les messages analogiques peuvent s'arrêter sans retour à zéro

    const scrollBy = (px: number) => {
      const el = scrollTarget(rootRef.current);
      if (!el) return;
      pending += px;
      const whole = Math.trunc(pending);
      if (whole) {
        el.scrollTop += whole;
        pending -= whole;
      }
    };

    const tick = (now: number) => {
      if (last) scrollBy(stick * STICK_SPEED * Math.min(0.05, (now - last) / 1000));
      last = now;
      frame = stick ? view.requestAnimationFrame(tick) : 0;
    };

    const setStick = (next: number) => {
      if (next && !stick) {
        last = 0;
        frame = view.requestAnimationFrame(tick);
      }
      stick = next;
    };

    const onStates = (changes: any) => {
      const list: any[] = Array.isArray(changes) ? changes : [changes];
      if (!list.length) return;
      diag.states++;
      lastState = Date.now();
      // Plusieurs manettes possibles (dont virtuelles) : on garde celle qui bouge le plus.
      let y = 0;
      let px = 0;
      let py = 0;
      for (const s of list) {
        const sy = Number(s?.sRightStickY) || 0;
        if (Math.abs(sy) > Math.abs(y)) y = sy;
        const x = Number(s?.sRightPadX) || 0;
        const p = Number(s?.sRightPadY) || 0;
        if (x || p) {
          px = x;
          py = p;
        }
      }
      diag.stickY = y;

      // Stick : vitesse continue tant qu'il est poussé (vers le haut = remonter).
      setStick(Math.abs(y) < STICK_DEADZONE ? 0 : -(y - Math.sign(y) * STICK_DEADZONE) / (32767 - STICK_DEADZONE));

      // Pavé : suit le doigt, comme l'écran tactile.
      const touching = px !== 0 || py !== 0;
      if (touching && pad !== null) scrollBy((py - pad) * PAD_SPEED);
      pad = touching ? py : null;
    };

    const onAnalog = (msgs: any) => {
      const list: any[] = Array.isArray(msgs) ? msgs : [msgs];
      for (const m of list) {
        diag.analog++;
        const action = Number(m?.nA);
        const y = Number(m?.y) || 0;
        diag.actions.set(action, `${(Number(m?.x) || 0).toFixed(2)},${y.toFixed(2)}`);
        // Secours seulement : l'état brut, s'il arrive, est plus précis.
        if (Date.now() - lastState < 500) continue;
        if (Math.abs(y) <= 1) {
          setStick(Math.abs(y) < 0.2 ? 0 : -y);
          clearTimeout(analogStop);
          analogStop = view.setTimeout(() => setStick(0), 200);
        } else {
          scrollBy(-y);
        }
      }
    };

    const regs: any[] = [];
    try {
      regs.push(SteamClient?.Input?.RegisterForControllerStateChanges?.(onStates));
    } catch (e) {
      console.error("[NieRDeck] état de la manette", e);
    }
    try {
      regs.push(SteamClient?.Input?.RegisterForControllerAnalogInputMessages?.(onAnalog));
    } catch (e) {
      console.error("[NieRDeck] entrées analogiques", e);
    }
    return () => {
      for (const reg of regs) {
        try {
          reg?.unregister?.();
        } catch {
          /* déjà libéré */
        }
      }
      if (frame) view.cancelAnimationFrame(frame);
      clearTimeout(analogStop);
    };
  }, []);
}
