// Bruitages YoRHa et musique de fond, lus depuis les fichiers copiés sur le
// Deck (voir main.py : ils ne sont pas livrés avec le plugin). Le backend les
// sert sur 127.0.0.1 ; ici on les joue :
//  - bruitages : Web Audio (tampons décodés une fois, sans latence) ;
//  - musique : un élément <audio>, morceau au hasard, fondu à l'entrée et à la sortie.
// Approche reprise de benderthemes (steam.ts : playSound, musique de thème).
import { callable } from "@decky/api";
import { Router } from "@decky/ui";
import { useEffect, useState, type RefObject } from "react";
import { getSettings, onSettingsChange } from "./settings";

export interface MusicTrack {
  id: string;
  title: string;
  number: number | null;
  /** Image de l'onde sonore (même nom que le morceau), si présente. */
  wave: string | null;
}

interface MediaInfo {
  base: string | null;
  sfx: Record<string, string>;
  sfxDir: string | null;
  music: MusicTrack[];
  musicDir: string;
  error?: string;
}

const getMedia = callable<[], MediaInfo>("get_media");

let media: MediaInfo | null = null;
let mediaAsk: Promise<MediaInfo | null> | null = null;
const mediaListeners = new Set<() => void>();

/** Liste des fichiers audio ; `refresh` relit les dossiers (après une copie de musique). */
export function loadMedia(refresh = false): Promise<MediaInfo | null> {
  if (media && !refresh) return Promise.resolve(media);
  if (!mediaAsk) {
    mediaAsk = getMedia()
      .then((m) => {
        media = m;
        mediaListeners.forEach((l) => l());
        return m;
      })
      .catch((e) => {
        console.error("[NieRDeck] sons et musique", e);
        return null;
      })
      .finally(() => (mediaAsk = null));
  }
  return mediaAsk;
}

export const mediaUrl = (id: string | null | undefined) => (id && media?.base ? `${media.base}/${id}` : null);

export function useMedia(): MediaInfo | null {
  const [, setRev] = useState(0);
  useEffect(() => {
    const l = () => setRev((r) => r + 1);
    mediaListeners.add(l);
    void loadMedia();
    return () => {
      mediaListeners.delete(l);
    };
  }, []);
  return media;
}

// La fenêtre où l'on joue le son : celle qui affiche le launcher.
let audioWindow: any = window;
export function setAudioWindow(win: Window | null | undefined) {
  if (win && win !== audioWindow) {
    audioWindow = win;
    ctx = null;
    buffers.clear();
  }
}

const volumeOf = (percent: number | undefined) => Math.max(0, Math.min(1, (percent ?? 0) / 100));

// ───────────── Bruitages ─────────────

export type Sfx = "move" | "tab" | "confirm" | "open" | "close" | "back" | "launch" | "toggleOn" | "toggleOff" | "volumeUp" | "volumeDown" | "focus" | "unfocus";

/** Fichiers du pack « YoRHa Decky » (noms des sons de l'interface Steam). */
const SFX_FILES: Record<Sfx, string> = {
  move: "deck_ui_navigation.wav",
  tab: "deck_ui_tab_transition_01.wav",
  confirm: "deck_ui_default_activation.wav",
  open: "deck_ui_into_game_detail.wav",
  close: "deck_ui_out_of_game_detail.wav",
  back: "deck_ui_hide_modal.wav",
  launch: "deck_ui_launch_game.wav",
  toggleOn: "deck_ui_switch_toggle_on.wav",
  toggleOff: "deck_ui_switch_toggle_off.wav",
  volumeUp: "deck_ui_slider_up.wav",
  volumeDown: "deck_ui_slider_down.wav",
  focus: "deck_ui_show_modal.wav",
  unfocus: "deck_ui_hide_modal.wav",
};

let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();

function audioContext(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const AC = audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? AudioContext;
    ctx = new AC();
  } catch {
    ctx = null;
  }
  return ctx;
}

function loadBuffer(url: string): Promise<AudioBuffer | null> {
  let p = buffers.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((data) => (data ? audioContext()?.decodeAudioData(data) ?? null : null))
      .catch(() => null);
    buffers.set(url, p);
  }
  return p;
}

/** Décode les bruitages à l'avance, pour que le premier ne soit pas en retard. */
export async function preloadSfx() {
  const m = await loadMedia();
  if (!m) return;
  for (const file of Object.values(SFX_FILES)) {
    const url = mediaUrl(m.sfx[file]);
    if (url) void loadBuffer(url);
  }
}

let lastMove = 0;
export function playSfx(kind: Sfx) {
  const volume = volumeOf(getSettings().sfxVolume);
  if (!volume || !media) return;
  // D-pad maintenu : pas d'empilement de clics.
  const now = Date.now();
  if (kind === "move") {
    if (now - lastMove < 45) return;
    lastMove = now;
  }
  const url = mediaUrl(media.sfx[SFX_FILES[kind]]);
  const c = audioContext();
  if (!url || !c) return;
  const resumed = c.state === "suspended" ? c.resume().catch(() => {}) : Promise.resolve();
  void Promise.all([loadBuffer(url), resumed]).then(([buffer]) => {
    if (!buffer) return;
    try {
      const source = c.createBufferSource();
      const gain = c.createGain();
      gain.gain.value = volume;
      source.buffer = buffer;
      source.connect(gain).connect(c.destination);
      source.start();
    } catch {
      /* contexte fermé */
    }
  });
}

