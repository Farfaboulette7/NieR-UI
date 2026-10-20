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

.nier-game-description {
  margin: 0;
  font-size: 17px;
  line-height: 1.6;
}
`;
