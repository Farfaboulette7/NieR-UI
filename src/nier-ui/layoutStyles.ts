// Styles du Layout NieR. Injectés via <NierStyles /> plutôt qu'importés en .css :
// le bundler Decky (@decky/rollup) ne gère pas les feuilles CSS, et une chaîne
// fonctionne à l'identique dans n'importe quel autre hôte React.

// Pictogrammes repris de YoRHA-UI-BetterDiscord/assets/extras, utilisés comme
// masques : leur couleur suit donc var(--nier-ink) dans les deux thèmes.
const svg = (s: string) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

const SELECTOR = svg(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 367.705 234.894"><path d="m0 117.447 90.7 90.7 272.151-90.7L90.7 26.747Zm105.983 0a17.3 17.3 0 1 1-17.3-17.3 17.3 17.3 0 0 1 17.3 17.3m234.676 117.448v-27.046h27.046v27.046zm0-207.848V.001h27.046v27.046z"/></svg>'
);

const BORDER = svg(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64.932" height="15.759" viewBox="0 0 64.932 15.759"><line y1="0.5" x2="64.932" y2="0.5" stroke="#000"/><rect x="55.072" y="0.959" width="9.86" height="4.762"/><ellipse cx="23.12" cy="6.041" rx="2.308" ry="2.365"/><ellipse cx="31.809" cy="6.041" rx="2.308" ry="2.365"/><ellipse cx="27.465" cy="13.394" rx="2.308" ry="2.365"/></svg>'
);

