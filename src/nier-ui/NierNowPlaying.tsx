import { useEffect, useState } from "react";

/**
 * Rappel du morceau en cours, pour le pied de page : alterne entre son titre
 * et sa barre de lecture. Cliquable si `onClick` est fourni.
 */
export function NierNowPlaying({ title, progress, onClick, interval = 4000 }: { title: string; progress: number; onClick?: () => void; interval?: number }) {
  const [showBar, setShowBar] = useState(false);
  useEffect(() => {
    const iv = setInterval(() => setShowBar((b) => !b), interval);
    return () => clearInterval(iv);
  }, [interval]);
  const pct = `${Math.max(0, Math.min(1, progress)) * 100}%`;
  return (
    <button type="button" className="nier-now-playing" onClick={onClick} disabled={!onClick}>
      <span className="nier-now-playing-note" aria-hidden="true">♪</span>
      <span className="nier-now-playing-slot">
        <span className="nier-now-playing-title" data-visible={!showBar}>
          {title}
        </span>
        <span className="nier-now-playing-bar" data-visible={showBar}>
          <span className="nier-now-playing-fill" style={{ width: pct }} />
        </span>
      </span>
    </button>
  );
}
