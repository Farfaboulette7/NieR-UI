// Lecteur de livret plein écran (Médias → Livret). Le navigateur de Steam n'affiche pas les
// PDF : chaque page est rendue en PNG sur le Deck (pdftoppm, voir catalogue.py), comme
// PdfViewer.tsx du launcher la dessine page par page. L1 / R1 tournent les pages, L2 / R2
// zooment, la croix déplace la page agrandie (ou tourne les pages sans zoom), B ferme.
import type { ReactNode } from "react";
import { NierHint } from "../nier-ui";
import { playSfx } from "../launcher/audio";
import type { NierAction } from "../launcher/GamepadRoot";
import { ct } from "./i18n";
import { closeManual, manualState, manualTurn, manualZoom, type ManualView } from "./store";

/** Défilement d'un appui de la croix sur une page agrandie (px). */
const SCROLL_STEP = 140;

let stage: HTMLDivElement | null = null;

/** Commandes du lecteur ; true : il a pris le bouton (il les prend tous tant qu'il est ouvert). */
export function manualAction(action: NierAction, repeat: boolean): boolean {
  const m = manualState();
  if (!m) return false;
  const turn = (delta: number) => {
    if (manualTurn(delta)) {
      playSfx("move");
      stage?.scrollTo({ top: 0, left: 0 });
    } else if (!repeat) playSfx("unfocus");
  };
  const scroll = (dx: number, dy: number) => stage?.scrollBy({ left: dx, top: dy, behavior: repeat ? "auto" : "smooth" });
  switch (action) {
    case "back":
      playSfx("close");
      closeManual();
      return true;
    case "prevTab":
    case "nextTab":
      turn(action === "prevTab" ? -1 : 1);
      return true;
    case "prevSub":
    case "nextSub":
      if (manualZoom(action === "prevSub" ? -1 : 1)) playSfx(action === "nextSub" ? "volumeUp" : "volumeDown");
      else playSfx("unfocus");
      return true;
    case "up":
    case "down":
      scroll(0, action === "up" ? -SCROLL_STEP : SCROLL_STEP);
      return true;
    case "left":
    case "right": {
      // Page entière : gauche / droite tournent les pages ; agrandie : elles la déplacent.
      if (m.zoom === 1) turn(action === "left" ? -1 : 1);
      else scroll(action === "left" ? -SCROLL_STEP : SCROLL_STEP, 0);
      return true;
    }
    default:
      return true;
  }
}

export function ManualReader({ view, status, footerStart }: { view: ManualView; status: ReactNode; footerStart?: ReactNode }) {
  const shown = view.spreads[view.spread] ?? [];
  const label = !view.pages || !shown.length ? "…" : shown.length > 1 ? `${ct("manualPages")} ${shown.join("-")} / ${view.pages}` : ct("manualPage", { page: shown[0], pages: view.pages });
  return (
    <div className="nier-root nier-manual">
      <style>{MANUAL_CSS}</style>
      <header className="nier-header">
        <h1 className="nier-title" data-length={view.title.length > 34 ? "very-long" : view.title.length > 22 ? "long" : undefined}>
          {view.title}
        </h1>
        <div className="nier-header-status">{status}</div>
      </header>
      <div className="nier-rule" aria-hidden="true" />
      <main className="nier-manual-body">
        <div className="nier-detail-header nier-manual-bar">
          <span>{label}</span>
          <span>{view.loading ? ct("manualLoading") : `${ct("manualZoom")} ${Math.round(view.zoom * 100)} %`}</span>
        </div>
        <div
          className="nier-manual-stage"
          data-zoom={view.zoom > 1}
          data-loading={view.loading}
          ref={(el) => {
            stage = el;
          }}
        >
          {view.error ? (
            <p className="nier-game-description">{ct("error", { error: view.error })}</p>
          ) : (
            view.urls.length > 0 && (
              // Double page : les deux pages côte à côte, comme un livret ouvert.
              <div className="nier-manual-spread" data-pages={view.urls.length} style={{ height: `${view.zoom * 100}%`, ["--pages" as string]: view.urls.length }}>
                {view.urls.map((url) => (
                  <img key={url} className="nier-manual-page" src={url} alt="" />
                ))}
              </div>
            )
          )}
        </div>
      </main>
      <footer className="nier-footer">
        <div className="nier-footer-group">{footerStart}</div>
        <div className="nier-footer-group">
          <NierHint button={["L1", "R1"]} label={ct("manualPages")} />
          <NierHint button={["L2", "R2"]} label={ct("manualZoom")} />
          {view.zoom > 1 && <NierHint button="UPDOWN" label={ct("manualScroll")} />}
          <NierHint button="B" label={ct("manualClose")} />
        </div>
      </footer>
    </div>
  );
}

export const MANUAL_CSS = `
.nier-root.nier-manual {
  position: absolute;
  inset: 0;
  z-index: 40;
}
.nier-manual-body {
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 16px var(--nier-gutter) 12px;
}
.nier-manual-bar {
  display: flex;
  justify-content: space-between;
}
.nier-manual-stage {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: auto;
  padding: 10px;
  background-color: var(--nier-mid-trans);
}
.nier-manual-spread {
  margin: auto;
  flex: none;
  display: flex;
}
.nier-manual-page {
  flex: none;
  display: block;
  height: 100%;
  width: auto;
  object-fit: contain;
  filter: drop-shadow(5px 5px 0 var(--nier-shadow));
}
/* Page suivante en cours de rendu : l'ancienne s'estompe, l'appui se voit tout de suite. */
.nier-manual-stage[data-loading="true"] .nier-manual-spread {
  opacity: 0.35;
  transition: opacity 120ms linear;
}
/* Zoom 100 % : la double page entière tient dans l'écran (chaque page, sa moitié de largeur). */
.nier-manual-stage[data-zoom="false"] .nier-manual-page {
  max-width: calc((100vw - 2 * var(--nier-gutter) - 24px) / var(--pages));
}
`;
