import { useState, type ReactNode } from "react";

export interface NierField {
  label: string;
  value: string;
}

export interface NierGameDetailProps {
  /** URL(s) du visuel, essayées dans l'ordre ; sans visuel valide, un cadre hachuré s'affiche. */
  image?: string | string[];
  imageAlt?: string;
  /** false : pas de cadre d'image du tout (réglages, textes). */
  art?: boolean;
  /** Cadre d'image moins haut, pour laisser la place aux actions. */
  compact?: boolean;
  /** Contenu placé juste sous l'image (actions…), avant les champs. */
  actions?: ReactNode;
  fields?: NierField[];
  description?: string;
}

/** Contenu type de la zone de droite. Les styles viennent de <NierStyles />. */
export function NierGameDetail({ image, imageAlt = "", art = true, compact = false, actions, fields = [], description }: NierGameDetailProps) {
  const images = image ? (Array.isArray(image) ? image : [image]) : [];
  // Index de l'image en cours ; on passe à la suivante si elle ne charge pas.
  const [attempt, setAttempt] = useState({ key: images.join("|"), index: 0 });
  const key = images.join("|");
  const index = attempt.key === key ? attempt.index : 0;
  const src = images[index];

  return (
    <div className="nier-game">
      {art && (
        <div className="nier-game-art" data-empty={!src} data-compact={compact}>
          {src ? (
            <>
              {/* Image entière dans le cadre, sur un fond flou d'elle-même (bannière, jaquette verticale…). */}
              <img className="nier-game-art-backdrop" src={src} alt="" aria-hidden="true" />
              <img className="nier-game-art-image" src={src} alt={imageAlt} onError={() => setAttempt({ key, index: index + 1 })} />
            </>
          ) : (
            "No visual data"
          )}
        </div>
      )}

      {actions}

      {fields.length > 0 && (
        <dl className="nier-game-fields">
          {fields.map((f) => (
            <div key={f.label} style={{ display: "contents" }}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {description && <p className="nier-game-description">{description}</p>}
    </div>
  );
}
