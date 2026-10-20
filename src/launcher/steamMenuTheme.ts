// Habille au style NieR deux menus de Steam : le menu principal (bouton STEAM,
// à gauche) et l'accès rapide (bouton ···, à droite).
// Les classes de Steam sont hachées ; @decky/ui les retrouve à l'exécution
// dans les modules de Steam. `gpfocus` est la classe (stable) que Steam pose
// sur l'élément sélectionné à la manette.
import { gamepadDialogClasses, gamepadUIClasses, mainMenuAppRunningClasses, quickAccessMenuClasses } from "@decky/ui";
import { NIER_FONTS_CSS, nierTokensCss } from "../nier-ui";

const STYLE_ID = "nierdeck-menu-theme";

/** `.classe` ou null si Steam ne l'expose pas (changement de version). */
const cls = (map: Record<string, string> | undefined, key: string) => {
  const name = map?.[key];
  return name ? `.${name.split(" ")[0]}` : null;
};
/** Garde seulement les sélecteurs dont toutes les classes existent. */
const rule = (selectors: (string | null)[][], body: string) => {
  const ok = selectors.filter((parts) => parts.every(Boolean)).map((parts) => parts.join(""));
  return ok.length ? `${ok.join(",\n")} {${body}}\n` : "";
};

function buildCss(): string {
  const mm = mainMenuAppRunningClasses as Record<string, string>;
  const qam = quickAccessMenuClasses as Record<string, string>;
  const gd = gamepadDialogClasses as Record<string, string>;
  const ui = gamepadUIClasses as Record<string, string>;

  const mainBox = cls(mm, "NavigationBox");
  const mainColumn = cls(mm, "NavigationColumn");
  const mainItem = cls(mm, "NavigationMenuItem");
  const qamRoot = cls(qam, "Container");
  const qamMenu = cls(qam, "Menu");
  const qamTabs = cls(qam, "Tabs");
  const qamTab = cls(qam, "Tab");
  const qamSelected = cls(qam, "Selected");
  const qamTitle = cls(qam, "Title");
  const qamSectionTitle = cls(qam, "PanelSectionTitle");
  const field = cls(gd, "Field");
  const toggleRail = cls(gd, "ToggleRail");
  const toggleSwitch = cls(gd, "ToggleSwitch");
  const toggleOn = cls(gd, "On");
  const mainAnchor = cls(ui, "MainNavMenuAnchor");
  const qamAnchor = cls(ui, "QuickAccessMenuAnchor");

  const panels = [[mainBox], [mainColumn], [qamRoot], [qamMenu]];
  const scopes = [[mainBox], [mainColumn], [mainAnchor], [qamRoot], [qamMenu], [qamAnchor]];
  const scopeSelector = scopes.filter((p) => p.every(Boolean)).map((p) => p.join("")).join(", ");
  if (!scopeSelector) return "";
  const inQam = (...parts: (string | null)[]) => [[qamRoot, " ", ...parts], [qamMenu, " ", ...parts]];

  // Fond beige quadrillé, encre sombre, angles vifs.
  const paper = `
    background-color: var(--nier-bg) !important;
    background-image:
      linear-gradient(to right, var(--nier-grid-line) 1px, transparent 1px),
      linear-gradient(to bottom, var(--nier-grid-line) 1px, transparent 1px) !important;
    background-size: var(--nier-grid-size) var(--nier-grid-size) !important;
    color: var(--nier-low) !important;
    font-family: var(--nier-font) !important;
    letter-spacing: var(--nier-tracking);`;
  const idle = `
    background: var(--nier-high-mid) !important;
    color: var(--nier-low) !important;
    border-radius: 0 !important;
    box-shadow: none !important;`;
  const selected = `
    background: var(--nier-low) !important;
    color: var(--nier-high) !important;
    border-radius: 0 !important;
    box-shadow: var(--nier-drop) var(--nier-drop) 0 var(--nier-shadow) !important;`;

  return [
    NIER_FONTS_CSS,
    nierTokensCss(scopeSelector),
    rule(panels, paper),
    // Le texte suit la couleur de son conteneur (sélectionné ou non).
    rule([[mainBox, " *"], [mainColumn, " *"], [qamRoot, " *"], [qamMenu, " *"]], "color: inherit !important; font-family: inherit !important;"),

    // ---- Menu principal (gauche) ----
    rule([[mainItem]], "color: var(--nier-low) !important; border-radius: 0 !important; transition: background-color var(--nier-fast) linear, color var(--nier-fast) linear;"),
    rule([[mainItem, ".gpfocus"], [mainItem, ":hover"]], selected),

    // ---- Accès rapide (droite) ----
    rule([[qamTabs]], "background: var(--nier-high-mid) !important; border-right: var(--nier-line) solid var(--nier-low) !important;"),
    rule([[qamTab]], "color: var(--nier-low) !important; border-radius: 0 !important;"),
    rule([[qamTab, qamSelected], [qamTab, ".gpfocus"]], selected),
    rule([[qamTitle]], "text-transform: uppercase; letter-spacing: var(--nier-tracking-title) !important; text-shadow: 3px 3px 0 var(--nier-shadow);"),
    rule([[qamSectionTitle]], "border: solid var(--nier-low) !important; border-width: var(--nier-line) 0 !important; padding: 4px 8px !important; letter-spacing: var(--nier-tracking-wide) !important;"),
    rule(inQam(".DialogButton"), idle),
    rule(inQam(".DialogButton.gpfocus"), selected),
    rule(inQam(".DialogButton:hover"), selected),
    rule(inQam(field, ".gpfocus"), "background: var(--nier-mid-trans) !important;"),
    rule(inQam(toggleRail), "background: var(--nier-mid) !important; border-radius: 0 !important;"),
    rule(inQam(toggleOn, " ", toggleRail), "background: var(--nier-low) !important;"),
    rule(inQam(toggleSwitch), "background: var(--nier-high) !important; border-radius: 0 !important;"),
    rule(inQam("hr"), "border-color: var(--nier-mid) !important;"),
  ].join("\n");
}

/** Toutes les fenêtres d'interface de Steam (menu principal et accès rapide peuvent en être séparés). */
function steamDocuments(): Document[] {
  const docs = new Set<Document>();
  const add = (d: any) => {
    try {
      if (d?.documentElement && d.head && typeof d.createElement === "function") docs.add(d);
    } catch {
      /* fenêtre fermée */
    }
  };
  const g: any = globalThis;
  try {
    for (const w of g.SteamUIStore?.WindowStore?.SteamUIWindows ?? []) add(w?.BrowserWindow?.document ?? w?.m_BrowserWindow?.document);
  } catch {
    /* ignore */
  }
  return [...docs];
}

let timer: ReturnType<typeof setInterval> | null = null;
let css = "";

function inject() {
  for (const doc of steamDocuments()) {
    let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = doc.createElement("style");
      style.id = STYLE_ID;
      doc.head.appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
  }
}

/** Active ou retire le thème. Les fenêtres ouvertes plus tard sont prises au passage suivant. */
export function setSteamMenuTheme(on: boolean) {
  if (timer) clearInterval(timer);
  timer = null;
  if (!on) {
    for (const doc of steamDocuments()) doc.getElementById(STYLE_ID)?.remove();
    return;
  }
  try {
    css = buildCss();
  } catch (e) {
    console.error("[NieRDeck] thème des menus", e);
    return;
  }
  inject();
  timer = setInterval(inject, 2000);
}