// ───────────── Musique de fond ─────────────
// Jouée tant qu'un écran NieRDeck est visible et qu'aucun jeu ne tourne.

let audio: HTMLAudioElement | null = null;
let track: MusicTrack | null = null;
let fade = 0; // 0..1, multiplié par le volume choisi
let fadeTimer: ReturnType<typeof setInterval> | null = null;
let stoppedAt = 0;
const present = new Set<symbol>();
const musicListeners = new Set<() => void>();
const emitMusic = () => musicListeners.forEach((l) => l());

const FADE_STEP = 0.05;
const FADE_MS = 40;
/** Absence plus longue que ça : on repart sur un nouveau morceau au retour. */
const NEW_TRACK_AFTER_MS = 30_000;

function pickTrack(): MusicTrack | null {
  const list = media?.music ?? [];
  if (!list.length) return null;
  const others = list.length > 1 ? list.filter((t) => t.id !== track?.id) : list;
  return others[Math.floor(Math.random() * others.length)];
}

function applyVolume() {
  if (audio) audio.volume = Math.max(0, Math.min(1, volumeOf(getSettings().musicVolume) * fade));
}

function fadeTo(target: number, done?: () => void) {
  if (fadeTimer) clearInterval(fadeTimer);
  fadeTimer = setInterval(() => {
    fade = Math.abs(target - fade) <= FADE_STEP ? target : fade + Math.sign(target - fade) * FADE_STEP;
    applyVolume();
    if (fade === target) {
      if (fadeTimer) clearInterval(fadeTimer);
      fadeTimer = null;
      done?.();
    }
  }, FADE_MS);
}

function play(next: MusicTrack) {
  const url = mediaUrl(next.id);
  if (!url) return;
  if (!audio) {
    audio = new (audioWindow.Audio ?? Audio)() as HTMLAudioElement;
    audio.preload = "auto";
    audio.addEventListener("ended", () => {
      const t = pickTrack();
      if (t) play(t);
    });
  }
  track = next;
  audio.src = url;
  applyVolume();
  audio.play().catch((e) => console.error("[NieRDeck] musique", e));
  emitMusic();
}

function wanted(): boolean {
  return present.size > 0 && volumeOf(getSettings().musicVolume) > 0 && !!media?.music.length && !gameRunning();
}

function gameRunning(): boolean {
  try {
    return !!Router.MainRunningApp;
  } catch {
    return false;
  }
}

function syncMusic() {
  const playing = !!audio && !audio.paused;
  if (wanted()) {
    if (!playing) {
      const fresh = !track || Date.now() - stoppedAt > NEW_TRACK_AFTER_MS;
      if (fresh) {
        const t = pickTrack();
        if (!t) return;
        fade = 0;
        play(t);
      } else {
        audio?.play().catch(() => {});
      }
    }
    fadeTo(1);
  } else if (playing) {
    fadeTo(0, () => {
      audio?.pause();
      stoppedAt = Date.now();
      emitMusic();
    });
  }
}

onSettingsChange(() => {
  applyVolume();
  syncMusic();
});

/** Morceau suivant (au hasard). */
export function nextTrack() {
  const t = pickTrack();
  if (!t) return;
  fade = 1;
  play(t);
}

/** Arrêt immédiat (déchargement du plugin). */
export function stopMusic() {
  if (fadeTimer) clearInterval(fadeTimer);
  fadeTimer = null;
  present.clear();
  audio?.pause();
  audio = null;
  track = null;
}

/**
 * Signale un écran NieRDeck : la musique joue tant qu'il est vraiment visible
 * (aucune autre page Steam par-dessus, aucun jeu lancé). Vérifié chaque seconde.
 */
export function useMusicPresence(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const me = Symbol("screen");
    const check = () => {
      const el = rootRef.current;
      const doc = el?.ownerDocument;
      const view = doc?.defaultView;
      let visible = false;
      if (el && doc && view) {
        const hit = doc.elementFromPoint(view.innerWidth / 2, view.innerHeight / 2);
        visible = !!hit && el.contains(hit);
      }
      const changed = visible !== present.has(me);
      if (visible) present.add(me);
      else present.delete(me);
      if (changed || visible) syncMusic();
    };
    setAudioWindow(rootRef.current?.ownerDocument?.defaultView);
    void loadMedia().then(() => {
      check();
      void preloadSfx();
    });
    const iv = setInterval(check, 1000);
    return () => {
      clearInterval(iv);
      present.delete(me);
      // Laisse le temps à l'écran suivant (launcher → page de jeu) de se signaler.
      setTimeout(syncMusic, 600);
    };
  }, []);
}

export interface NowPlaying {
  track: MusicTrack | null;
  playing: boolean;
  position: number;
  duration: number;
}

/** Morceau en cours, rafraîchi deux fois par seconde (pour l'onglet Système). */
export function useNowPlaying(enabled: boolean): NowPlaying {
  const read = (): NowPlaying => ({
    track,
    playing: !!audio && !audio.paused,
    position: audio?.currentTime ?? 0,
    duration: Number.isFinite(audio?.duration) ? (audio?.duration ?? 0) : 0,
  });
  const [state, setState] = useState(read);
  useEffect(() => {
    if (!enabled) return;
    const update = () => setState(read());
    musicListeners.add(update);
    const iv = setInterval(update, 500);
    return () => {
      musicListeners.delete(update);
      clearInterval(iv);
    };
  }, [enabled]);
  return state;
}
