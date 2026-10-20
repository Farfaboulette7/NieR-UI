import type { ReactNode } from "react";
import { NIER_TOKENS_CSS, type NierTheme } from "./tokens";
import { NIER_LAYOUT_CSS } from "./layoutStyles";
import { NIER_FONTS_CSS } from "./fonts";
import { NIER_DETAIL_CSS } from "./detailStyles";

// Aucune dépendance à Decky ici : ce module ne connaît que React.
// La navigation manette (L1/R1, D-pad, A/B) sera branchée par l'hôte.

export interface NierTab {
  id: string;
  label: string;
}

export interface NierMenuItem {
  id: string;
  label: string;
  /** Texte court aligné à droite (compteur, statut...). */
  badge?: string;
}

export interface NierLayoutProps {
  /** Gros titre en haut à gauche (ex. "MENU"). */
  title?: string;
  tabs: NierTab[];
  activeTabId: string;
  onTabChange: (id: string) => void;

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
  /** Contenu de la zone de droite (miniature, infos du jeu...). */
  children?: ReactNode;
  /** Aides de commandes en bas à droite. */
  footer?: ReactNode;

  theme?: NierTheme;
}

/** Injecte les tokens et les styles du layout. Une seule fois par arbre suffit. */
export function NierStyles() {
  return <style>{NIER_FONTS_CSS + NIER_TOKENS_CSS + NIER_LAYOUT_CSS + NIER_DETAIL_CSS}</style>;
}

export function NierLayout({
  title = "MENU",
  tabs,
  activeTabId,
  onTabChange,
  menuTitle,
  menuItems,
  activeItemId,
  onItemSelect,
  onItemActivate,
  detailTitle,
  children,
  footer,
  theme = "light",
}: NierLayoutProps) {
  return (
    <div className="nier-root" data-nier-theme={theme}>
      <NierStyles />

      <header className="nier-header">
        <h1 className="nier-title">{title}</h1>
        <ul className="nier-tabs" role="tablist">
          {tabs.map((tab) => (
            <li key={tab.id}>
              <button
                type="button"
                role="tab"
                className="nier-tab"
                aria-selected={tab.id === activeTabId}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
      </header>

      <div className="nier-rule" aria-hidden="true" />

      <main className="nier-body">
        <nav className="nier-menu">
          {menuTitle && <h2 className="nier-section-title">{menuTitle}</h2>}
          <ul className="nier-menu-list" role="listbox">
            {menuItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  role="option"
                  className="nier-menu-item"
                  aria-selected={item.id === activeItemId}
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

        <section className="nier-detail">
          {detailTitle && <div className="nier-detail-header">{detailTitle}</div>}
          {/* La clé rejoue l'animation d'entrée à chaque changement d'item. */}
          <div className="nier-detail-content" key={activeItemId}>
            {children}
          </div>
        </section>
      </main>

      {footer && <footer className="nier-footer">{footer}</footer>}
    </div>
  );
}
