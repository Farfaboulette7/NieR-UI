/** Jauge en segments (volume...). value de 0 à 100. */
export function NierMeter({ label, value, segments = 10, mutedLabel = "Coupé" }: { label: string; value: number; segments?: number; mutedLabel?: string }) {
  const lit = Math.round((Math.max(0, Math.min(100, value)) / 100) * segments);
  return (
    <div className="nier-meter">
      <div className="nier-ach-progress-label">
        <span>{label}</span>
        <span>{value === 0 ? mutedLabel : `${value} %`}</span>
      </div>
      <div className="nier-meter-cells">
        {Array.from({ length: segments }, (_, i) => (
          <span key={i} className="nier-meter-cell" data-on={i < lit} />
        ))}
      </div>
    </div>
  );
}
