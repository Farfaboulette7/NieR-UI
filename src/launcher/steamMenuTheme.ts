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
  gamepadSliderClasses,
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
  const field = cls(gd, "Field");
  // Les lignes qui contiennent un bouton gardent le style du bouton (déjà foncé quand il a le focus).
  const focusedField = field
    ? [`${QAM} ${field}.gpfocus`, `${QAM} ${field}.gpfocuswithin:not(:has(.DialogButton))`].join(",")
    : "";
  const sliderControl = cls(gamepadSliderClasses as Record<string, string>, "SliderControl");
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
${/* Ligne sélectionnée (curseur, toggle...) : le voile blanc de Steam se perd sur le beige → bandeau sombre */ ""}
${field ? `${focusedField} {
  background: var(--nier-low) !important;
  color: var(--nier-high) !important;
  border-radius: 0 !important;
  animation: none !important;
}
${focusedField.split(",").map((s) => `${s} *`).join(",")} {color: var(--nier-high) !important;}
${focusedField.split(",").map((s) => `${s}::before,${s}::after`).join(",")} {background: transparent !important; animation: none !important;}` : ""}
${/* Fonds sombres repérés par tagQamColors (contacts, discussions) : papier légèrement teinté */ ""}
${QAM} [${QAM_TAG}="dark"] {
  background: rgba(183, 177, 156, 0.35) !important;
  box-shadow: none !important;
  color: var(--nier-low) !important;
}
${QAM} [${QAM_TAG}="dark"] *:not(img):not(svg) {color: var(--nier-low) !important;}
${/* Curseurs (luminosité, volume) : sans le bleu, et dans le gris chaud */ ""}
${sliderControl ? `${QAM} ${sliderControl} {${unblue}}` : ""}

${dialogCss(paper, idle, selected, inherit)}

/* ---------- Fenêtre de volume (repérée par watchOsd) ---------- */
[${OSD}="box"] {
  ${paper}
  border: var(--nier-line) solid var(--nier-low) !important;
  border-radius: 0 !important;
  box-shadow: var(--nier-drop) var(--nier-drop) 0 var(--nier-shadow) !important;
}
[${OSD}="box"] * {color: var(--nier-low) !important;}
[${OSD}="track"] {background: var(--nier-high-mid) !important; border-radius: 0 !important; box-shadow: none !important;}
[${OSD}="fill"] {background: var(--nier-low) !important; border-radius: 0 !important; box-shadow: none !important;}
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
/* Zones sombres et barres de progression (installateur de Decky...), repérées par tagDialogColors */
${D} [${TAG}="panel"] {
  background: var(--nier-high-mid) !important;
  border: var(--nier-line) solid var(--nier-low) !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}
${D} [${TAG}="panel"], ${D} [${TAG}="panel"] * {color: var(--nier-low) !important;}
${D} [${TAG}="fill"] {
  background: var(--nier-low) !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}
