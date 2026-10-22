// Rappel du morceau en cours dans le pied de page (Y : pause / lecture) ; un appui ouvre
// Système → Musique en cours dans le launcher.
import { NierNowPlaying } from "../nier-ui";
import { useNowPlaying } from "./audio";
import { useSettings } from "./settings";

// Demande d'affichage de « Musique en cours », lue par le launcher (même s'il
// n'est pas encore affiché : depuis la page de jeu ouverte par Steam).
let pending = false;
const listeners = new Set<() => void>();

export function requestMusicView() {
  pending = true;
  listeners.forEach((l) => l());
}

/** Consomme la demande en attente ; `listener` est appelé pour les suivantes. */
export function onMusicViewRequest(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function takeMusicViewRequest(): boolean {
  const was = pending;
  pending = false;
  return was;
}

export function MusicFooter({ onClick }: { onClick?: () => void }) {
  const [settings] = useSettings();
  const now = useNowPlaying(true);
  if (!settings.musicEnabled || !now.track) return null;
  return (
    <NierNowPlaying title={now.track.title} progress={now.duration ? now.position / now.duration : 0} paused={now.paused} onClick={onClick} />
  );
}
