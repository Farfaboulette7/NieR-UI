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

/* ---------- Panneau qui glisse depuis la droite, par-dessus l'écran ---------- */
.nier-slide-over {
  position: absolute;
  inset: 0;
  z-index: 10;
  box-shadow: -10px 0 24px rgba(72, 70, 61, 0.35);
  animation: nier-slide-in 340ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.nier-slide-over[data-closing="true"] {
  pointer-events: none;
  animation: nier-slide-out 280ms cubic-bezier(0.5, 0, 0.8, 0.4) both;
}
@keyframes nier-slide-in {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}
@keyframes nier-slide-out {
  from { transform: translateX(0); }
  to   { transform: translateX(100%); }
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

/* ---------- Morceau en cours (pied de page) ---------- */
.nier-now-playing {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  max-width: 300px;
  padding: 0;
  color: inherit;
  background: none;
}
.nier-now-playing:not(:disabled) {
  cursor: pointer;
}
.nier-now-playing-note {
  flex: none;
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  font-size: 14px;
  background-color: var(--nier-low);
  color: var(--nier-high);
}
.nier-now-playing-slot {
  position: relative;
  width: 230px;
  height: 22px;
}
.nier-now-playing-title,
.nier-now-playing-bar {
  position: absolute;
  inset: 0;
  transition: opacity var(--nier-normal) linear;
}
.nier-now-playing-title {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  line-height: 22px;
}
.nier-now-playing-bar {
  top: 7px;
  bottom: 7px;
  padding: 1px;
  border: var(--nier-line) solid var(--nier-low);
}
.nier-now-playing-fill {
  display: block;
  height: 100%;
  background-color: var(--nier-low);
}
.nier-now-playing [data-visible="false"] {
  opacity: 0;
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
