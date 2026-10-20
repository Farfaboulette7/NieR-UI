// Police libre : Be Vietnam Pro (SIL OFL 1.1, voir fonts/OFL.txt), sous-ensemble latin.
// Déjà retenue en secours par YoRHA-UI-BetterDiscord ; ses graisses fines
// s'approchent de la Rodin des menus du jeu.
// Les .woff2 sont importés comme URL : Vite et webpack le font nativement,
// le build Decky les intègre en data: URL (voir rollup.config.js).
import light from "./fonts/BeVietnamPro-Light.woff2";
import regular from "./fonts/BeVietnamPro-Regular.woff2";

export const NIER_FONT_FAMILY = "nier-ui-sans";

const face = (src: string, weight: number) => `
@font-face {
  font-family: "${NIER_FONT_FAMILY}";
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url("${src}") format("woff2");
}`;

export const NIER_FONTS_CSS = face(light, 300) + face(regular, 400);
