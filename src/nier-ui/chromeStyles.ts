// Styles de la surface mise à l'échelle, de la barre d'état et des aides de boutons.

export const NIER_CHROME_CSS = `
.nier-stage {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.nier-stage-surface {
  transform-origin: 0 0;
}

/* ---------- Barre d'état (heure, batterie) ---------- */
.nier-status {
  display: flex;
  align-items: center;
  gap: 22px;
  font-size: 18px;
  letter-spacing: var(--nier-tracking-wide);
}
.nier-battery {
  display: flex;
  align-items: center;
  gap: 8px;
}
.nier-battery-cell {
  position: relative;
  width: 34px;
  height: 16px;
  padding: 2px;
  border: var(--nier-line) solid currentColor;
}
/* Borne du + */
.nier-battery-cell::after {
  content: "";
  position: absolute;
  right: -5px;
  top: 4px;
  width: 3px;
  height: 6px;
  background-color: currentColor;
}
.nier-battery-fill {
  display: block;
  height: 100%;
  background-color: currentColor;
}
.nier-battery[data-low="true"] {
  color: var(--nier-alert);
}
.nier-battery[data-charging="true"] .nier-battery-fill {
  animation: nier-charge 1.6s ease-in-out infinite;
}
@keyframes nier-charge {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.45; }
}

/* ---------- Aides de boutons ---------- */
.nier-hint {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.nier-hint-glyph {
  display: inline-grid;
  place-items: center;
  min-width: 26px;
  height: 26px;
  padding: 0 6px;
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0;
  background-color: var(--nier-low);
  color: var(--nier-high);
}
.nier-hint-glyph[data-shape="round"] {
  border-radius: 50%;
  padding: 0;
}
.nier-hint-glyph[data-shape="bumper"] {
  border-radius: 8px 8px 2px 2px;
}
.nier-hint-glyph[data-shape="pill"] {
  border-radius: 13px;
  padding: 0 10px;
  font-size: 12px;
  letter-spacing: var(--nier-tracking-wide);
}
`;
