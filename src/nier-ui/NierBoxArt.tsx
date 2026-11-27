// Boîte de jeu en 3D, portée de FarfaLauncher (src/components/BoxArt.tsx) : si RomM a la face
// avant et la tranche (et le dos), une vraie boîte en CSS ; sinon la boîte détourée, sinon la
// jaquette à plat. Sans souris : rotation automatique, et `input` (stick droit) pour la tourner.
// Pas d'import Decky : les images arrivent déjà résolues (URL locales).
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

export type NierBoxVisual =
  | { kind: "wait" }
  | { kind: "box"; front: string; side: string; back?: string | null }
  | { kind: "cutout"; src: string }
  | { kind: "flat"; src: string }
  | { kind: "none" };

export interface NierBoxArtProps {
  visual: NierBoxVisual;
  /** La boîte tourne lentement sur elle-même quand on n'y touche pas. */
  autoSpin?: boolean;
  /** Page du jeu : la boîte doit tenir quel que soit l'angle (sa diagonale). */
  interactive?: boolean;
  /** Lu à chaque image : position du stick (-1…1), ou null s'il est au repos. */
  input?: () => { x: number; y: number } | null;
}

/** Angle de présentation : la tranche (côté gauche) bien visible. */
const REST = { rx: -8, ry: 28 };
/** Rotation automatique, comme RomM et le launcher (0,18° par image à 60 i/s). */
const AUTO_SPIN_DEG_PER_S = 0.18 * 60;
/** Stick poussé à fond : degrés par seconde. */
const STICK_DEG_PER_S = { ry: 200, rx: 90 };
/** Pause de la rotation automatique après une manipulation. */
const IDLE_RESUME_MS = 2000;
/** Zone morte du stick. */
const DEAD = 0.15;

export function NierBoxArt({ visual, autoSpin = false, interactive = false, input }: NierBoxArtProps) {
  if (visual.kind === "box") return <Box3D {...visual} autoSpin={autoSpin} interactive={interactive} input={input} />;
  if (visual.kind === "cutout") return <img className="nier-box-cutout" src={visual.src} alt="" draggable={false} />;
  if (visual.kind === "flat") return <img className="nier-box-flat" src={visual.src} alt="" draggable={false} />;
  if (visual.kind === "wait") return <span className="nier-box-wait">…</span>;
  return null;
}

/** Ratio largeur / hauteur d'une image. */
const ratios = new Map<string, number>();
function useRatio(src: string | null | undefined): number | null {
  const [ratio, setRatio] = useState<number | null>(() => (src && ratios.get(src)) || null);
  useEffect(() => {
    const known = (src && ratios.get(src)) || null;
    setRatio(known);
    if (!src || known) return;
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (img.naturalHeight <= 0) return;
      ratios.set(src, img.naturalWidth / img.naturalHeight);
      if (alive) setRatio(img.naturalWidth / img.naturalHeight);
    };
    img.src = src;
    return () => {
      alive = false;
    };
  }, [src]);
  return ratio;
}

interface Box3DProps {
  front: string;
  side: string;
  back?: string | null;
  autoSpin: boolean;
  interactive: boolean;
  input?: () => { x: number; y: number } | null;
}

