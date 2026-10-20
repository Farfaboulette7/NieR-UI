// Habille au style NieR deux menus de Steam : le menu principal (bouton STEAM,
// à gauche) et l'accès rapide (bouton ···, à droite).
// Ce sont deux fenêtres séparées ("MainMenu_…" et "QuickAccess_…"). Leurs
// classes CSS sont hachées, on s'appuie donc sur des repères stables relevés
// dans leur HTML : identifiants, rôles ARIA, `.DialogButton`, et `gpfocus`
// (posée par Steam sur l'élément sélectionné à la manette).
import { gamepadDialogClasses, quickAccessMenuClasses } from "@decky/ui";
import { NIER_FONTS_CSS, nierTokensCss } from "../nier-ui";

const STYLE_ID = "nierdeck-menu-theme";
const MAIN = "#MainNavMenuContainer";
const QAM = "#QuickAccess-Menu";

/** `.classe` exposée par @decky/ui, ou null si Steam ne la fournit plus. */
const cls = (map: Record<string, string> | undefined, key: string) => {
  const name = map?.[key];
  return name ? `.${name.split(" ")[0]}` : null;
};

function buildCss(): string {
  const gd = gamepadDialogClasses as Record<string, string>;
  const qamTitle = cls(quickAccessMenuClasses as Record<string, string>, "Title");
  const toggleRail = cls(gd, "ToggleRail");
  const toggleSwitch = cls(gd, "ToggleSwitch");
  const toggleOn = cls(gd, "On");

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
  // Le texte et les icônes (fill="currentColor") suivent leur conteneur.
  const inherit = "color: inherit !important; font-family: inherit !important;";

  return `
${NIER_FONTS_CSS}
${nierTokensCss(`${MAIN}, ${QAM}`)}

/* ---------- Menu principal (STEAM, à gauche) ---------- */
${MAIN} [role="menu"] {${paper} min-height: 100%; border-right: var(--nier-line) solid var(--nier-low) !important;}
${MAIN} [role="menu"] * {${inherit}}
${MAIN} [role="menuitem"] {
  color: var(--nier-low) !important;
  border-radius: 0 !important;
  transition: background-color var(--nier-fast) linear, color var(--nier-fast) linear;
}
${MAIN} [role="menuitem"].gpfocus,
${MAIN} [role="menuitem"]:hover {${selected}}

/* ---------- Accès rapide (···, à droite) ---------- */
${QAM} {${paper}}
${QAM} * {${inherit}}
/* Couches de fond internes de Steam : transparentes pour laisser voir le papier */
${QAM} > div,
${QAM} > div > div,
${QAM} [role="tabpanel"] {background: transparent !important;}
${QAM} [role="tablist"] {
  background: var(--nier-high-mid) !important;
  border-right: var(--nier-line) solid var(--nier-low) !important;
}
${QAM} [role="tab"] {background: transparent !important; color: var(--nier-low) !important; border-radius: 0 !important;}
${QAM} [role="tab"][aria-selected="true"],
${QAM} [role="tab"].gpfocus {${selected}}
/* Titres de section ("Réglages rapides", "Decky"...) */
${QAM} div:has(+ [role="tabpanel"]),
${QAM} [role="tabpanel"] > div[style*="sticky"]${qamTitle ? `,\n${QAM} ${qamTitle}` : ""} {
  text-transform: uppercase;
  letter-spacing: var(--nier-tracking-title) !important;
  text-shadow: 3px 3px 0 var(--nier-shadow);
  background: transparent !important;
}
${QAM} .DialogButton {${idle}}
${QAM} .DialogButton.gpfocus,
${QAM} .DialogButton:hover {${selected}}
${toggleRail ? `${QAM} ${toggleRail} {background: var(--nier-mid) !important; border-radius: 0 !important;}` : ""}
${toggleRail && toggleOn ? `${QAM} ${toggleOn} ${toggleRail} {background: var(--nier-low) !important;}` : ""}
${toggleSwitch ? `${QAM} ${toggleSwitch} {background: var(--nier-high) !important; border-radius: 0 !important;}` : ""}
`;
}

// ───────────── Fenêtres de Steam ─────────────

/** Fenêtres signalées directement (ex. l'accès rapide, où le panneau du plugin est affiché). */
const known = new Set<Document>();
export function registerSteamDocument(doc: Document | null | undefined) {
  if (doc) known.add(doc);
}

function steamDocuments(): Document[] {
  const docs = new Set<Document>();
  const add = (d: any) => {
    try {
      if (d?.documentElement && d.head && typeof d.createElement === "function") docs.add(d);
    } catch {
      /* fenêtre fermée */
    }
  };
  known.forEach(add);
  const g: any = globalThis;
  try {
    for (const w of g.SteamUIStore?.WindowStore?.SteamUIWindows ?? []) add(w?.BrowserWindow?.document ?? w?.m_BrowserWindow?.document);
  } catch {
    /* ignore */
  }
  // Chaque fenêtre navigable à la manette a un arbre de navigation : sa racine mène à son document.
  try {
    const nav = g.GamepadNavTree?.m_context?.m_controller ?? g.FocusNavController;
    const contexts: any[] = [...(nav?.m_rgAllContexts ?? []), nav?.m_ActiveContext, nav?.m_LastActiveContext];
    for (const ctx of contexts) for (const tree of ctx?.m_rgGamepadNavigationTrees ?? []) add(tree?.Root?.Element?.ownerDocument);
  } catch {
    /* ignore */
  }
  return [...docs];
}

// ───────────── Injection ─────────────

let timer: ReturnType<typeof setInterval> | null = null;
let css = "";
let themed: string[] = [];

function inject() {
  const titles: string[] = [];
  for (const doc of steamDocuments()) {
    try {
      let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
      if (!style) {
        style = doc.createElement("style");
        style.id = STYLE_ID;
        doc.head.appendChild(style);
      }
      if (style.textContent !== css) style.textContent = css;
      titles.push((doc.title || "?").replace(/_uid\d+$/, ""));
    } catch {
      known.delete(doc); // fenêtre fermée entre-temps
    }
  }
  themed = titles.sort();
}

/** Noms des fenêtres où le thème est injecté (diagnostic). */
export const themedWindows = () => themed;

/** Active ou retire le thème. Les fenêtres ouvertes plus tard sont prises au passage suivant. */
export function setSteamMenuTheme(on: boolean) {
  if (timer) clearInterval(timer);
  timer = null;
  themed = [];
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
  timer = setInterval(inject, 1500);
}
