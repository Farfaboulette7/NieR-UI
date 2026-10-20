import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Surface de dessin à largeur fixe (1280 par défaut), mise à l'échelle de son
 * conteneur. La hauteur suit le format de l'écran (800 sur le Steam Deck).
 * L'interface Steam du Deck est agrandie (~1,4×) : sans cette surface, la mise
 * en page manquerait de place.
 */
export function NierStage({ width = 1280, children }: { width?: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 1, height: 800 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Le plugin peut tourner dans un autre document que celui où il dessine :
    // on prend la fenêtre propriétaire de l'élément.
    const view: any = el.ownerDocument?.defaultView ?? window;
    const measure = () => {
      const w = el.clientWidth || view.innerWidth || width;
      const h = el.clientHeight || view.innerHeight || 800;
      const scale = w / width;
      const height = Math.round(h / scale);
      setBox((b) => (b.scale === scale && b.height === height ? b : { scale, height }));
    };
    measure();
    const ro = view.ResizeObserver ? new view.ResizeObserver(measure) : null;
    ro?.observe(el);
    view.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      view.removeEventListener("resize", measure);
    };
  }, [width]);

  return (
    <div ref={ref} className="nier-stage">
      <div className="nier-stage-surface" style={{ width, height: box.height, transform: `scale(${box.scale})` }}>
        {children}
      </div>
    </div>
  );
}