export const NIER_LAYOUT_CSS = `
.nier-root {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  background-color: var(--nier-bg);
  background-image:
    linear-gradient(to right, var(--nier-grid-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--nier-grid-line) 1px, transparent 1px);
  background-size: var(--nier-grid-size) var(--nier-grid-size);
  color: var(--nier-text);
  font-family: var(--nier-font);
  font-weight: var(--nier-weight);
  letter-spacing: var(--nier-tracking);
  user-select: none;
}
.nier-root *, .nier-root *::before, .nier-root *::after { box-sizing: border-box; }

/* Vignettage "théâtre" des bords (light.scss) */
.nier-root::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;
  background:
    linear-gradient(to right, rgba(78, 75, 66, 0.2), transparent 30%, transparent 80%, var(--nier-vignette)),
    radial-gradient(transparent 55%, var(--nier-vignette));
}

/* Boutons : reset commun aux onglets et items */
.nier-root button {
  font: inherit;
  letter-spacing: inherit;
  color: inherit;
  border: 0;
  border-radius: 0;
  outline: none;
  margin: 0;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}

/* ---------- En-tête : titre + onglets ---------- */
.nier-header {
  display: flex;
  align-items: flex-end;
  gap: 40px;
  padding: 24px var(--nier-gutter) 10px;
}
.nier-header-status {
  flex-shrink: 0;
  margin-left: auto;
  align-self: center;
}
.nier-title {
  margin: 0;
  min-width: 0;
  /* Un nom de jeu peut être long : une ligne, coupée proprement. */
  padding: 0 4px 4px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 40px;
  font-weight: 400;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: var(--nier-tracking-title);
  text-shadow: 4px 4px 0 var(--nier-shadow);
}
.nier-tabs {
  display: flex;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Remplissage qui balaie de gauche à droite (button:after de yorha-master),
   fait en background-size pour éviter un pseudo-élément de plus. */
.nier-tab,
.nier-menu-item {
  position: relative;
  background-color: var(--nier-high-mid);
  background-image: linear-gradient(var(--nier-low), var(--nier-low));
  background-repeat: no-repeat;
  background-size: 0% 100%;
  color: var(--nier-low);
  transition:
    background-size var(--nier-normal) var(--nier-ease),
    color var(--nier-fast) linear,
    box-shadow var(--nier-fast) linear;
}
.nier-tab {
  min-width: 112px;
  padding: 7px 18px;
  font-size: 19px;
  text-align: center;
}
/* Filets haut/bas qui encadrent l'élément actif */
.nier-tab::before,
.nier-menu-item::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  border: solid var(--nier-low);
  border-width: 0;
  transition: top var(--nier-normal) var(--nier-ease), bottom var(--nier-normal) var(--nier-ease);
  pointer-events: none;
}
.nier-tab[aria-selected="true"],
.nier-tab:focus-visible,
.nier-menu-item[aria-selected="true"],
.nier-menu-item:focus-visible {
  background-size: 100% 100%;
  color: var(--nier-high);
  box-shadow: var(--nier-drop) var(--nier-drop) 0 var(--nier-shadow);
}
.nier-tab[aria-selected="true"]::before,
.nier-menu-item[aria-selected="true"]::before {
  top: -4px;
  bottom: -4px;
  border-width: var(--nier-line) 0;
}

/* Ornement sous l'en-tête (nier_border.svg en frise) */
.nier-rule {
  height: 16px;
  margin: 0 var(--nier-gutter);
  background-color: var(--nier-ink);
  -webkit-mask: ${BORDER} repeat-x left top / auto 16px;
  mask: ${BORDER} repeat-x left top / auto 16px;
  opacity: 0.8;
}

/* ---------- Corps : menu gauche + détail droite ---------- */
.nier-body {
  display: grid;
  grid-template-columns: var(--nier-menu-width) minmax(0, 1fr);
  gap: 40px;
  min-height: 0;
  padding: 18px var(--nier-gutter);
}

.nier-section-title {
  margin: 0 0 14px;
  padding: 4px 14px;
  font-size: 18px;
  font-weight: var(--nier-weight);
  letter-spacing: var(--nier-tracking-wide);
  border: solid var(--nier-low);
  border-width: var(--nier-line) 0;
}

.nier-menu {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.nier-menu-list {
  position: relative; /* référence des offsetTop pour le défilement auto */
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 4px 6px 8px 40px; /* marge gauche : place du curseur */
  list-style: none;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--nier-low) transparent;
}
.nier-menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 9px 14px;
  font-size: 20px;
  text-align: left;
}
/* Petit carré plein à gauche de chaque entrée */
.nier-menu-item-mark {
  flex: none;
  width: 10px;
  height: 10px;
  background-color: currentColor;
}
.nier-menu-item-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.nier-menu-item-badge {
  flex: none;
  font-size: 16px;
  opacity: 0.8;
}
/* Curseur YoRHA (nier-selector.svg) qui oscille devant l'item actif */
.nier-menu-item[aria-selected="true"]::after {
  content: "";
  position: absolute;
  left: -38px;
  top: 50%;
  width: 30px;
  height: 19px;
  background-color: var(--nier-ink);
  -webkit-mask: ${SELECTOR} no-repeat center / contain;
  mask: ${SELECTOR} no-repeat center / contain;
  animation: nier-cursor 1.4s ease-in-out infinite;
}

.nier-detail {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background-color: var(--nier-high-trans);
  box-shadow: var(--nier-drop) var(--nier-drop) 0 var(--nier-shadow);
}
.nier-menu-item[data-muted="true"]:not([aria-selected="true"]) {
  opacity: 0.6;
}
.nier-detail[data-focused="true"] {
  outline: calc(var(--nier-line) * 2) solid var(--nier-low);
  outline-offset: 4px;
}
.nier-menu {
  transition: opacity var(--nier-fast) linear;
}
.nier-body:has(.nier-detail[data-focused="true"]) .nier-menu {
  opacity: 0.5;
}
.nier-detail-header {
  padding: 7px 16px;
  font-size: 20px;
  letter-spacing: var(--nier-tracking-wide);
  background-color: var(--nier-low);
  color: var(--nier-high);
}
.nier-detail-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px;
  animation: nier-detail-in var(--nier-normal) var(--nier-ease);
}

/* ---------- Pied : aides de commandes ---------- */
.nier-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 var(--nier-gutter);
  padding: 10px 0 16px;
  font-size: 16px;
  border-top: var(--nier-line) solid var(--nier-mid);
}
.nier-footer-group {
  display: flex;
  align-items: center;
  gap: 28px;
}

/* ---------- Animations ---------- */
@keyframes nier-cursor {
  0%, 100% { transform: translate(0, -50%); }
  50%      { transform: translate(5px, -50%); }
}
@keyframes nier-detail-in {
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .nier-root *, .nier-root *::before, .nier-root *::after {
    animation: none !important;
    transition: none !important;
  }
}
`;
