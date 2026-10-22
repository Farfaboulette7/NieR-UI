import { useState } from "react";

export interface NierField {
  label: string;
  value: string;
}

export interface NierGameDetailProps {
  /** URL(s) du visuel, essayées dans l'ordre ; sans visuel valide, un cadre hachuré s'affiche. */
  image?: string | string[];
  imageAlt?: string;
  fields?: NierField[];
  description?: string;
}

/** Contenu type de la zone de droite. Les styles viennent de <NierStyles />. */
export function NierGameDetail({ image, imageAlt = "", fields = [], description }: NierGameDetailProps) {
  const images = image ? (Array.isArray(image) ? image : [image]) : [];
  // Index de l'image en cours ; on passe à la suivante si elle ne charge pas.
  const [attempt, setAttempt] = useState({ key: images.join("|"), index: 0 });
  const key = images.join("|");
  const index = attempt.key === key ? attempt.index : 0;
  const src = images[index];

  return (
    <div className="nier-game">
      <div className="nier-game-art" data-empty={!src}>
        {src ? <img src={src} alt={imageAlt} onError={() => setAttempt({ key, index: index + 1 })} /> : "No visual data"}
      </div>

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
