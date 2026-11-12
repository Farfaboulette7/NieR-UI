import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Ref, type RefObject } from "react";
import { NIER_TOKENS_CSS, type NierTheme } from "./tokens";
import { NIER_LAYOUT_CSS } from "./layoutStyles";
import { NIER_FONTS_CSS } from "./fonts";
import { NIER_DETAIL_CSS } from "./detailStyles";
import { NIER_CHROME_CSS } from "./chromeStyles";
import { NIER_OVERLAY_CSS } from "./overlayStyles";

// Aucune dépendance à Decky ici : ce module ne connaît que React.
// La navigation manette est branchée par l'hôte, qui pilote les props.

export interface NierTab {
  id: string;
  label: string;
}

export interface NierMenuItem {
  id: string;
  label: string;
  /** Texte court aligné à droite (compteur, statut...). */
  badge?: string;
  /** Estompé (jeu non installé...). */
  muted?: boolean;
}

export interface NierLayoutProps {
  /** Gros titre en haut à gauche (ex. "MENU", ou le nom d'un jeu). */
  title?: string;
  /** Onglets du haut, masqués s'il n'y en a qu'un (ou aucun). */
  tabs?: NierTab[];
  activeTabId?: string;
  onTabChange?: (id: string) => void;
  /** Contenu aligné à droite de l'en-tête (heure, batterie...). */
  status?: ReactNode;

  /** Titre encadré au-dessus du menu gauche. */
  menuTitle?: string;
  menuItems: NierMenuItem[];
  activeItemId?: string;
  /** Appelé quand un item reçoit le curseur (survol / focus). */
  onItemSelect: (id: string) => void;
  /** Appelé quand un item est validé (clic / bouton A). */
  onItemActivate?: (id: string) => void;

  /** Bandeau sombre au-dessus de la zone de détail. */
  detailTitle?: string;
  /** La zone de droite a la main (défilement) : elle est encadrée, le menu s'estompe. */
  detailFocused?: boolean;
  /** Élément défilant de la zone de droite, pour que l'hôte le fasse défiler. */
  detailRef?: Ref<HTMLDivElement>;
  /** Contenu de la zone de droite (miniature, infos du jeu...). */
  children?: ReactNode;
  /** Aides de commandes, à gauche et à droite du pied de page. */
  footerStart?: ReactNode;
  footer?: ReactNode;

  theme?: NierTheme;
}

/** Injecte police, tokens et styles. Une seule fois par arbre suffit. */
export function NierStyles() {
  return <style>{NIER_FONTS_CSS + NIER_TOKENS_CSS + NIER_LAYOUT_CSS + NIER_DETAIL_CSS + NIER_CHROME_CSS + NIER_OVERLAY_CSS}</style>;
}

interface MenuRowProps {
  item: NierMenuItem;
  selected: boolean;
  onSelect: (id: string) => void;
  onActivate: (id: string) => void;
}

/**
 * Une ligne du menu. Mémorisée : une liste de centaines de jeux ne redessine que
 * les lignes qui changent (ancienne et nouvelle sélection) à chaque déplacement.
 */
const MenuRow = memo(
  function MenuRow({ item, selected, onSelect, onActivate }: MenuRowProps) {
    return (
      <li>
        <button
          type="button"
          role="option"
          className="nier-menu-item"
          aria-selected={selected}
          data-muted={!!item.muted}
          onMouseEnter={() => onSelect(item.id)}
          onFocus={() => onSelect(item.id)}
          onClick={() => onActivate(item.id)}
        >
          <span className="nier-menu-item-mark" aria-hidden="true" />
          <span className="nier-menu-item-label">{item.label}</span>
          {item.badge && <span className="nier-menu-item-badge">{item.badge}</span>}
        </button>
      </li>
    );
  },
  (a, b) =>
    a.selected === b.selected &&
    a.item.id === b.item.id &&
    a.item.label === b.item.label &&
    a.item.badge === b.item.badge &&
    a.item.muted === b.item.muted &&
    a.onSelect === b.onSelect &&
    a.onActivate === b.onActivate,
);

/** Lignes dessinées à la fois dans une longue liste. */
const MENU_WINDOW = 50;
/** En dessous, toute la liste est dessinée. */
const MENU_WINDOW_MIN = 70;
/** Le curseur à moins de tant de lignes d'un bord de la fenêtre : elle se recentre. */
const MENU_WINDOW_MARGIN = 12;

/**
 * Fenêtre de lignes dessinées d'une longue liste (centaines de jeux) : autour du
 * curseur, ou de la zone affichée quand on fait défiler au doigt. Les lignes ont
 * toutes la même hauteur ; l'espace des autres est réservé par deux espaceurs.
 */
