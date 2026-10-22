// Habille au style NieR deux menus de Steam : le menu principal (bouton STEAM,
// à gauche) et l'accès rapide (bouton ···, à droite).
// Ce sont deux fenêtres séparées ("MainMenu_…" et "QuickAccess_…"). Leurs
// classes CSS sont hachées, on s'appuie donc sur des repères stables relevés
// dans leur HTML : identifiants, rôles ARIA, `.DialogButton`, et `gpfocus`
// (posée par Steam sur l'élément sélectionné à la manette).
import {
  appActionButtonClasses,
  appDetailsClasses,
  basicAppDetailsSectionStylerClasses,
  gamepadDialogClasses,
  playSectionClasses,
  quickAccessMenuClasses,
} from "@decky/ui";
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
  const qamHeader = cls(quickAccessMenuClasses as Record<string, string>, "HeaderContainer");
  const toggle = cls(gd, "Toggle");
  const toggleRail = cls(gd, "ToggleRail");
  const toggleSwitch = cls(gd, "ToggleSwitch");
  const toggleOn = cls(gd, "On");
  // Ramène le bleu Steam vers un gris chaud, sans connaître l'élément exact qui le porte.
  const unblue = "filter: grayscale(1) sepia(0.35) !important;";

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
${/* Variables posées à la racine : menus, boîtes de dialogue et pages de jeu en profitent */ ""}
${nierTokensCss(":root")}

/* ---------- Menu principal (STEAM, à gauche) ---------- */
${MAIN} [role="menu"] {${paper} border-right: var(--nier-line) solid var(--nier-low) !important;}
${MAIN} [role="menu"] * {${inherit}}
${MAIN} [role="menuitem"] {
  color: var(--nier-low) !important;
  border-radius: 0 !important;
  transition: background-color var(--nier-fast) linear, color var(--nier-fast) linear;
}
${MAIN} [role="menuitem"].gpfocus,
${MAIN} [role="menuitem"]:hover {${selected}}
/* Barre bleue de l'entrée sélectionnée */
${MAIN} [role="menuitem"]::before,
${MAIN} [role="menuitem"]::after {${unblue}}

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
  /* Fond opaque : le contenu qui défile passe dessous sans se voir à travers le titre */
  background: var(--nier-bg) !important;
  z-index: 3;
  /* Steam ombre ces titres collants pour un fond sombre : remplacé par un filet */
  box-shadow: none !important;
  border-bottom: var(--nier-line) solid var(--nier-low) !important;
}
${QAM} div:has(+ [role="tabpanel"])::before,
${QAM} div:has(+ [role="tabpanel"])::after,
${QAM} [role="tabpanel"] > div[style*="sticky"]::before,
${QAM} [role="tabpanel"] > div[style*="sticky"]::after${qamTitle ? `,\n${QAM} ${qamTitle}::before,\n${QAM} ${qamTitle}::after,\n${QAM} ${qamTitle} *` : ""} {
  box-shadow: none !important;
  background: transparent !important;
}
${QAM} .DialogButton {${idle}}
${QAM} .DialogButton.gpfocus,
${QAM} .DialogButton:hover {${selected}}
${toggleRail ? `${QAM} ${toggleRail} {background: var(--nier-mid) !important; border-radius: 0 !important;}` : ""}
${toggleRail && toggleOn ? `${QAM} ${toggleOn} ${toggleRail} {background: var(--nier-low) !important;}` : ""}
${toggleSwitch ? `${QAM} ${toggleSwitch} {background: var(--nier-high) !important; border-radius: 0 !important;}` : ""}
${qamHeader ? `${QAM} ${qamHeader}, ${QAM} ${qamHeader}::before, ${QAM} ${qamHeader}::after {box-shadow: none !important; background: transparent !important;}` : ""}
${toggle ? `${QAM} ${toggle} {${unblue}}` : ""}
${toggleRail ? `${QAM} ${toggleRail} {${unblue}}` : ""}

${dialogCss(paper, idle, selected, inherit)}
${gamePageCss(paper, idle, selected, inherit)}
`;
}

/** Ne garde que les sélecteurs dont toutes les classes existent, joints par des virgules. */
const selectors = (...list: (string | null)[]) => list.filter(Boolean).join(",\n");

// ---------- Boîtes de dialogue (« Quitter le jeu ? »...) ----------
// Classes globales de Steam, non hachées : DialogContent, DialogHeader, DialogButton...
function dialogCss(paper: string, idle: string, selected: string, inherit: string): string {
  const D = ".ModalOverlayContent";
  return `
