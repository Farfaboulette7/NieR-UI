// Écran « Lancement en cours » : de l'appui sur Jouer jusqu'au démarrage du jeu.
// Composant global de Decky (routerHook.addGlobalComponent) : il reste affiché
// par-dessus tout, y compris quand Steam change de page au lancement, ce qui
// cache sa transition et son attente.
import { Router } from "@decky/ui";
import { useEffect, useState } from "react";
import { NierLaunchOverlay } from "../nier-ui";
import { t } from "./i18n";

interface Launch {
  appid: number;
  name: string;
  startedAt: number;
}

let current: Launch | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Le jeu a démarré depuis ce délai : sa fenêtre est passée devant, l'écran peut partir. */
const AFTER_START_MS = 4000;
/** Le jeu ne démarre pas (erreur, téléchargement requis...) : on rend la main. */
const GIVE_UP_MS = 60_000;
const FADE_MS = 400;

export function startLaunchScreen(appid: number, name: string) {
  current = { appid, name, startedAt: Date.now() };
  emit();
}

export function endLaunchScreen() {
  if (!current) return;
  current = null;
  emit();
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
    let startedAt = 0;
    const iv = setInterval(() => {
      const now = Date.now();
      if (runningAppid() != null && !startedAt) startedAt = now;
      const done =
        (startedAt && now - startedAt > AFTER_START_MS) || now - launch.startedAt > GIVE_UP_MS || dialogOpen(doc);
      if (done) {
        clearInterval(iv);
        setClosing(true);
        setTimeout(endLaunchScreen, FADE_MS);
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
      <NierLaunchOverlay heading={t("launchingHeading")} title={launch.name} closing={closing} />
    </div>
  );
}
