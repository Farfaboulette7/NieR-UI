// Collections (catégories) Steam d'un jeu : lesquelles le contiennent, et
// ajout / retrait comme dans Steam. Approche des plugins de collections :
// collectionStore.userCollections et AsDragDropCollection().AddApps / RemoveApps.
// Les collections dynamiques (filtres) se remplissent seules : lecture seule.

declare const collectionStore: any;
declare const appStore: any;

export interface GameCollection {
  id: string;
  name: string;
  /** Le jeu en fait partie. */
  member: boolean;
  /** Collection dynamique : Steam la remplit selon ses filtres. */
  dynamic: boolean;
}

function contains(c: any, appid: number): boolean {
  try {
    if (c?.apps?.has) return !!c.apps.has(appid);
    return (c?.allApps ?? c?.visibleApps ?? []).some((a: any) => Number(a?.appid) === appid);
  } catch {
    return false;
  }
}

function allCollections(): any[] {
  const out: any[] = [];
  try {
    const fav = collectionStore?.GetCollection?.("favorite");
    if (fav) out.push(fav);
    for (const c of collectionStore?.userCollections ?? []) {
      if (!c?.id || c.id === "favorite" || c.id === "hidden" || out.includes(c)) continue;
      out.push(c);
    }
  } catch {
    /* ignore */
  }
  return out;
}

/** Collections du compte, avec l'appartenance du jeu (favoris en tête, puis par nom). */
export function gameCollections(appid: number): GameCollection[] {
  const list = allCollections().map((c) => ({
    id: String(c.id),
    name: String(c.displayName || c.id),
    member: contains(c, appid),
    dynamic: !!c.bIsDynamic || typeof c.AsDragDropCollection !== "function",
  }));
  const [fav, ...rest] = list[0]?.id === "favorite" ? list : [undefined, ...list];
  rest.sort((a, b) => a!.name.localeCompare(b!.name, undefined, { numeric: true, sensitivity: "base" }));
  return (fav ? [fav, ...rest] : rest) as GameCollection[];
}

/** Ajoute le jeu à la collection, ou l'en retire. false si Steam a refusé. */
export function setInCollection(collectionId: string, appid: number, member: boolean): boolean {
  try {
    const c = allCollections().find((x) => String(x.id) === collectionId);
    const overview = appStore?.GetAppOverviewByAppID?.(appid);
    const editable = c?.AsDragDropCollection?.();
    if (!editable || !overview) return false;
    if (member) editable.AddApps([overview]);
    else editable.RemoveApps([overview]);
    return true;
  } catch (e) {
    console.error("[NieRDeck] collection", e);
    return false;
  }
}

// ───────────── Images (plugin SteamGridDB) ─────────────

/** Le plugin Decky SteamGridDB est installé. */
export function hasSteamGridDb(): boolean {
  try {
    const plugins: any[] = (window as any).DeckyPluginLoader?.plugins ?? [];
    return plugins.some((p) => /steamgriddb/i.test(String(p?.name ?? "")));
  } catch {
    return false;
  }
}

/** Écran « Modifier les images » du plugin SteamGridDB pour ce jeu. */
export const steamGridDbRoute = (appid: number) => `/steamgriddb/manage/${appid}`;