function useMenuWindow(listRef: RefObject<HTMLUListElement | null>, count: number, active: number, resetKey?: string) {
  const [start, setStart] = useState(0);
  // Hauteur d'une ligne, écart compris, mesurée sur la liste dessinée.
  const [pitch, setPitch] = useState(52);
  const windowed = count > MENU_WINDOW_MIN;
  const center = (i: number) => Math.max(0, Math.min(count - MENU_WINDOW, i - Math.floor(MENU_WINDOW / 2)));

  // Curseur près d'un bord (ou hors) de la fenêtre : recentrée sur lui.
  useLayoutEffect(() => {
    if (!windowed) return;
    if (active < start + MENU_WINDOW_MARGIN || active >= start + MENU_WINDOW - MENU_WINDOW_MARGIN) {
      const next = center(active);
      if (next !== start) setStart(next);
    }
  }, [active, count, windowed]);
  useLayoutEffect(() => {
    if (windowed) setStart(center(active));
  }, [resetKey]);

  useLayoutEffect(() => {
    const list = listRef.current;
    const rows = list?.querySelectorAll<HTMLElement>(".nier-menu-item");
    if (!list || !rows || rows.length < 2) return;
    const measured = rows[1].parentElement!.offsetTop - rows[0].parentElement!.offsetTop;
    if (measured > 0 && Math.abs(measured - pitch) > 0.5) setPitch(measured);
  });

  const onScroll = () => {
    const list = listRef.current;
    if (!windowed || !list) return;
    // Défilement au doigt : la fenêtre suit la zone affichée.
    const first = Math.floor(list.scrollTop / pitch);
    const visible = Math.ceil(list.clientHeight / pitch);
    if (first < start || first + visible > start + MENU_WINDOW) setStart(center(first + Math.floor(visible / 2)));
  };

  if (!windowed) return { start: 0, end: count, before: 0, after: 0, onScroll };
  const s = Math.min(start, Math.max(0, count - MENU_WINDOW));
  const end = Math.min(count, s + MENU_WINDOW);
  return { start: s, end, before: s * pitch, after: (count - end) * pitch, onScroll };
}

export function NierLayout({
  title = "MENU",
  tabs = [],
  activeTabId,
  onTabChange,
  status,
  menuTitle,
  menuItems,
  activeItemId,
  onItemSelect,
  onItemActivate,
  detailTitle,
  detailFocused = false,
  detailRef,
  children,
  footerStart,
  footer,
  theme = "light",
}: NierLayoutProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const activeIndex = Math.max(0, menuItems.findIndex((i) => i.id === activeItemId));
  const win = useMenuWindow(listRef, menuItems.length, activeIndex, activeTabId);
  // Rappels stables pour les lignes mémorisées (l'hôte en recrée à chaque rendu).
  const handlers = useRef({ onItemSelect, onItemActivate });
  handlers.current = { onItemSelect, onItemActivate };
  const select = useCallback((id: string) => handlers.current.onItemSelect(id), []);
  const activate = useCallback((id: string) => handlers.current.onItemActivate?.(id), []);

  // Garde l'item sélectionné visible quand il change sans la souris (manette).
  useEffect(() => {
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>('.nier-menu-item[aria-selected="true"]')?.parentElement;
    if (!list || !item) return;
    const margin = 12;
    if (item.offsetTop - margin < list.scrollTop) {
      list.scrollTop = item.offsetTop - margin;
    } else if (item.offsetTop + item.offsetHeight + margin > list.scrollTop + list.clientHeight) {
      list.scrollTop = item.offsetTop + item.offsetHeight + margin - list.clientHeight;
    }
  }, [activeItemId, activeTabId, win.start]);

  return (
    <div className="nier-root" data-nier-theme={theme}>
      <NierStyles />

      <header className="nier-header">
        <h1 className="nier-title">{title}</h1>
        {tabs.length > 1 && (
        <ul className="nier-tabs" role="tablist">
          {tabs.map((tab) => (
            <li key={tab.id}>
              <button
                type="button"
                role="tab"
                className="nier-tab"
                aria-selected={tab.id === activeTabId}
                onClick={() => onTabChange?.(tab.id)}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
        )}
        {status && <div className="nier-header-status">{status}</div>}
      </header>

      <div className="nier-rule" aria-hidden="true" />

      <main className="nier-body">
        <nav className="nier-menu">
          {menuTitle && <h2 className="nier-section-title">{menuTitle}</h2>}
          <ul className="nier-menu-list" role="listbox" ref={listRef} onScroll={win.onScroll}>
            {/* Longue liste : seules les lignes autour du curseur sont dessinées ; les
                espaces gardent la hauteur (et la barre de défilement) de la liste entière. */}
            {win.before > 0 && <li aria-hidden="true" className="nier-menu-spacer" data-edge="before" style={{ height: win.before }} />}
            {menuItems.slice(win.start, win.end).map((item) => (
              <MenuRow key={item.id} item={item} selected={item.id === activeItemId} onSelect={select} onActivate={activate} />
            ))}
            {win.after > 0 && <li aria-hidden="true" className="nier-menu-spacer" data-edge="after" style={{ height: win.after }} />}
          </ul>
        </nav>

        <section className="nier-detail" data-focused={detailFocused}>
          {detailTitle && <div className="nier-detail-header">{detailTitle}</div>}
          {/* La clé rejoue l'animation d'entrée à chaque changement d'item. */}
          <div className="nier-detail-content" key={activeItemId} ref={detailRef}>
            {children}
          </div>
        </section>
      </main>

      {(footerStart || footer) && (
        <footer className="nier-footer">
          <div className="nier-footer-group">{footerStart}</div>
          <div className="nier-footer-group">{footer}</div>
        </footer>
      )}
    </div>
  );
}
