// Adaptateur manette : transforme les événements Steam en actions simples.
// Côté Decky uniquement ; nier-ui ne reçoit que des props.
import { Focusable, GamepadButton, type GamepadEvent } from "@decky/ui";
import { useMemo, useRef, type ReactNode } from "react";

export type NierAction = "up" | "down" | "left" | "right" | "prevTab" | "nextTab" | "confirm" | "back" | "music";

/** Index suivant dans une liste : boucle si `wrap`, sinon s'arrête aux bords. */
export const stepIndex = (index: number, delta: number, length: number, wrap: boolean) => {
  const next = index + delta;
  if (wrap) return (next + length) % length;
  return Math.max(0, Math.min(length - 1, next));
};

/** Retourne true si l'action a été prise en charge (sinon Steam la traite). */
export type NierActionHandler = (action: NierAction, repeat: boolean) => boolean;

const DIRECTIONS: Partial<Record<GamepadButton, NierAction>> = {
  [GamepadButton.DIR_UP]: "up",
  [GamepadButton.DIR_DOWN]: "down",
  [GamepadButton.DIR_LEFT]: "left",
  [GamepadButton.DIR_RIGHT]: "right",
};

const BUTTONS: Partial<Record<GamepadButton, NierAction>> = {
  [GamepadButton.CANCEL]: "back",
  [GamepadButton.BUMPER_LEFT]: "prevTab",
  [GamepadButton.BUMPER_RIGHT]: "nextTab",
  [GamepadButton.OPTIONS]: "music", // Y
};

/**
 * Un seul élément focalisable pour tout le launcher. Le gestionnaire passe par
 * une ref : Focusable peut garder les callbacks de son premier rendu.
 */
export function GamepadRoot({ onAction, children }: { onAction: NierActionHandler; children: ReactNode }) {
  const latest = useRef(onAction);
  latest.current = onAction;

  const handlers = useMemo(() => {
    const fire = (action: NierAction | undefined, e: GamepadEvent) => {
      if (!action) return;
      if (latest.current(action, !!e.detail?.is_repeat)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    return {
      direction: (e: GamepadEvent) => fire(DIRECTIONS[e.detail?.button as GamepadButton], e),
      button: (e: GamepadEvent) => fire(BUTTONS[e.detail?.button as GamepadButton], e),
      ok: (e: GamepadEvent) => fire("confirm", e),
    };
  }, []);

  return (
    <Focusable
      // @ts-ignore autoFocus existe à l'exécution
      autoFocus
      noFocusRing
      onGamepadDirection={handlers.direction}
      onButtonDown={handlers.button}
      onOKButton={handlers.ok}
      style={{ position: "absolute", inset: 0, outline: "none" }}
    >
      {children}
    </Focusable>
  );
}
