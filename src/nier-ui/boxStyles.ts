// Boîte de jeu en 3D (NierBoxArt), reprise de FarfaLauncher (src/components/BoxArt.css).

export const NIER_BOX_CSS = `
.nier-b3 {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  isolation: isolate;
  user-select: none;
}
.nier-b3-scene {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nier-b3-stage {
  position: relative;
  -webkit-transform-style: preserve-3d;
  transform-style: preserve-3d;
  transform: rotateX(var(--rx, -8deg)) rotateY(var(--ry, 28deg));
  will-change: transform;
}
/* Rotation automatique (NierBoxArt) : animations CSS, sans JavaScript à chaque image.
   Tour complet à 21,6°/s (deux fois le launcher, demandé pour le Deck) ; sans dos, oscillation face ↔ tranche. */
@keyframes nier-b3-spin {
  from { transform: rotateX(-8deg) rotateY(28deg); }
  to { transform: rotateX(-8deg) rotateY(388deg); }
}
@keyframes nier-b3-swing {
  from { transform: rotateX(-8deg) rotateY(2deg); }
  to { transform: rotateX(-8deg) rotateY(54deg); }
}
.nier-b3-stage[data-anim="spin"] { animation: nier-b3-spin 16.67s linear infinite; }
.nier-b3-stage[data-anim="swing"] { animation: nier-b3-swing 3s ease-in-out infinite alternate; }
.nier-b3-face {
  position: absolute;
  /* Préfixe indispensable sous WebKit et le CEF de Steam : sinon le dos, peint en
     dernier, recouvre la face avant. */
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  overflow: hidden;
}
.nier-b3-face img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: fill;
  pointer-events: none;
}
/* Ombrage léger pour donner du volume. */
.nier-b3-spine::after,
.nier-b3-back::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.22), rgba(0, 0, 0, 0.08));
  pointer-events: none;
}
/* Dos absent (aperçu de la liste) et tranches du boîtier : plastique clair et brillant. */
.nier-b3-back:not(:has(img)) { background: #d9d9d3; }
.nier-b3-edge {
  --b3-depth: 90deg;
  background:
    linear-gradient(var(--b3-depth), transparent 49%, rgba(70, 70, 66, 0.3) 49.5%, rgba(255, 255, 255, 0.5) 51%, transparent 52%),
    linear-gradient(var(--b3-depth), #aeaea8 0%, #e6e6e0 12%, #f6f6f1 24%, #cfcfc9 46%, #d9d9d3 56%, #f1f1ec 76%, #c4c4be 92%, #a4a49e 100%);
  box-shadow: inset 0 0 2px rgba(60, 60, 56, 0.45);
}
.nier-b3-top { --b3-depth: 180deg; filter: brightness(1.04); }
.nier-b3-bottom { --b3-depth: 180deg; filter: brightness(0.78); }
/* Ombre portée au sol (un filtre sur la scène aplatirait la 3D). */
.nier-b3::after {
  content: "";
  position: absolute;
  left: 18%;
  right: 18%;
  bottom: 3%;
  height: 7%;
  background: radial-gradient(ellipse at center, rgba(40, 38, 33, 0.38), transparent 70%);
  z-index: -1;
}

.nier-box-flat,
.nier-box-cutout {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}
.nier-box-cutout {
  padding: 8px 6px 4px;
  box-sizing: border-box;
  filter: drop-shadow(3px 4px 3px rgba(72, 70, 61, 0.45));
}
.nier-box-wait {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--nier-mid);
  letter-spacing: 0.3em;
}
/* Cadre d'une boîte : plus haut qu'une bannière, sans fond flou. */
.nier-game-art[data-box="true"] { aspect-ratio: auto; height: 300px; }
.nier-game-art[data-box="true"][data-compact="true"] { height: 210px; }
`;
