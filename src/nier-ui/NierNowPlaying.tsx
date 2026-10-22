import { useLayoutEffect, useRef, useState } from "react";

/** Vitesse de défilement d'un titre trop long, en pixels par seconde. */
const MARQUEE_SPEED = 28;
const MARQUEE_GAP = 48;

/**
 * Rappel du morceau en cours, pour le pied de page : le titre au-dessus de sa
 * barre de lecture. Un titre trop long s'efface en fondu au bout de la barre
 * et défile lentement de droite à gauche.
 */
export function NierNowPlaying({
  title,
  progress,
  button = "Y",
  paused = false,
  onClick,
}: {
  title: string;
  progress: number;
  /** Bouton affiché dans la pastille (pause / lecture). */
  button?: string;
  /** En pause : le titre est estompé et la pastille l'indique. */
  paused?: boolean;
  onClick?: () => void;
}) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0); // largeur du texte si elle dépasse, sinon 0

  useLayoutEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text) return;
    const width = text.scrollWidth;
    setOverflow(width > box.clientWidth ? width : 0);
  }, [title]);

  const pct = `${Math.max(0, Math.min(1, progress)) * 100}%`;
  const distance = overflow + MARQUEE_GAP;
  return (
    <button type="button" className="nier-now-playing" data-paused={paused} onClick={onClick} disabled={!onClick}>
      <span className="nier-now-playing-glyph" aria-hidden="true">
        {button}
      </span>
      <span className="nier-now-playing-info">
        <span className="nier-now-playing-title" ref={boxRef} data-overflow={overflow > 0}>
          <span
            className="nier-now-playing-track"
            style={overflow ? { animationDuration: `${distance / MARQUEE_SPEED}s`, ["--nier-marquee" as string]: `-${distance}px` } : undefined}
          >
            <span ref={textRef}>{title}</span>
            {/* Seconde copie pour une boucle sans à-coup. */}
            {overflow > 0 && (
              <span aria-hidden="true" style={{ paddingLeft: MARQUEE_GAP }}>
                {title}
              </span>
            )}
          </span>
        </span>
        <span className="nier-now-playing-bar">
          <span className="nier-now-playing-fill" style={{ width: pct }} />
        </span>
      </span>
    </button>
  );
}
