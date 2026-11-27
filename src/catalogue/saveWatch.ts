// Sauvegardes des jeux du Catalogue, suivies depuis Steam (le jeu est lancé par Steam avec
// « FarfaLauncherDeck jouer <id> », pas par NieRDeck) :
// - fermeture d'un jeu : « Sauvegarde envoyée ✓ », « en attente (hors ligne) », « non envoyée : … » ;
// - mise en veille avec un jeu ouvert : la sauvegarde part sans fermer le jeu (moteur : `veille`) ;
// - sortie de veille : prévient si la sauvegarde a changé sur un autre appareil (moteur : `reveil`).
// API vérifiées par CDP : GameSessions.RegisterForAppLifetimeNotifications,
// User.RegisterForPrepareForSystemSuspendProgress, User.RegisterForResumeSuspendedGamesProgress.
import { callable, toaster } from "@decky/api";
import { ct, type CatKey } from "./i18n";
import type { CliResult } from "./store";

declare const SteamClient: any;

const call = callable<[args: (string | number)[]], CliResult<any>>("catalogue_call");
const shortcuts = callable<[], Record<string, number>>("catalogue_shortcuts");

/** Dernier envoi d'un jeu, écrit par le moteur (`resultat`, `veille`). */
interface SaveResult {
  romId: number;
  name?: string | null;
  moment?: "fin" | "veille";
  save?: string;
  noSaveDir?: boolean;
  error?: { code: string; message: string } | null;
  timeout?: boolean;
}

const now = () => Math.floor(Date.now() / 1000);

/** Parties en cours d'un jeu du Catalogue : appid du raccourci → jeu et début. */
const running = new Map<number, { romId: number; since: number }>();

async function romOf(appid: number): Promise<number | null> {
  try {
    const map = await shortcuts();
    for (const [rom, a] of Object.entries(map)) if (Number(a) === appid) return Number(rom);
  } catch (e) {
    console.error("[NieRDeck] raccourcis du Catalogue", e);
  }
  return null;
}

function resultKey(r: SaveResult): CatKey | null {
  switch (r.save) {
    case "uploaded":
      return "saveUploaded";
    case "uploadedKeptOther":
      return "saveUploadedKeptOther";
    case "serverNewer":
      return "saveServerNewer";
    case "pending":
      return "savePending";
    case "conflict":
      return "saveConflict";
    case "failed":
      return "saveFailed";
    case "unchanged":
      return r.moment === "veille" ? null : "saveUnchanged";
    case "off":
      return r.noSaveDir ? "saveNoDir" : null;
    default:
      return null;
  }
}

function toastResult(r: SaveResult) {
  const key = resultKey(r);
  if (!key) return;
  const body = ct(key, { error: r.error?.message ?? "?" });
  toaster.toast({ title: r.name || "NieRDeck", body: r.moment === "veille" ? `${ct("saveBeforeSleep")} ${body}` : body });
}

async function onLifetime(n: any) {
  const appid = Number(n?.unAppID);
  if (!appid) return;
  if (n.bRunning) {
    const romId = await romOf(appid);
    if (romId != null) running.set(appid, { romId, since: now() });
    return;
  }
  // Plugin rechargé pendant la partie : le jeu est retrouvé à sa fermeture.
  const known = running.get(appid);
  running.delete(appid);
  const romId = known?.romId ?? (await romOf(appid));
  if (romId == null) return;
  const since = known?.since ?? now() - 600;
  // Le résultat est écrit par `jouer` (ou par le veilleur si Steam l'a arrêté) : attendu 60 s au plus.
  const r = await call(["resultat", romId, since, 60]);
  // Erreur du moteur (moteur d'avant sans `resultat`…) : ce n'est pas un échec de la sauvegarde.
  if (r.data) toastResult(r.data as SaveResult);
  else if (r.error) console.warn("[NieRDeck] résultat de la sauvegarde illisible", r.error, r.message);
}

let lastSuspend = 0;
/** Résultats de l'envoi à la mise en veille, montrés au réveil. */
let sleepResults: SaveResult[] = [];

async function onSuspend() {
  if (Date.now() - lastSuspend < 30_000) return;
  lastSuspend = Date.now();
  // Le moteur retrouve lui-même les parties en cours (rien à faire s'il n'y en a pas).
  const r = await call(["veille", 8]);
  sleepResults = (r.data?.games ?? []) as SaveResult[];
}

let lastResume = 0;
async function onResume() {
  if (Date.now() - lastResume < 60_000) return;
  lastResume = Date.now();
  for (const res of sleepResults.splice(0)) if (!res.timeout) toastResult({ ...res, moment: "veille" });
  const r = await call(["reveil"]);
  for (const g of (r.data?.games ?? []) as { name: string; changed: boolean }[]) {
    if (g.changed) toaster.toast({ title: g.name, body: ct("saveChangedElsewhere"), duration: 15_000 } as any);
  }
}

/** Branche les abonnements ; renvoie de quoi les retirer. */
export function bindSaveWatch(): () => void {
  const regs: any[] = [];
  const reg = (f: () => any, what: string) => {
    try {
      const r = f();
      if (r) regs.push(r);
    } catch (e) {
      console.error(`[NieRDeck] ${what}`, e);
    }
  };
  reg(() => SteamClient.GameSessions.RegisterForAppLifetimeNotifications((n: any) => void onLifetime(n)), "fin des jeux");
  reg(() => SteamClient.User.RegisterForPrepareForSystemSuspendProgress(() => void onSuspend()), "mise en veille");
  reg(() => SteamClient.User.RegisterForResumeSuspendedGamesProgress(() => void onResume()), "sortie de veille");
  // Les minuteries s'arrêtent pendant la veille : un grand saut la trahit aussi.
  let lastTick = Date.now();
  const tick = setInterval(() => {
    const t = Date.now();
    if (t - lastTick > 30_000) void onResume();
    lastTick = t;
  }, 5_000);
  return () => {
    clearInterval(tick);
    for (const r of regs) {
      try {
        r?.unregister?.();
      } catch {
        /* déjà libéré */
      }
    }
  };
}
