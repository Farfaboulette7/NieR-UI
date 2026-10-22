import { useEffect, useState } from "react";

// L'image d'onde est blanche sur fond noir opaque : pour s'en servir comme
// masque, on la convertit une fois en image transparente (alpha = luminosité).
const masks = new Map<string, Promise<string | null>>();

function alphaMask(src: string): Promise<string | null> {
  let p = masks.get(src);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const c = canvas.getContext("2d");
          if (!c) return resolve(null);
          c.drawImage(img, 0, 0);
          const data = c.getImageData(0, 0, canvas.width, canvas.height);
          const px = data.data;
          for (let i = 0; i < px.length; i += 4) {
            px[i + 3] = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
            px[i] = px[i + 1] = px[i + 2] = 255;
          }
          c.putImageData(data, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
    masks.set(src, p);
  }
  return p;
}

/**
 * Onde sonore d'un morceau, aux couleurs YoRHa : la partie déjà écoutée est
 * foncée, le reste plus clair. Sans image, une simple ligne de progression.
 */
export function NierWaveform({ src, progress }: { src?: string | null; progress: number }) {
  const [mask, setMask] = useState<string | null>(null);
  useEffect(() => {
    setMask(null);
    if (!src) return;
    let alive = true;
    void alphaMask(src).then((m) => alive && setMask(m));
    return () => {
      alive = false;
    };
  }, [src]);

  const pct = `${Math.max(0, Math.min(1, progress)) * 100}%`;
  const fill = `linear-gradient(to right, var(--nier-low) ${pct}, var(--nier-mid) ${pct})`;
  return (
    <div className="nier-wave">
      {mask ? (
        <div className="nier-wave-image" style={{ WebkitMaskImage: `url("${mask}")`, maskImage: `url("${mask}")`, backgroundImage: fill }} />
      ) : (
        <div className="nier-wave-line" style={{ backgroundImage: fill }} />
      )}
      <div className="nier-wave-cursor" style={{ left: pct }} />
    </div>
  );
}
