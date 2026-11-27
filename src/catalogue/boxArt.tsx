// Visuel d'un jeu du Catalogue, comme BoxArt du launcher : la boîte 3D si RomM a la face et la
// tranche, sinon la boîte détourée, sinon la jaquette à plat. Les images passent par la commande
// `image` du moteur et le serveur local de NieRDeck (le jeton RomM ne va jamais à l'interface).
import { useEffect, useState } from "react";
import { NierBoxArt, type NierBoxVisual } from "../nier-ui";
import { readRightStick, useRightStick } from "../launcher/rightStick";
import { imageState } from "./store";

interface BoxSource {
  boxFaces?: { front: string; side: string; back: string | null } | null;
  box3dUrl?: string | null;
  coverUrl?: string | null;
}

/** Aperçu de la liste : on attend que le curseur s'arrête avant de télécharger les images. */
const ARM_MS = 250;

function visualOf(src: BoxSource, withBack: boolean): NierBoxVisual {
  const faces = src.boxFaces;
  if (faces) {
    const front = imageState(faces.front);
    const side = imageState(faces.side);
    if (front !== null && side !== null) {
      if (front === "loading" || side === "loading") return { kind: "wait" };
      const back = withBack && faces.back ? imageState(faces.back) : null;
      return { kind: "box", front, side, back: back && back !== "loading" ? back : null };
    }
  }
  const cutout = imageState(src.box3dUrl);
  if (cutout === "loading") return { kind: "wait" };
  if (cutout) return { kind: "cutout", src: cutout };
  const cover = imageState(src.coverUrl);
  if (cover === "loading") return { kind: "wait" };
  if (cover) return { kind: "flat", src: cover };
  return { kind: "none" };
}

/** Le jeu a-t-il de quoi afficher une boîte (faces ou boîte détourée) ? */
export const hasBox = (src: BoxSource | undefined | null) => !!(src?.boxFaces || src?.box3dUrl);

/**
 * `page` : page du jeu (dos chargé, tour complet, stick droit pour la tourner) ;
 * sinon aperçu de la liste (face et tranche seulement, la boîte oscille).
 */
export function CatBoxArt({ source, page = false }: { source: BoxSource; page?: boolean }) {
  const [armed, setArmed] = useState(page);
  useEffect(() => {
    if (page) return;
    const t = setTimeout(() => setArmed(true), ARM_MS);
    return () => clearTimeout(t);
  }, [page]);
  useRightStick(page);
  const visual = armed ? visualOf(source, page) : ({ kind: "wait" } as NierBoxVisual);
  return <NierBoxArt visual={visual} autoSpin interactive={page} input={page ? readRightStick : undefined} />;
}
