// Réglages système de base (onglet Système → Paramètres Steam) : Wi-Fi,
// Bluetooth, mode avion, luminosité. Relevé sur le Deck (débogage CEF) :
//  - Wi-Fi : SystemNetworkStore.isWifiEnabled / SteamClient.System.Network.SetWifiEnabled ;
//  - Bluetooth : réglage client « system_bluetooth_enabled » (settingsStore.clientSettings),
//    écrit comme Steam le fait : SteamClient.Settings.SetSetting(protobuf en base64) ;
//  - mode avion : SteamClient.System.SetAirplaneMode / RegisterForAirplaneModeChanges ;
//  - luminosité : SteamClient.System.Display.SetBrightness (0 à 1) / RegisterForBrightnessChanges.
import { useEffect, useState } from "react";

declare const SteamClient: any;
declare const SystemNetworkStore: any;
declare const settingsStore: any;

export interface SteamSystemState {
  wifi: boolean | null;
  bluetooth: boolean | null;
  airplane: boolean | null;
  /** 0 à 1. */
  brightness: number | null;
}

let airplane: boolean | null = null;
let brightness: number | null = null;
let registered = false;

/** Abonnements Steam (une seule fois) : ils donnent l'état actuel dès l'inscription. */
function ensureRegistered() {
  if (registered) return;
  registered = true;
  try {
    SteamClient?.System?.RegisterForAirplaneModeChanges?.((s: any) => (airplane = !!s?.bEnabled));
  } catch (e) {
    console.error("[NieRDeck] mode avion", e);
  }
  try {
    SteamClient?.System?.Display?.RegisterForBrightnessChanges?.((s: any) => {
      const v = Number(s?.flBrightness);
      if (Number.isFinite(v)) brightness = v;
    });
  } catch (e) {
    console.error("[NieRDeck] luminosité", e);
  }
}

function read(): SteamSystemState {
  let wifi: boolean | null = null;
  let bluetooth: boolean | null = null;
  try {
    wifi = typeof SystemNetworkStore?.isWifiEnabled === "boolean" ? SystemNetworkStore.isWifiEnabled : null;
  } catch {
    /* ignore */
  }
  try {
    const v = settingsStore?.clientSettings?.system_bluetooth_enabled;
    bluetooth = typeof v === "boolean" ? v : null;
  } catch {
    /* ignore */
  }
  return { wifi, bluetooth, airplane, brightness };
}

/** État des réglages, relu chaque demi-seconde tant que `enabled`. */
export function useSteamSystem(enabled: boolean): SteamSystemState {
  const [state, setState] = useState(read);
  useEffect(() => {
    if (!enabled) return;
    ensureRegistered();
    const update = () => setState(read());
    update();
    const iv = setInterval(update, 500);
    return () => clearInterval(iv);
  }, [enabled]);
  return state;
}

export function setWifi(on: boolean) {
  try {
    if (SystemNetworkStore?.SetWifiEnabled) SystemNetworkStore.SetWifiEnabled(on);
    else SteamClient?.System?.Network?.SetWifiEnabled?.(on);
  } catch (e) {
    console.error("[NieRDeck] Wi-Fi", e);
  }
}

export function setAirplaneMode(on: boolean) {
  try {
    SteamClient?.System?.SetAirplaneMode?.(on);
    airplane = on;
  } catch (e) {
    console.error("[NieRDeck] mode avion", e);
  }
}

export function setBrightness(value: number) {
  const v = Math.max(0, Math.min(1, value));
  try {
    SteamClient?.System?.Display?.SetBrightness?.(v);
    brightness = v;
  } catch (e) {
    console.error("[NieRDeck] luminosité", e);
  }
}

// ───────────── Stockage ─────────────
// Les dossiers d'installation de Steam (disque interne, carte SD) avec leur
// capacité et leur espace libre, en octets (relevé : nCapacity, nFreeSpace).

export interface StorageDrive {
  label: string;
  /** Disque interne (non amovible). */
  internal: boolean;
  capacity: number;
  free: number;
}

async function readStorage(): Promise<StorageDrive[]> {
  const folders: any[] = (await SteamClient?.InstallFolder?.GetInstallFolders?.()) ?? [];
  return folders
    .filter((f) => f?.bIsMounted !== false && Number(f?.nCapacity) > 0)
    .map((f) => ({
      label: String(f.strUserLabel || ""),
      internal: !!f.bIsFixed,
      capacity: Number(f.nCapacity),
      free: Number(f.nFreeSpace) || 0,
    }));
}

/** Disques de Steam, relus toutes les 10 s tant que `enabled`. */
export function useStorage(enabled: boolean): StorageDrive[] {
  const [drives, setDrives] = useState<StorageDrive[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const update = () =>
      readStorage()
        .then((d) => alive && setDrives(d))
        .catch((e) => console.error("[NieRDeck] stockage", e));
    update();
    const iv = setInterval(update, 10_000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [enabled]);
  return drives;
}

// Réglage client en protobuf : numéro de champ de system_bluetooth_enabled
// (relevé dans le code de Steam : « system_bluetooth_enabled:{n:24e3, ...readBool} »).
const BLUETOOTH_FIELD = 24000;

function varint(n: number): number[] {
  const out: number[] = [];
  while (n > 0x7f) {
    out.push((n & 0x7f) | 0x80);
    n = Math.floor(n / 128);
  }
  out.push(n);
  return out;
}

export function setBluetooth(on: boolean) {
  try {
    // Clé = numéro de champ × 8 + type 0 (varint), puis la valeur booléenne.
    const bytes = [...varint(BLUETOOTH_FIELD * 8), on ? 1 : 0];
    SteamClient?.Settings?.SetSetting?.(btoa(String.fromCharCode(...bytes)));
  } catch (e) {
    console.error("[NieRDeck] Bluetooth", e);
  }
}
