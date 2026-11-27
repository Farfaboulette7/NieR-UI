import { useEffect, useRef } from "react";

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
  /** Libellé de la barre de progression. */
  progressLabel?: string;
  /** Ligne sous le curseur (liste parcourue à la manette), gardée visible. */
  selectedId?: string;
}

/** Progression + liste de succès. Les styles viennent de <NierStyles />. */
export function NierAchievementList({ unlocked, total, items, emptyText, progressLabel = "Progression", selectedId }: NierAchievementListProps) {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (selectedId) listRef.current?.querySelector<HTMLElement>('[data-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);
  const percent = total ? Math.round((unlocked / total) * 100) : 0;
  return (
    <div className="nier-ach">
      {total > 0 && (
        <div className="nier-ach-progress">
          <div className="nier-ach-progress-label">
            <span>{progressLabel}</span>
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
      <ul className="nier-ach-list" ref={listRef}>
        {items.map((item) => (
          <li key={item.id} className="nier-ach-item" data-achieved={item.achieved} data-selected={item.id === selectedId}>
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
