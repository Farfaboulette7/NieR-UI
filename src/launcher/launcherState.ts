// État du launcher qui survit à son démontage : Steam change de page au
// lancement d'un jeu (il ouvre /library/app/<id>), ce qui démonte l'accueil.

/** Jeu dont la page NieR est glissée par-dessus le launcher (null : aucune). */
export const launcherState: { overlayAppid: number | null } = { overlayAppid: null };
