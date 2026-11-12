import type { ReactNode } from "react";
import type { NierMenuItem } from "../nier-ui";

/** Liste de la zone de droite qui peut prendre la main. */
export interface PanelDef {
  rows: string[];
  initial?: string;
  activate: (row: string) => void;
  /** Gauche / droite sur une ligne réglable (volume, luminosité) ; true si pris en charge. */
  adjust?: (row: string, delta: number) => boolean;
  adjustable?: (row: string) => boolean;
}

/** Ce qu'affiche un onglet : le menu de gauche, la zone de droite, et ce que fait A. */
export interface TabView {
  menuTitle: string;
  items: NierMenuItem[];
  /** Zone de droite pour l'item sélectionné (undefined si la liste est vide) ; `row` : ligne choisie dans son panneau. */
  detail: (id: string | undefined, row?: string) => { title: string; content: ReactNode };
  activate: (id: string) => void;
  /** Libellé de A pour l'item sélectionné ; rien = pas d'aide. */
  hint?: (id: string) => string | undefined;
  /** B dans l'onglet (sortir d'une collection...). true si pris en charge. */
  back?: () => boolean;
  /** Gauche / droite sur un item réglable (volume) ; true si pris en charge. */
  adjust?: (id: string, delta: number) => boolean;
  /** L'item sélectionné se règle avec gauche / droite (aide affichée). */
  adjustable?: (id: string) => boolean;
  /** Item dont la zone de droite est une liste de choix : A y entre, haut/bas choisit, B en sort. */
  panel?: (id: string) => PanelDef | undefined;
}