`;
}

// ---------- Couleurs sombres et bleues restées dans les boîtes de dialogue ----------
// Leurs classes sont hachées et inconnues de @decky/ui : on les repère à leur
// couleur calculée et on les marque d'un attribut, que le CSS habille.
const TAG = "data-nierdeck-dialog";

function parseRgb(color: string): [number, number, number, number] | null {
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b, a = "1"] = m[1].split(/[,\s/]+/).filter(Boolean);
  return [Number(r), Number(g), Number(b), Number(a)];
}

function tagDialogColors(doc: Document) {
  const view = doc.defaultView;
  if (!view) return;
  for (const el of doc.querySelectorAll<HTMLElement>(".ModalOverlayContent .DialogContent *")) {
    if (el.hasAttribute(TAG) || el.closest(".DialogButton")) continue;
    const rgb = parseRgb(view.getComputedStyle(el).backgroundColor);
    if (!rgb || rgb[3] < 0.5) continue;
    const [r, g, b] = rgb;
    if (b > r + 60 && b > g + 20) el.setAttribute(TAG, "fill"); // bleu Steam
    else if (0.299 * r + 0.587 * g + 0.114 * b < 90) el.setAttribute(TAG, "panel"); // fond sombre
  }
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

// ───────────── Accès rapide : fonds sombres restants (onglet Contacts...) ─────────────
// La liste de contacts et ses discussions ont leurs propres fonds sombres et
// dégradés, aux classes inconnues : repérés à leur couleur, puis éclaircis.
const QAM_TAG = "data-nierdeck-qam";
const qamSeen = new WeakSet<Element>();

function tagQamColors(doc: Document) {
  const view = doc.defaultView;
  const root = doc.querySelector(QAM);
  if (!view || !root) return;
  for (const el of root.querySelectorAll("*")) {
    // Élément sélectionné : foncé par notre propre thème, on le reverra plus tard.
    if (qamSeen.has(el) || el.closest(".gpfocus")) continue;
    qamSeen.add(el);
    if (el.closest(".DialogButton, [role=tab], [role=tablist]") || el.tagName === "IMG") continue;
    const style = view.getComputedStyle(el);
    const color = parseRgb(style.backgroundColor);
    const gradient = style.backgroundImage.includes("gradient") ? parseRgb(style.backgroundImage) : null;
    const rgb = color && color[3] >= 0.3 ? color : gradient && gradient[3] >= 0.3 ? gradient : null;
    if (rgb && 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] < 110) el.setAttribute(QAM_TAG, "dark");
  }
}

// ───────────── Fenêtre de volume (et autres petites barres de Steam) ─────────────
// Petite boîte sombre en haut de l'écran avec une barre bleue : ses classes sont
// hachées et inconnues, on la repère donc à ses couleurs quand elle apparaît ou
// change (MutationObserver), puis on la marque pour que le CSS l'habille.
const OSD = "data-nierdeck-osd";
let observed = new WeakSet<Document>();
const observers: MutationObserver[] = [];

const luminance = ([r, g, b]: number[]) => 0.299 * r + 0.587 * g + 0.114 * b;
const isBlue = ([r, g, b]: number[]) => b > r + 60 && b > g + 20;

/** Couleur de fond d'un élément, y compris la première couleur d'un dégradé. */
function backgroundRgb(view: Window, el: Element): [number, number, number, number] | null {
  const style = view.getComputedStyle(el);
  const rgb = parseRgb(style.backgroundColor);
  if (rgb && rgb[3] >= 0.5) return rgb;
  const fromImage = parseRgb(style.backgroundImage);
  return fromImage && fromImage[3] >= 0.5 ? fromImage : null;
}

function tagOsd(doc: Document, root: Element) {
  const view = doc.defaultView;
  // Rien à chercher dans nos propres écrans, ni hors du haut de l'écran.
  if (!view || root.closest(`[${OSD}="box"], [data-nierdeck-root]`)) return;
  const area = root.getBoundingClientRect();
  if (!area.width || area.top > view.innerHeight / 3) return;
  const candidates = [root, ...Array.from(root.querySelectorAll("*")).slice(0, 80)];
  for (const el of candidates) {
    const rgb = backgroundRgb(view, el);
    if (!rgb || !isBlue(rgb)) continue;
    const bar = el.getBoundingClientRect();
    if (bar.height < 2 || bar.height > 16 || bar.width < 4) continue;
    // Boîte sombre englobante, petite et en haut de l'écran.
    let box: Element | null = el.parentElement;
    for (let i = 0; box && i < 6; i++, box = box.parentElement) {
      const bg = backgroundRgb(view, box);
      if (!bg || luminance(bg) >= 90) continue;
      const r = box.getBoundingClientRect();
      if (r.width < view.innerWidth * 0.6 && r.top < view.innerHeight / 3 && r.height < 200) break;
      box = null;
      break;
    }
    // Pas un panneau de page Steam (la page Stockage a aussi une barre bleue), ni une grande boîte.
    if (!box || box.closest(".DialogContent, .DialogContent_InnerWidth, .Panel") || box.querySelectorAll("*").length > 30) continue;
    box.setAttribute(OSD, "box");
    el.setAttribute(OSD, "fill");
    for (const inner of box.querySelectorAll("*")) {
      if (inner === el || inner.hasAttribute(OSD)) continue;
      const bg = backgroundRgb(view, inner);
      if (bg && !isBlue(bg)) inner.setAttribute(OSD, "track");
    }
  }
}

function watchOsd(doc: Document) {
  if (observed.has(doc) || !doc.body) return;
  observed.add(doc);
  let pending = new Set<Element>();
  let scheduled = false;
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "attributes" && (r.target as Element).hasAttribute?.(OSD)) continue;
      // nodeType plutôt qu'instanceof : les éléments viennent d'autres fenêtres.
      if (r.type === "attributes" && r.target.nodeType === 1) pending.add(r.target as Element);
      r.addedNodes.forEach((n) => n.nodeType === 1 && pending.add(n as Element));
    }
    if (scheduled || !pending.size) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      const batch = [...pending].slice(0, 40);
      pending = new Set();
      batch.forEach((el) => {
        try {
          if (el.isConnected) tagOsd(doc, el);
        } catch {
          /* fenêtre fermée */
        }
      });
    }, 120);
  });
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });
  observers.push(observer);
}

function stopWatchingOsd() {
  observers.splice(0).forEach((o) => o.disconnect());
  observed = new WeakSet();
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
      tagDialogColors(doc);
      watchOsd(doc);
      tagQamColors(doc);
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
    for (const doc of steamDocuments()) {
      doc.getElementById(STYLE_ID)?.remove();
      doc.querySelectorAll(`[${TAG}]`).forEach((el) => el.removeAttribute(TAG));
      doc.querySelectorAll(`[${OSD}]`).forEach((el) => el.removeAttribute(OSD));
      doc.querySelectorAll(`[${QAM_TAG}]`).forEach((el) => el.removeAttribute(QAM_TAG));
    }
    stopWatchingOsd();
    return;
  }
  try {
    css = buildCss();
  } catch (e) {
    console.error("[NieRDeck] thème des menus", e);
    return;
  }
  inject();
  timer = setInterval(inject, 700);
}
