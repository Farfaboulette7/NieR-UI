// Design tokens YoRHA, extraits de :
//  - YoRHA-UI-BetterDiscord (src/light.scss, src/dark.scss, src/vars/vars.scss)
//  - yorha-master (dist/yorha.css : fond quadrillé, ombres, encres)
// Les variables sont posées sur `.nier-root` (et non `:root`) pour ne jamais
// déborder sur l'interface Steam et rester portables vers d'autres hôtes.

export type NierTheme = "light" | "dark";

export const NIER_TOKENS_CSS = `
.nier-root {
  /* Palette (thème clair = menus du jeu) */
  --nier-high: #dad4bb;          /* beige principal (fond des panneaux) */
  --nier-high-mid: #b7b19c;      /* fond des boutons / items au repos */
  --nier-mid: #979381;           /* lignes secondaires, texte atténué */
  --nier-low: #57544a;           /* encre : texte, remplissage sélection */
  --nier-ink: #48463d;           /* pictogrammes (curseur, ornements) */
  --nier-alert: #cd664d;         /* rouge/orange d'alerte */

  --nier-high-trans: rgba(218, 212, 187, 0.8);
  --nier-low-trans: rgba(87, 84, 74, 0.6);
  --nier-mid-trans: rgba(151, 147, 129, 0.5);
  --nier-alert-trans: rgba(205, 102, 77, 0.7);

  /* Fond tactique quadrillé (yorha-master) */
  --nier-bg: #d1cdb7;
  --nier-grid-line: #ccc8b1;
  --nier-grid-size: 5px;
  --nier-surface: #dcd8c0;
  --nier-shadow: #bab5a1;
  --nier-text: #454138;
  --nier-vignette: rgba(78, 75, 66, 0.4);

  /* Typographie : fine, espacée */
  --nier-font: "nier-ui-sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
  --nier-weight: 300;
  --nier-tracking: 0.03rem;
  --nier-tracking-wide: 0.1rem;
  --nier-tracking-title: 0.5rem;

  /* Formes : angles vifs, ombre portée décalée sans flou (mixin boxify) */
  --nier-drop: 3px;
  --nier-line: 1px;

  /* Mouvement : transitions courtes et nettes */
  --nier-fast: 0.12s;
  --nier-normal: 0.2s;
  --nier-ease: cubic-bezier(0.2, 0, 0, 1);

  /* Mise en page (écran Steam Deck 1280x800) */
  --nier-gutter: 40px;
  --nier-menu-width: 380px;
}

/* Thème sombre (inversion high/low, cf. dark.scss) */
.nier-root[data-nier-theme="dark"] {
  --nier-high: #57544a;
  --nier-high-mid: #6b675b;
  --nier-low: #dad4bb;
  --nier-ink: #dad4bb;
  --nier-high-trans: rgba(87, 84, 74, 0.6);
  --nier-low-trans: rgba(218, 212, 187, 0.8);
  --nier-bg: #3a382f;
  --nier-grid-line: #423f36;
  --nier-surface: #4a473e;
  --nier-shadow: #2c2a24;
  --nier-text: #dad4bb;
  --nier-vignette: rgba(0, 0, 0, 0.5);
}
`;
