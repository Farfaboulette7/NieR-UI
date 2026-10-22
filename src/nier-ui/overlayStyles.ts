// Animation d'ouverture (NierIntro) et écran de lancement (NierLaunchOverlay).
export const NIER_OVERLAY_CSS = `
.nier-emblem {
  background-color: currentColor;
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
}

/* ---------- Ouverture du launcher ---------- */
.nier-intro {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  color: var(--nier-low);
  font-family: var(--nier-font);
  pointer-events: none;
  animation: nier-intro-veil 3s ease-in-out forwards;
}
.nier-intro-mark {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  animation: nier-intro-mark 3s ease-in-out forwards;
}
.nier-intro-emblem {
  width: 330px;
  height: 220px;
}
.nier-intro-title {
  font-size: 34px;
  font-weight: 300;
  letter-spacing: 0.5em;
  padding-left: 0.5em;
  animation: nier-intro-title 3s ease-out forwards;
}
.nier-intro-rule {
  width: 0;
  height: var(--nier-line);
  background-color: var(--nier-low);
  animation: nier-intro-rule 3s ease-in-out forwards;
}
/* Papier opaque, puis transparent pendant que le flou s'en va. */
@keyframes nier-intro-veil {
  0%, 50% {
    background-color: var(--nier-bg);
    backdrop-filter: blur(18px);
  }
  100% {
    background-color: transparent;
    backdrop-filter: blur(0);
  }
}
@keyframes nier-intro-mark {
  0%   { opacity: 0; transform: scale(0.94); filter: blur(6px); }
  28%  { opacity: 1; transform: scale(1); filter: blur(0); }
  58%  { opacity: 1; transform: scale(1); filter: blur(0); }
  85%, 100% { opacity: 0; transform: scale(1.03); filter: blur(4px); }
}
@keyframes nier-intro-title {
  0%, 15% { letter-spacing: 1.1em; opacity: 0; }
  45%     { letter-spacing: 0.5em; opacity: 1; }
  100%    { letter-spacing: 0.5em; opacity: 1; }
}
@keyframes nier-intro-rule {
  0%, 20% { width: 0; }
  50%, 100% { width: 280px; }
}

/* ---------- Lancement d'un jeu ---------- */
.nier-launch {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: grid;
  place-items: center;
  font-family: var(--nier-font);
  letter-spacing: var(--nier-tracking);
  color: var(--nier-low);
  background-color: rgba(209, 205, 183, 0.55);
  backdrop-filter: blur(16px) sepia(0.25);
  animation: nier-launch-in 300ms ease-out both;
}
.nier-launch[data-closing="true"] {
  animation: nier-launch-out 400ms ease-in both;
}
.nier-launch-panel {
  display: flex;
  align-items: center;
  gap: 34px;
  min-width: 620px;
  max-width: 80vw;
  padding: 30px 40px;
  background-color: var(--nier-bg);
  background-image:
    linear-gradient(to right, var(--nier-grid-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--nier-grid-line) 1px, transparent 1px);
  background-size: var(--nier-grid-size) var(--nier-grid-size);
  border: var(--nier-line) solid var(--nier-low);
  box-shadow: var(--nier-drop) var(--nier-drop) 0 var(--nier-shadow);
}
.nier-launch-emblem {
  flex: none;
  width: 150px;
  height: 100px;
  animation: nier-launch-pulse 2s ease-in-out infinite;
}
.nier-launch-text {
  flex: 1;
  min-width: 0;
}
.nier-launch-heading {
  font-size: 16px;
  text-transform: uppercase;
  letter-spacing: var(--nier-tracking-title);
  color: var(--nier-mid);
}
.nier-launch-title {
  margin: 6px 0 16px;
  font-size: 30px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nier-launch-bar {
  position: relative;
  height: 8px;
  overflow: hidden;
  border: var(--nier-line) solid var(--nier-low);
}
.nier-launch-bar span {
  position: absolute;
  top: 1px;
  bottom: 1px;
  width: 30%;
  background-color: var(--nier-low);
  animation: nier-launch-bar 1.4s ease-in-out infinite;
}
@keyframes nier-launch-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes nier-launch-out {
  to { opacity: 0; }
}
@keyframes nier-launch-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.55; }
}
@keyframes nier-launch-bar {
  0%   { left: -30%; }
  100% { left: 100%; }
}
`;
