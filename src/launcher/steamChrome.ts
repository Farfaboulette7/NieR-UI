// Barres Steam (en-tête : recherche, heure, batterie ; pied : aides de boutons).
// Tant que le launcher est à l'écran, elles sont rendues invisibles : il dessine
// les siennes. Elles sont repérées par leur géométrie (bandes pleine largeur
// collées en haut ou en bas), car les classes CSS de Steam sont hachées et
// changent d'une version à l'autre. Méthode reprise de benderthemes.
import { useEffect, type RefObject } from "react";

const ATTR = "data-nierdeck-hidden";

// Ne jamais toucher au clavier virtuel ni aux menus/dialogues de Steam.
const KEYBOARD = '[class*="eyboard"],[class*="KEYBOARD"],[aria-label*="eyboard"]';
const PROTECTED = `${KEYBOARD},[role="dialog"],[role="menu"]`;

function hide(el: HTMLElement) {
  el.setAttribute(ATTR, JSON.stringify({ value: el.style.getPropertyValue("visibility"), priority: el.style.getPropertyPriority("visibility") }));
  el.style.setProperty("visibility", "hidden", "important");
}

function restoreOne(el: HTMLElement) {
  const prev = JSON.parse(el.getAttribute(ATTR)!) as { value: string; priority: string };
  // Un autre plugin a pu modifier la propriété entre-temps : on ne l'écrase pas.
  if (el.style.getPropertyValue("visibility") === "hidden" && el.style.getPropertyPriority("visibility") === "important") {
    if (prev.value) el.style.setProperty("visibility", prev.value, prev.priority);
    else el.style.removeProperty("visibility");
  }
  el.removeAttribute(ATTR);
}

export function restoreSteamChrome(doc: Document) {
  doc.querySelectorAll<HTMLElement>(`[${ATTR}]`).forEach(restoreOne);
}

function hideSteamChrome(doc: Document, root: HTMLElement) {
  const view = doc.defaultView;
  if (!view) return;
  const W = view.innerWidth || 1280;
  const H = view.innerHeight || 800;
  for (const el of Array.from(doc.querySelectorAll<HTMLElement>("body *"))) {
    if (el.hasAttribute(ATTR) || root.contains(el) || el.contains(root)) continue;
    // Seulement la bande la plus extérieure.
    if (el.parentElement?.closest(`[${ATTR}]`)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < W * 0.8 || r.height < 24 || r.height > 90) continue;
    const atTop = r.top > -4 && r.top <= 2;
    const atBottom = r.bottom >= H - 2 && r.bottom <= H + 4;
    if (!atTop && !atBottom) continue;
    if (el.closest(PROTECTED) || el.querySelector(PROTECTED)) continue;
    hide(el);
  }
}

/**
 * Masque les barres Steam tant que `root` est visible. Le launcher peut rester
 * monté sous une autre page Steam (accueil remplacé) : les barres reviennent
 * alors d'elles-mêmes.
 */
export function useHiddenSteamChrome(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    const doc = root?.ownerDocument;
    const view: any = doc?.defaultView;
    if (!root || !doc || !view) return;

    const keyboardOpen = () => Array.from(doc.querySelectorAll<HTMLElement>(KEYBOARD)).some((k) => k.getClientRects().length > 0);
    const run = () => {
      try {
        if (root.getClientRects().length === 0 || keyboardOpen()) restoreSteamChrome(doc);
        else hideSteamChrome(doc, root);
      } catch (e) {
        console.error("[NieRDeck] barres Steam", e);
      }
    };

    // Steam reconstruit souvent ses barres : on repasse après chaque mutation (regroupées).
    let pending = 0;
    const schedule = (records: MutationRecord[]) => {
      if (records.every((m) => root.contains(m.target))) return; // nos propres mises à jour
      if (!pending) pending = view.setTimeout(() => ((pending = 0), run()), 120);
    };
    const observer = new view.MutationObserver(schedule);
    observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
    run();

    return () => {
      observer.disconnect();
      view.clearTimeout(pending);
      restoreSteamChrome(doc);
    };
  }, [rootRef]);
}
