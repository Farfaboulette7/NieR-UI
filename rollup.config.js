import deckyPlugin from "@decky/rollup";
import { readFileSync } from "node:fs";

// @decky/rollup n'importe que les images. Les polices sont intégrées en data: URL :
// aucune requête HTTP, et elles fonctionnent dans la fenêtre Big Picture.
const inlineFonts = {
  name: "inline-fonts",
  load(id) {
    if (!id.endsWith(".woff2")) return null;
    const b64 = readFileSync(id).toString("base64");
    return `export default "data:font/woff2;base64,${b64}";`;
  },
};

export default deckyPlugin({ plugins: [inlineFonts] });
