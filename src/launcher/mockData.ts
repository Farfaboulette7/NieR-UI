// Données fictives de l'étape 2. Elles seront remplacées par la vraie
// bibliothèque Steam (appStore / collectionStore) dans une étape suivante.

export interface MockGame {
  id: string;
  name: string;
  playtime: string;
  lastPlayed: string;
  size: string;
  description: string;
}

export interface MockTab {
  id: string;
  label: string;
  menuTitle: string;
  games: MockGame[];
}

const g = (id: string, name: string, playtime: string, lastPlayed: string, size: string, description: string): MockGame => ({
  id,
  name,
  playtime,
  lastPlayed,
  size,
  description,
});

const NIER = g("nier", "NieR:Automata", "87 h", "Hier", "45,2 Go", "Androïdes YoRHA contre machines, sur une Terre abandonnée. Gloire à l'humanité.");
const HADES = g("hades2", "Hades II", "42 h", "Il y a 3 jours", "8,1 Go", "La princesse des Enfers affronte le Titan du Temps.");
const ELDEN = g("elden", "Elden Ring", "118 h", "La semaine dernière", "49,0 Go", "Un monde ouvert sombre où chaque chemin mène à un nouveau combat.");
const CELESTE = g("celeste", "Celeste", "23 h", "Le mois dernier", "1,2 Go", "Gravir une montagne, un saut précis après l'autre.");
const HOLLOW = g("hollow", "Hollow Knight", "61 h", "Le mois dernier", "9,0 Go", "Un royaume d'insectes en ruine, à explorer en profondeur.");
const BALATRO = g("balatro", "Balatro", "34 h", "Il y a 2 jours", "0,1 Go", "Un roguelike de poker où les jokers changent toutes les règles.");
const WILDS = g("wilds", "Outer Wilds", "19 h", "Il y a 2 mois", "7,5 Go", "Un système solaire pris dans une boucle de 22 minutes.");

export const MOCK_TABS: MockTab[] = [
  { id: "library", label: "Bibliothèque", menuTitle: "Jeux installés", games: [NIER, HADES, ELDEN, CELESTE, HOLLOW, BALATRO, WILDS] },
  { id: "recent", label: "Récents", menuTitle: "Joués récemment", games: [NIER, BALATRO, HADES, ELDEN] },
  { id: "collections", label: "Collections", menuTitle: "Favoris", games: [NIER, HOLLOW, WILDS] },
  { id: "store", label: "Boutique", menuTitle: "Liste de souhaits", games: [] },
  { id: "system", label: "Système", menuTitle: "Paramètres", games: [] },
];
