// Éléments repris des barres Steam (heure, batterie, Wi-Fi, Bluetooth, aides de boutons),
// redessinés au style YoRHa. Purement visuels : l'hôte fournit les valeurs.

export interface NierBattery {
  /** 0 à 1 */
  level: number;
  charging: boolean;
}

/** Wi-Fi : coupé, sans réseau, ou connecté avec 0 à 3 arcs allumés. */
export type NierWifi = { state: "off" } | { state: "disconnected" } | { state: "connected"; bars: 0 | 1 | 2 | 3 };
export type NierBluetooth = "off" | "on" | "connected";

function WifiIcon({ wifi }: { wifi: NierWifi }) {
  const lit = wifi.state === "connected" ? wifi.bars : -1;
  // Trois arcs et un point, du centre vers l'extérieur ; les arcs éteints restent en filigrane.
  const arcs = ["M7.2 12.6a4 4 0 0 1 5.6 0", "M4.4 9.8a8 8 0 0 1 11.2 0", "M1.6 7a12 12 0 0 1 16.8 0"];
  return (
    <svg className="nier-status-icon" data-state={wifi.state} viewBox="0 0 20 18" aria-hidden="true">
      <circle cx="10" cy="15.4" r="1.6" fill="currentColor" opacity={wifi.state === "connected" ? 1 : 0.35} />
      {arcs.map((d, i) => (
        <path key={d} d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" opacity={i < lit ? 1 : 0.25} />
      ))}
      {wifi.state !== "connected" && <path d="M3 2 L17 16" stroke="currentColor" strokeWidth="2" />}
    </svg>
  );
}

function BluetoothIcon({ bt }: { bt: NierBluetooth }) {
  return (
    <svg className="nier-status-icon" data-state={bt} viewBox="0 0 14 20" aria-hidden="true">
      <path
        d="M3 6 L11 13 L7 16.5 V3.5 L11 7 L3 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="miter"
        opacity={bt === "off" ? 0.35 : 1}
      />
      {bt === "connected" && (
        <>
          <rect x="0" y="9" width="2" height="2" fill="currentColor" />
          <rect x="12" y="9" width="2" height="2" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

export function NierStatus({
  time,
  battery,
  wifi,
  bluetooth,
}: {
  time: string;
  battery?: NierBattery | null;
  wifi?: NierWifi | null;
  bluetooth?: NierBluetooth | null;
}) {
  const pct = battery ? Math.round(battery.level * 100) : 0;
  return (
    <div className="nier-status">
      {(wifi || bluetooth) && (
        <span className="nier-status-icons">
          {bluetooth && <BluetoothIcon bt={bluetooth} />}
          {wifi && <WifiIcon wifi={wifi} />}
        </span>
      )}
      <span className="nier-status-time">{time}</span>
      {battery && (
        <span className="nier-battery" data-low={pct <= 15 && !battery.charging} data-charging={battery.charging}>
          <span className="nier-battery-cell" aria-hidden="true">
            <span className="nier-battery-fill" style={{ width: `${pct}%` }} />
          </span>
          <span>{pct}%</span>
        </span>
      )}
    </div>
  );
}

export type NierButton = "A" | "B" | "X" | "Y" | "L1" | "R1" | "L2" | "R2" | "STEAM" | "QAM" | "UPDOWN" | "LEFTRIGHT";

const GLYPH: Record<NierButton, string> = {
  A: "A",
  B: "B",
  X: "X",
  Y: "Y",
  L1: "L1",
  R1: "R1",
  L2: "L2",
  R2: "R2",
  STEAM: "STEAM",
  QAM: "···",
  UPDOWN: "↕",
  LEFTRIGHT: "↔",
};

const SHAPE: Record<NierButton, "round" | "bumper" | "pill"> = {
  A: "round",
  B: "round",
  X: "round",
  Y: "round",
  L1: "bumper",
  R1: "bumper",
  L2: "bumper",
  R2: "bumper",
  STEAM: "pill",
  QAM: "pill",
  UPDOWN: "round",
  LEFTRIGHT: "round",
};

export function NierHint({ button, label }: { button: NierButton | NierButton[]; label: string }) {
  const buttons = Array.isArray(button) ? button : [button];
  return (
    <span className="nier-hint">
      {buttons.map((b) => (
        <span key={b} className="nier-hint-glyph" data-shape={SHAPE[b]}>
          {GLYPH[b]}
        </span>
      ))}
      <span className="nier-hint-label">{label}</span>
    </span>
  );
}