function Box3D({ front, side, back, autoSpin, interactive, input }: Box3DProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const angle = useRef({ ...REST });
  const inputRef = useRef(input);
  inputRef.current = input;
  const frontRatio = useRatio(front);
  const sideRatio = useRatio(side);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setSize({ w: el.clientWidth, h: el.clientHeight });
    // Le ResizeObserver de la fenêtre de l'élément : sous Steam, ce code tourne dans un autre
    // contexte (SharedJSContext) que la fenêtre Big Picture, et le sien ne s'y déclenche pas.
    const RO: typeof ResizeObserver = (el.ownerDocument.defaultView as any)?.ResizeObserver ?? ResizeObserver;
    const ro = new RO(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Angle posé directement sur la boîte, sans redessiner React à chaque image (Deck fluide).
  const apply = () => {
    const el = stage.current;
    if (!el) return;
    el.style.setProperty("--rx", `${angle.current.rx}deg`);
    el.style.setProperty("--ry", `${angle.current.ry}deg`);
  };

  const hasStage = !!(size && frontRatio && sideRatio);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    // Rotation automatique en animation CSS (processeur graphique, sans JavaScript à chaque
    // image) : tour complet avec le dos, sinon oscillation entre la face et la tranche.
    const mode = !autoSpin ? "" : back ? "spin" : "swing";
    const startAnim = () => {
      if (!mode) return;
      // Le tour reprend là où le stick a laissé la boîte.
      const turn = (((angle.current.ry - REST.ry) % 360) + 360) % 360;
      el.style.animationDelay = mode === "spin" ? `${-turn / AUTO_SPIN_DEG_PER_S}s` : "0s";
      el.dataset.anim = mode;
    };
    const stopAnim = () => {
      if (!el.dataset.anim) return;
      // Angle atteint par l'animation : rotateX(a) rotateY(b) → b = atan2(m31, m11).
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      angle.current = { rx: REST.rx, ry: (Math.atan2(m.m31, m.m11) * 180) / Math.PI };
      el.dataset.anim = "";
      apply();
    };
    startAnim();
    if (!input) return () => void (el.dataset.anim = "");
    let raf = 0;
    let prev = performance.now();
    let lastInput = 0;
    let manual = false;
    const tick = (now: number) => {
      // Borné : un écran revenu au premier plan ne fait pas un bond.
      const dt = Math.min(now - prev, 50) / 1000;
      prev = now;
      const s = inputRef.current?.();
      if (s && (Math.abs(s.x) > DEAD || Math.abs(s.y) > DEAD)) {
        if (!manual) stopAnim();
        manual = true;
        lastInput = now;
        const a = angle.current;
        a.ry += s.x * STICK_DEG_PER_S.ry * dt;
        a.rx = Math.max(-35, Math.min(35, a.rx - s.y * STICK_DEG_PER_S.rx * dt));
        apply();
      } else if (manual && now - lastInput > IDLE_RESUME_MS) {
        manual = false;
        startAnim();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.dataset.anim = "";
    };
  }, [autoSpin, !!input, !!back, hasStage]);

  // Certaines tranches (N64…) sont scrapées couchées, plus larges que hautes :
  // on les redresse d'un quart de tour.
  const sideRotated = !!sideRatio && sideRatio > 1;
  let dims: { W: number; H: number; D: number } | null = null;
  if (size && frontRatio && sideRatio) {
    // La tranche a la hauteur de la boîte : son ratio donne la profondeur,
    // bornée pour qu'une image inattendue ne donne pas un pavé.
    const depthRatio = Math.min(sideRotated ? 1 / sideRatio : sideRatio, frontRatio * 0.45);
    const rad = (REST.ry * Math.PI) / 180;
    // La boîte tourne : elle doit tenir quel que soit l'angle (sa diagonale).
    const span = interactive || autoSpin ? Math.hypot(frontRatio, depthRatio) : frontRatio * Math.cos(rad) + depthRatio * Math.sin(rad);
    // Marge pour la perspective : la face qui avance grandit.
    const H = Math.min(size.h * 0.78, (size.w * 0.85) / span);
    dims = { W: H * frontRatio, H, D: H * depthRatio };
  }
  useLayoutEffect(apply);

  return (
    <div ref={wrap} className="nier-b3">
      {dims ? (
        <div className="nier-b3-scene" style={{ perspective: `${dims.H * 4}px` }}>
          <div ref={stage} className="nier-b3-stage" style={{ width: dims.W, height: dims.H }}>
            <Face src={front} cls="nier-b3-front" w={dims.W} h={dims.H} t={`translateZ(${dims.D / 2}px)`} />
            <Face src={back ?? null} cls="nier-b3-back" w={dims.W} h={dims.H} t={`rotateY(180deg) translateZ(${dims.D / 2}px)`} />
            <Face src={side} rotated={sideRotated} cls="nier-b3-spine" w={dims.D} h={dims.H} x={(dims.W - dims.D) / 2} t={`rotateY(-90deg) translateZ(${dims.W / 2}px)`} />
            <Face src={null} cls="nier-b3-edge" w={dims.D} h={dims.H} x={(dims.W - dims.D) / 2} t={`rotateY(90deg) translateZ(${dims.W / 2}px)`} />
            <Face src={null} cls="nier-b3-edge nier-b3-top" w={dims.W} h={dims.D} y={(dims.H - dims.D) / 2} t={`rotateX(90deg) translateZ(${dims.H / 2}px)`} />
            <Face src={null} cls="nier-b3-edge nier-b3-bottom" w={dims.W} h={dims.D} y={(dims.H - dims.D) / 2} t={`rotateX(-90deg) translateZ(${dims.H / 2}px)`} />
          </div>
        </div>
      ) : (
        <span className="nier-box-wait">…</span>
      )}
    </div>
  );
}

interface FaceProps {
  src: string | null;
  cls: string;
  w: number;
  h: number;
  x?: number;
  y?: number;
  t: string;
  /** Image couchée : tournée d'un quart de tour pour remplir la face. */
  rotated?: boolean;
}

function Face({ src, cls, w, h, x = 0, y = 0, t, rotated = false }: FaceProps) {
  const imgStyle: CSSProperties | undefined = rotated
    ? { position: "absolute", width: h, height: w, left: (w - h) / 2, top: (h - w) / 2, transform: "rotate(90deg)" }
    : undefined;
  return (
    <div className={`nier-b3-face ${cls}`} style={{ width: w, height: h, left: x, top: y, transform: t }}>
      {src && <img src={src} alt="" draggable={false} style={imgStyle} />}
    </div>
  );
}
