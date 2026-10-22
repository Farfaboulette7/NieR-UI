import { useEffect, useState } from "react";
import { YORHA_EMBLEM_PNG } from "./assets/yorhaEmblem";

// L'image est noire sur fond clair : on la convertit une fois en masque
// (alpha = noirceur du pixel) pour la colorer avec les couleurs du thème.
let maskPromise: Promise<string | null> | null = null;

function emblemMask(): Promise<string | null> {
  if (!maskPromise) {
    maskPromise = new Promise((resolve) => {
      const img = new Image();
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
            const dark = 255 - Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
            px[i + 3] = Math.min(px[i + 3], dark);
            px[i] = px[i + 1] = px[i + 2] = 0;
          }
          c.putImageData(data, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = YORHA_EMBLEM_PNG;
    });
  }
  return maskPromise;
}

/** Emblème YoRHa, dans la couleur du texte courant (currentColor). */
export function NierEmblem({ className }: { className?: string }) {
  const [mask, setMask] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void emblemMask().then((m) => alive && setMask(m));
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div
      className={`nier-emblem ${className ?? ""}`}
      style={mask ? { WebkitMaskImage: `url("${mask}")`, maskImage: `url("${mask}")` } : { opacity: 0 }}
      aria-hidden="true"
    />
  );
}
