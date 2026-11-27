import { useEffect, useState } from "react";
import { callable } from "@decky/api";
import type { NierBattery, NierBluetooth, NierWifi } from "../nier-ui";

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

/**
 * Wi-Fi lu dans le magasin réseau de Steam (SystemNetworkStore). Seule la force du point
 * d'accès actif est lue. null sans carte Wi-Fi (ou API absente).
 */
function readWifi(): NierWifi | null {
  try {
    const store = (window as any).SystemNetworkStore;
    if (!store?.hasWirelessDevice) return null;
    if (!store.isWifiEnabled) return { state: "off" };
    const aps: any[] = store.wirelessNetworkDevice?.wireless?.aps ?? [];
    const active = aps.find((ap) => ap?.is_active);
    if (!active) return { state: "disconnected" };
    // estrength : 1 (faible) à 4 (excellent) ; 1 = le point seul.
    const bars = Math.max(0, Math.min(3, Number(active.estrength) - 1)) as 0 | 1 | 2 | 3;
    return { state: "connected", bars };
  } catch {
    return null;
  }
}

const sameWifi = (a: NierWifi | null, b: NierWifi | null) => JSON.stringify(a) === JSON.stringify(b);

/** Wi-Fi, relu toutes les 5 s (le magasin de Steam n'a pas d'abonnement simple). */
export function useWifi(): NierWifi | null {
  const [wifi, setWifi] = useState<NierWifi | null>(readWifi);
  useEffect(() => {
    const timer = setInterval(() => setWifi((old) => (sameWifi(old, readWifi()) ? old : readWifi())), 5000);
    return () => clearInterval(timer);
  }, []);
  return wifi;
}

const getBluetooth = callable<[], "absent" | NierBluetooth>("get_bluetooth");

/** Interrupteur Bluetooth de Steam (réglage client, voir steamSystem.ts) ; null si illisible. */
function bluetoothSwitch(): boolean | null {
  try {
    const v = (window as any).settingsStore?.clientSettings?.system_bluetooth_enabled;
    return typeof v === "boolean" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Bluetooth : l'interrupteur de Steam (relu toutes les 3 s), et un appareil connecté ou non,
 * lu dans BlueZ par le backend toutes les 15 s. null sans Bluetooth.
 */
export function useBluetooth(): NierBluetooth | null {
  const [bluez, setBluez] = useState<NierBluetooth | "absent" | null>(null);
  const [on, setOn] = useState(bluetoothSwitch);
  useEffect(() => {
    let alive = true;
    const read = () =>
      getBluetooth()
        .then((s) => alive && setBluez(s))
        .catch(() => alive && setBluez(null));
    void read();
    const slow = setInterval(read, 15_000);
    const fast = setInterval(() => setOn(bluetoothSwitch()), 3000);
    return () => {
      alive = false;
      clearInterval(slow);
      clearInterval(fast);
    };
  }, []);
  if (bluez === "absent") return null;
  if (on === false) return "off";
  if (bluez === "connected") return "connected";
  if (on === true) return "on";
  return bluez;
}
