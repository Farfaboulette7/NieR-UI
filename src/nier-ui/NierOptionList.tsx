import { useEffect, useRef } from "react";

export interface NierOption {
  id: string;
  label: string;
  /** Texte court à droite (Oui / Non, durée...). */
  badge?: string;
  /** Marqué d'un repère (morceau en cours de lecture...). */
  active?: boolean;
}

export interface NierOptionListProps {
  options: NierOption[];
  /** Ligne sous le curseur ; aucune quand la liste n'a pas la main. */
  selectedId?: string;
  onSelect?: (id: string) => void;
  onActivate?: (id: string) => void;
}

/** Liste de choix dans la zone de droite (réglages, morceaux...). */
export function NierOptionList({ options, selectedId, onSelect, onActivate }: NierOptionListProps) {
  const listRef = useRef<HTMLUListElement>(null);
  // Garde la ligne sélectionnée visible quand elle change à la manette.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);
  return (
    <ul className="nier-options" ref={listRef}>
      {options.map((o) => (
        <li key={o.id}>
          <button
            type="button"
            className="nier-option"
            data-selected={o.id === selectedId}
            data-active={!!o.active}
            onMouseEnter={() => onSelect?.(o.id)}
            onClick={() => onActivate?.(o.id)}
          >
            <span className="nier-option-mark" aria-hidden="true" />
            <span className="nier-option-label">{o.label}</span>
            {o.badge && <span className="nier-option-badge">{o.badge}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
