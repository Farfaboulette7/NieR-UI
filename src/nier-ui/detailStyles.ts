// Fiche de la zone de détail : visuel, tableau d'infos, description.

export const NIER_DETAIL_CSS = `
.nier-game {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.nier-game-art {
  position: relative;
  aspect-ratio: 460 / 215; /* format "header" des capsules Steam */
  background-color: var(--nier-mid-trans);
  overflow: hidden;
}
.nier-game-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
/* Sans visuel : hachures fines + libellé, comme un écran de données vide */
.nier-game-art[data-empty="true"] {
  display: grid;
  place-items: center;
  background-image: repeating-linear-gradient(
    -45deg,
    transparent 0 6px,
    var(--nier-mid-trans) 6px 7px
  );
  color: var(--nier-mid);
  font-size: 14px;
  letter-spacing: var(--nier-tracking-wide);
  text-transform: uppercase;
}
/* Coins de visée aux quatre angles */
.nier-game-art::before {
  content: "";
  position: absolute;
  inset: 6px;
  pointer-events: none;
  background:
    linear-gradient(var(--nier-low), var(--nier-low)) left top / 14px 1px,
    linear-gradient(var(--nier-low), var(--nier-low)) left top / 1px 14px,
    linear-gradient(var(--nier-low), var(--nier-low)) right top / 14px 1px,
    linear-gradient(var(--nier-low), var(--nier-low)) right top / 1px 14px,
    linear-gradient(var(--nier-low), var(--nier-low)) left bottom / 14px 1px,
    linear-gradient(var(--nier-low), var(--nier-low)) left bottom / 1px 14px,
    linear-gradient(var(--nier-low), var(--nier-low)) right bottom / 14px 1px,
    linear-gradient(var(--nier-low), var(--nier-low)) right bottom / 1px 14px;
  background-repeat: no-repeat;
}

.nier-game-fields {
  display: grid;
  grid-template-columns: auto 1fr;
  margin: 0;
  font-size: 17px;
}
.nier-game-fields dt,
.nier-game-fields dd {
  margin: 0;
  padding: 6px 10px;
  border-bottom: var(--nier-line) solid var(--nier-mid-trans);
}
.nier-game-fields dt {
  color: var(--nier-mid);
  letter-spacing: var(--nier-tracking-wide);
  padding-right: 32px;
}

/* ---------- Succès ---------- */
.nier-ach {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.nier-ach-progress-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 16px;
  letter-spacing: var(--nier-tracking-wide);
}
.nier-ach-progress-bar {
  height: 10px;
  padding: 2px;
  border: var(--nier-line) solid var(--nier-low);
}
.nier-ach-progress-fill {
  height: 100%;
  background-color: var(--nier-low);
}
.nier-ach-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.nier-ach-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 10px;
  border-bottom: var(--nier-line) solid var(--nier-mid-trans);
}
.nier-ach-item[data-achieved="false"] {
  opacity: 0.55;
}
.nier-ach-icon {
  flex: none;
  width: 40px;
  height: 40px;
  background-color: var(--nier-mid-trans);
}
.nier-ach-icon img {
  width: 100%;
  height: 100%;
  display: block;
  filter: sepia(0.35);
}
.nier-ach-item[data-achieved="false"] .nier-ach-icon img {
  filter: grayscale(1);
}
.nier-ach-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.nier-ach-name {
  font-size: 16px;
}
.nier-ach-desc {
  font-size: 14px;
  color: var(--nier-mid);
}
.nier-ach-note {
  flex: none;
  font-size: 13px;
  color: var(--nier-mid);
}

/* ---------- Jauge (volume) ---------- */
.nier-meter + .nier-meter {
  margin-top: 22px;
}
.nier-meter-cells {
  display: flex;
  gap: 6px;
}
.nier-meter-cell {
  flex: 1;
  height: 22px;
  border: var(--nier-line) solid var(--nier-low);
  transition: background-color var(--nier-fast) linear;
}
.nier-meter-cell[data-on="true"] {
  background-color: var(--nier-low);
}

/* ---------- Onde sonore (musique en cours) ---------- */
.nier-wave {
  position: relative;
  height: 120px;
  margin-bottom: 14px;
  border-top: var(--nier-line) solid var(--nier-mid-trans);
  border-bottom: var(--nier-line) solid var(--nier-mid-trans);
}
.nier-wave-image {
  position: absolute;
  inset: 0;
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}
.nier-wave-line {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 2px;
}
.nier-wave-cursor {
  position: absolute;
  top: -6px;
  bottom: -6px;
  width: 2px;
  background-color: var(--nier-ink);
}

.nier-game-description {
  margin: 0;
  font-size: 17px;
  line-height: 1.6;
}
`;
