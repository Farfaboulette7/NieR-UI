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
  /** Liste seulement parcourue (succès) : A n'y fait rien, son aide est masquée. */
  browseOnly?: boolean;
  /** Pas de lignes : ↑ ↓ font défiler la zone de droite (notes, profil). */
  scroll?: boolean;
}

/** Ce qu'affiche un onglet : le menu de gauche, la zone de droite, et ce que fait A. */
export interface TabView {
  /** Gros titre en haut à gauche (page d'un jeu : son nom) ; sinon « MENU ». */
  title?: string;
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
  /** Barre au-dessus de la liste (filtres…), changée avec L2 / R2. */
  sub?: { labels: string[]; active: number; step: (delta: number) => void; hint: string };
  /** Gauche / droite saute dans la liste (lettre précédente / suivante) : id à sélectionner. */
  jump?: (id: string, delta: number) => string | undefined;
  jumpHint?: string;
  /** X sur l'item sélectionné (favori…). */
  secondary?: (id: string) => void;
  secondaryHint?: (id: string) => string | undefined;
}
