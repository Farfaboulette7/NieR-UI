// Éléments repris des barres Steam (heure, batterie, aides de boutons),
// redessinés au style YoRHA. Purement visuels : l'hôte fournit les valeurs.

export interface NierBattery {
  /** 0 à 1 */
  level: number;
  charging: boolean;
}

export function NierStatus({ time, battery }: { time: string; battery?: NierBattery | null }) {
  const pct = battery ? Math.round(battery.level * 100) : 0;
  return (
    <div className="nier-status">
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

export type NierButton = "A" | "B" | "X" | "Y" | "L1" | "R1" | "STEAM" | "QAM";

const GLYPH: Record<NierButton, string> = {
  A: "A",
  B: "B",
  X: "X",
  Y: "Y",
  L1: "L1",
  R1: "R1",
  STEAM: "STEAM",
  QAM: "···",
};

const SHAPE: Record<NierButton, "round" | "bumper" | "pill"> = {
  A: "round",
  B: "round",
  X: "round",
  Y: "round",
  L1: "bumper",
  R1: "bumper",
  STEAM: "pill",
  QAM: "pill",
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
      {label}
    </span>
  );
}
