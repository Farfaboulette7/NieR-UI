import type { ReactNode } from "react";

/**
 * Écran posé par-dessus le précédent : il arrive de la droite, et repart vers
 * la droite quand `closing` passe à true (puis `onClosed` est appelé).
 */
export function NierSlideOver({
  closing = false,
  instant = false,
  onClosed,
  children,
}: {
  closing?: boolean;
  /** Déjà en place : pas d'animation d'arrivée (retour sur un écran laissé ouvert). */
  instant?: boolean;
  onClosed?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="nier-slide-over"
      data-closing={closing}
      data-instant={instant}
      onAnimationEnd={(e) => {
        // Les animations des enfants remontent aussi : on ne garde que la nôtre.
        if (closing && e.target === e.currentTarget) onClosed?.();
      }}
    >
      {children}
    </div>
  );
}