/* ---------- Boîtes de dialogue ---------- */
${D}.ModalOverlayBackground {background: rgba(69, 65, 56, 0.55) !important;}
${D} .GenericDialogBase,
${D} .DialogContent {
  ${paper}
  border: var(--nier-line) solid var(--nier-low) !important;
  border-radius: 0 !important;
  box-shadow: var(--nier-drop) var(--nier-drop) 0 var(--nier-shadow) !important;
}
${D} .DialogContent * {${inherit}}
${D} .DialogContent_InnerWidth,
${D} .DialogBody,
${D} .DialogFooter {background: transparent !important;}
${D} .DialogHeader {
  text-transform: uppercase;
  letter-spacing: var(--nier-tracking-title) !important;
  text-shadow: 3px 3px 0 var(--nier-shadow);
  border-bottom: var(--nier-line) solid var(--nier-low) !important;
  padding-bottom: 8px !important;
}
${D} .DialogButton {${idle}}
${D} .DialogButton.gpfocus,
${D} .DialogButton:hover {${selected}}
`;
}

// ---------- Page d'un jeu (/library/app/<id>) ----------
// Classes hachées : leurs vrais noms viennent de @decky/ui (retrouvés dans Steam à l'exécution).
function gamePageCss(paper: string, idle: string, selected: string, inherit: string): string {
  const ad = appDetailsClasses as Record<string, string>;
  const ps = playSectionClasses as Record<string, string>;
  const ab = appActionButtonClasses as Record<string, string>;
  const bas = basicAppDetailsSectionStylerClasses as Record<string, string>;

  // Conteneurs de la page : servent aussi à limiter les règles des onglets à cette page.
  const scopes = [cls(ad, "Container"), cls(bas, "AppDetailsRoot")].filter(Boolean) as string[];
  const inScopes = (inner: string) => scopes.map((s) => `${s} ${inner}`).join(",\n");

  const playBar = selectors(cls(ps, "PlayBar"), cls(ad, "PlayBar"));
  const playButton = selectors(cls(ab, "PlayButton"), cls(ab, "Green"));
  const playButtonFocus = [cls(ab, "PlayButton"), cls(ab, "Green")]
    .filter(Boolean)
    .flatMap((c) => [`${c}.gpfocus`, `${c}.gpfocuswithin`, `${c}:hover`])
    .join(",\n");
  const menuButton = cls(ps, "MenuButton");
  const pageBackground = selectors(cls(ad, "InnerContainer"), cls(ad, "ScrollContainer"), cls(bas, "AppDetailsContent"));

  return `
/* ---------- Page d'un jeu ---------- */
${pageBackground ? `${pageBackground} {${paper}}` : ""}
${playBar ? `${playBar} {${paper} border-top: var(--nier-line) solid var(--nier-low) !important; border-bottom: var(--nier-line) solid var(--nier-low) !important; box-shadow: none !important;}` : ""}
${playBar ? `${playBar.split(",\n").map((s) => `${s} *`).join(",\n")} {${inherit}}` : ""}
${cls(ps, "PlayBarLabel") ? `${cls(ps, "PlayBarLabel")} {color: var(--nier-mid) !important; letter-spacing: var(--nier-tracking-wide) !important;}` : ""}
${cls(ps, "PlayBarDetailLabel") ? `${cls(ps, "PlayBarDetailLabel")} {color: var(--nier-low) !important;}` : ""}
${playButton ? `${playButton} {${idle}}` : ""}
${playButtonFocus ? `${playButtonFocus} {${selected}}` : ""}
${cls(ab, "PlayButtonContainer") ? `${cls(ab, "PlayButtonContainer")} {background: transparent !important; box-shadow: none !important;}` : ""}
${menuButton ? `${menuButton} {${idle}}\n${menuButton}.gpfocus, ${menuButton}:hover {${selected}}` : ""}
${scopes.length ? `${inScopes('[role="tablist"]')} {background: var(--nier-high-mid) !important; border-bottom: var(--nier-line) solid var(--nier-low) !important;}` : ""}
${scopes.length ? `${inScopes('[role="tab"]')} {background: transparent !important; color: var(--nier-low) !important; border-radius: 0 !important; font-family: var(--nier-font) !important;}` : ""}
${scopes.length ? `${inScopes('[role="tab"][aria-selected="true"]')},\n${inScopes('[role="tab"].gpfocus')} {${selected}}` : ""}
${scopes.length ? `${inScopes('[role="tab"] *')} {${inherit}}` : ""}
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
