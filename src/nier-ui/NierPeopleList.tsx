export interface NierPerson {
  id: string;
  name: string;
  /** Ligne secondaire (en ligne, joue à..., hors ligne). */
  status?: string;
  avatar?: string;
  /** false : estompé (hors ligne). */
  active?: boolean;
}

export interface NierPeopleListProps {
  /** Ligne d'en-tête (ex. « 12 contacts y ont joué »). */
  heading?: string;
  items: NierPerson[];
  emptyText?: string;
}

/** Liste de personnes (contacts d'un jeu...). Reprend les styles de la liste de succès. */
export function NierPeopleList({ heading, items, emptyText }: NierPeopleListProps) {
  return (
    <div className="nier-ach">
      {heading && <div className="nier-ach-progress-label">{heading}</div>}
      {items.length === 0 && emptyText && <p className="nier-game-description">{emptyText}</p>}
      <ul className="nier-ach-list">
        {items.map((p) => (
          <li key={p.id} className="nier-ach-item" data-achieved={p.active !== false}>
            <span className="nier-ach-icon">{p.avatar && <img src={p.avatar} alt="" />}</span>
            <span className="nier-ach-text">
              <span className="nier-ach-name">{p.name}</span>
              {p.status && <span className="nier-ach-desc">{p.status}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
