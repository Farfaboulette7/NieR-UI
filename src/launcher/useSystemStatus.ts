import { useEffect, useState } from "react";
import type { NierBattery } from "../nier-ui";

declare const SteamClient: any;

const formatTime = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** Heure (HH:MM), mise à jour à chaque changement de minute. */
export function useClock(): string {
  const [time, setTime] = useState(() => formatTime(new Date()));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const now = new Date();
      setTime(formatTime(now));
      timer = setTimeout(tick, 60_000 - now.getSeconds() * 1000 - now.getMilliseconds() + 50);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);
  return time;
}

/** Batterie lue depuis Steam ; null si indisponible (PC fixe, API absente). */
export function useBattery(): NierBattery | null {
  const [battery, setBattery] = useState<NierBattery | null>(null);
  useEffect(() => {
    let reg: any;
    try {
      reg = SteamClient?.System?.RegisterForBatteryStateChanges?.((st: any) => {
        if (st && st.bHasBattery !== false && typeof st.flLevel === "number") {
          // eACState 2/3 : branché (en charge ou chargé)
          setBattery({ level: st.flLevel, charging: st.eACState === 2 || st.eACState === 3 });
        }
      });
    } catch (e) {
      console.error("[NieRDeck] batterie", e);
    }
    return () => {
      try {
        reg?.unregister?.();
      } catch {
        /* Steam peut déjà l'avoir libéré */
      }
    };
  }, []);
  return battery;
}
