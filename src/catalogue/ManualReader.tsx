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
  const label = view.pages ? ct("manualPage", { page: view.page, pages: view.pages }) : "…";
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
          ref={(el) => {
            stage = el;
          }}
        >
          {view.error ? (
            <p className="nier-game-description">{ct("error", { error: view.error })}</p>
          ) : (
            view.url && <img className="nier-manual-page" src={view.url} alt={label} style={view.zoom > 1 ? { height: `${view.zoom * 100}%` } : undefined} />
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
.nier-manual-page {
  margin: auto;
  flex: none;
  display: block;
  height: 100%;
  max-width: 100%;
  object-fit: contain;
  box-shadow: 6px 6px 0 var(--nier-shadow);
  background-color: #fff;
}
.nier-manual-stage[data-zoom="true"] .nier-manual-page {
  max-width: none;
  width: auto;
}
`;
