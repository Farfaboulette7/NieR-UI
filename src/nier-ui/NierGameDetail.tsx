export interface NierField {
  label: string;
  value: string;
}

export interface NierGameDetailProps {
  /** URL du visuel ; sans elle, un cadre vide hachuré s'affiche. */
  image?: string;
  imageAlt?: string;
  fields?: NierField[];
  description?: string;
}

/** Contenu type de la zone de droite. Les styles viennent de <NierStyles />. */
export function NierGameDetail({ image, imageAlt = "", fields = [], description }: NierGameDetailProps) {
  return (
    <div className="nier-game">
      <div className="nier-game-art" data-empty={!image}>
        {image ? <img src={image} alt={imageAlt} /> : "No visual data"}
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
