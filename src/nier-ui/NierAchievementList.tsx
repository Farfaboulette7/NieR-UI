export interface NierAchievementItem {
  id: string;
  name: string;
  description?: string;
  achieved: boolean;
  /** Texte court à droite (date de déblocage...). */
  note?: string;
  icon?: string;
}

export interface NierAchievementListProps {
  unlocked: number;
  total: number;
  items: NierAchievementItem[];
  /** Message affiché quand il n'y a rien à lister. */
  emptyText?: string;
}

/** Progression + liste de succès. Les styles viennent de <NierStyles />. */
export function NierAchievementList({ unlocked, total, items, emptyText }: NierAchievementListProps) {
  const percent = total ? Math.round((unlocked / total) * 100) : 0;
  return (
    <div className="nier-ach">
      {total > 0 && (
        <div className="nier-ach-progress">
          <div className="nier-ach-progress-label">
            <span>Progression</span>
            <span>
              {unlocked} / {total} · {percent} %
            </span>
          </div>
          <div className="nier-ach-progress-bar">
            <div className="nier-ach-progress-fill" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}
      {items.length === 0 && emptyText && <p className="nier-game-description">{emptyText}</p>}
      <ul className="nier-ach-list">
        {items.map((item) => (
          <li key={item.id} className="nier-ach-item" data-achieved={item.achieved}>
            <span className="nier-ach-icon">{item.icon && <img src={item.icon} alt="" />}</span>
            <span className="nier-ach-text">
              <span className="nier-ach-name">{item.name}</span>
              {item.description && <span className="nier-ach-desc">{item.description}</span>}
            </span>
            {item.note && <span className="nier-ach-note">{item.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
