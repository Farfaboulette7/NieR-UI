import { useEffect, useRef, type ReactNode, type Ref } from "react";
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
  }, [activeItemId, activeTabId]);

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
          <ul className="nier-menu-list" role="listbox" ref={listRef}>
            {menuItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  role="option"
                  className="nier-menu-item"
                  aria-selected={item.id === activeItemId}
                  data-muted={!!item.muted}
                  onMouseEnter={() => onItemSelect(item.id)}
                  onFocus={() => onItemSelect(item.id)}
                  onClick={() => onItemActivate?.(item.id)}
                >
                  <span className="nier-menu-item-mark" aria-hidden="true" />
                  <span className="nier-menu-item-label">{item.label}</span>
                  {item.badge && <span className="nier-menu-item-badge">{item.badge}</span>}
                </button>
              </li>
            ))}
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
