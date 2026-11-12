// Page Steam d'un jeu du Catalogue : un raccourci non-Steam qui lance
// « FarfaLauncherDeck jouer <id> » (sauvegarde du serveur, réglages, jeu, envoi
// de la sauvegarde), avec les visuels de RomM.
import { callable } from "@decky/api";

declare const SteamClient: any;
declare const appStore: any;

const setShortcutMapping = callable<[romId: number, appid: number], Record<string, number>>("catalogue_set_shortcut");
const imageBase64 = callable<[url: string], { data: string; format: string } | null>("catalogue_image_base64");

// Types de visuels de SetCustomArtworkForApp.
const ART_CAPSULE = 0; // jaquette verticale (grille de la bibliothèque)
const ART_HERO = 1; // grande image en haut de la page du jeu
const ART_WIDE = 3; // vignette horizontale (récents)

/** Identifiant attendu par RunGame pour un raccourci. */
export const shortcutGameId = (appid: number) => String((BigInt(appid) << 32n) | 0x02000000n);

const shortcutExists = (appid: number) => {
  try {
    return !!appStore?.GetAppOverviewByAppID?.(appid);
  } catch {
    return false;
  }
};

async function setArtwork(appid: number, url: string | null | undefined, kinds: number[]) {
  if (!url) return;
  const img = await imageBase64(url);
  if (!img) return;
  for (const kind of kinds) {
    try {
      await SteamClient.Apps.SetCustomArtworkForApp(appid, img.data, img.format, kind);
    } catch (e) {
      console.error("[NieRDeck] visuel du raccourci", e);
    }
  }
}

/** Crée le raccourci (ou garde celui qui existe) et pose ses visuels. Renvoie la table jeu → appid. */
export async function createShortcut(
  romId: number,
  name: string,
  cliPath: string,
  existing: number | undefined,
  art: { cover: string | null; hero: string | null },
): Promise<Record<string, number>> {
  const dir = cliPath.slice(0, cliPath.lastIndexOf("/"));
  const options = `jouer ${romId}`;
  let appid = existing && shortcutExists(existing) ? existing : 0;
  if (!appid) {
    appid = await SteamClient.Apps.AddShortcut(name, `"${cliPath}"`, `"${dir}"`, options);
  }
  // Selon les versions de Steam, AddShortcut ignore le nom ou les options : posés à nouveau.
  SteamClient.Apps.SetShortcutName(appid, name);
  SteamClient.Apps.SetShortcutExe(appid, `"${cliPath}"`);
  SteamClient.Apps.SetShortcutStartDir(appid, `"${dir}"`);
  SteamClient.Apps.SetShortcutLaunchOptions(appid, options);
  const mapping = await setShortcutMapping(romId, appid);
  await setArtwork(appid, art.cover, [ART_CAPSULE]);
  // Pas d'image large sur RomM : une capture d'écran, sinon la jaquette.
  await setArtwork(appid, art.hero ?? art.cover, [ART_HERO, ART_WIDE]);
  return mapping;
}

export async function removeShortcut(romId: number, appid: number): Promise<Record<string, number>> {
  try {
    if (shortcutExists(appid)) SteamClient.Apps.RemoveShortcut(appid);
  } catch (e) {
    console.error("[NieRDeck] suppression du raccourci", e);
  }
  return setShortcutMapping(romId, 0);
}
