// Écran « Lancement en cours » : de l'appui sur Jouer jusqu'au démarrage du jeu.
// Composant global de Decky (routerHook.addGlobalComponent) : il reste affiché
// par-dessus tout, y compris quand Steam change de page au lancement, ce qui
// cache sa transition et son attente. Pendant ce temps, les écrans NieRDeck
// ignorent la manette (voir NierScreen) ; si le jeu tarde, B force son arrêt.
import { Router } from "@decky/ui";
import { useEffect, useState } from "react";
import { NierHint, NierLaunchOverlay } from "../nier-ui";
import { t } from "./i18n";

declare const SteamClient: any;

interface Launch {
  appid: number;
  /** Identifiant attendu par les API de lancement (diffère de l'appid pour les raccourcis). */
  gameid: string;
  name: string;
  startedAt: number;
}

let current: Launch | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Le jeu a démarré depuis ce délai : sa fenêtre est passée devant, l'écran peut partir. */
const AFTER_START_MS = 4000;
/** Le jeu tarde : B permet de forcer son arrêt (comme Steam). */
const CANCEL_AFTER_MS = 10_000;
/** Le jeu ne démarre pas (erreur, téléchargement requis...) : on rend la main. */
const GIVE_UP_MS = 90_000;
const FADE_MS = 400;

export function startLaunchScreen(appid: number, gameid: string, name: string) {
  current = { appid, gameid, name, startedAt: Date.now() };
  emit();
}

export function endLaunchScreen() {
  if (!current) return;
  current = null;
  emit();
}

/** Un lancement est affiché : la manette ne doit plus agir sur le launcher. */
export const isLaunching = () => current !== null;

/** B pendant le lancement : arrête le jeu s'il tarde. true si l'arrêt a été demandé. */
export function cancelLaunchIfSlow(): boolean {
  if (!current || Date.now() - current.startedAt < CANCEL_AFTER_MS) return false;
  const { gameid } = current;
  try {
    SteamClient?.Apps?.CancelLaunch?.(gameid);
  } catch (e) {
    console.error("[NieRDeck] annulation du lancement", e);
  }
  try {
    SteamClient?.Apps?.TerminateApp?.(gameid, false);
  } catch (e) {
    console.error("[NieRDeck] arrêt du jeu", e);
  }
  endLaunchScreen();
  return true;
}

function runningAppid(): number | null {
  try {
    const app: any = Router.MainRunningApp;
    return app ? Number(app.appid) : null;
  } catch {
    return null;
  }
}

/** Une boîte de dialogue Steam est ouverte (choix de version, nuage Steam...) : elle doit rester visible. */
function dialogOpen(doc: Document | undefined): boolean {
  return !!doc?.querySelector(".ModalOverlayContent .DialogContent");
}

export function LaunchScreen() {
  const [launch, setLaunch] = useState<Launch | null>(current);
  const [closing, setClosing] = useState(false);
  const [slow, setSlow] = useState(false);
  const [doc, setDoc] = useState<Document>();

  useEffect(() => {
    const l = () => setLaunch(current);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  // Surveille le démarrage du jeu.
  useEffect(() => {
    if (!launch) return;
    setClosing(false);
    setSlow(false);
    let startedAt = 0;
    const iv = setInterval(() => {
      const now = Date.now();
      if (runningAppid() != null && !startedAt) startedAt = now;
      setSlow(!startedAt && now - launch.startedAt >= CANCEL_AFTER_MS);
      const done = (startedAt && now - startedAt > AFTER_START_MS) || now - launch.startedAt > GIVE_UP_MS || dialogOpen(doc);
      if (done) {
        clearInterval(iv);
        setClosing(true);
        setTimeout(() => current === launch && endLaunchScreen(), FADE_MS);
      }
    }, 250);
    return () => clearInterval(iv);
  }, [launch, doc]);

  if (!launch) return null;
  return (
    <div
      ref={(el) => {
        if (el && el.ownerDocument !== doc) setDoc(el.ownerDocument);
      }}
      style={{ display: "contents" }}
    >
      <NierLaunchOverlay
        heading={t("launchingHeading")}
        title={launch.name}
        closing={closing}
        hint={slow ? <NierHint button="B" label={t("forceQuit")} /> : undefined}
      />
    </div>
  );
}
