// Onglet « Farfa project » : les jeux du serveur RomM de FarfaLauncher, par console. A sur un
// jeu ouvre sa page (gamePage.tsx : les onglets de la page de jeu du launcher). Et l'entrée
// Système → FarfaLauncher (serveur, jeton, moteur, sauvegardes).
// Même structure que les autres onglets (TabView) : NieRDeck dessine, ce module
// fournit le contenu.
import type { ReactNode } from "react";
import { NierGameDetail, NierMeter, NierOptionList, type NierMenuItem } from "../nier-ui";
import { playSfx } from "../launcher/audio";
import type { PanelDef, TabView } from "../launcher/tabView";
import { ct, type CatKey } from "./i18n";
import { promptText } from "./prompt";
import { CatBoxArt, hasBox } from "./boxArt";
import { fullDetails, gamePageView, isInstalled, kindLabel } from "./gamePage";
import { checkRa, loadRa, openRaProfile, raState } from "./store";
import { myReportsView, myRequestsView, requestsCount, unreadReports } from "./community";
import { friendsPresent, friendsView, newVersion, statsView, versionsView } from "./social";
import {
  CAT_KINDS,
  configure,
  gameBadge,
  imageUrl,
  isNewGame,
  loadConsoles,
  loadDetails,
  logout,
  matchesKind,
  setOpenGame,
  setOpenList,
  stepKind,
  syncSaves,
  toggleFavorite,
  updateEngine,
  type CatGame,
  type CatKind,
  type catalogueState,
} from "./store";

type CatState = ReturnType<typeof catalogueState>;

const Text = ({ children }: { children: ReactNode }) => (
  <p className="nier-game-description" style={{ margin: "6px 0 12px" }}>
    {children}
  </p>
);

// Fiche chargée quand le curseur s'arrête sur un jeu (pas à chaque jeu survolé).
let detailTimer: ReturnType<typeof setTimeout> | undefined;
let detailWanted: number | undefined;
function wantDetails(cat: CatState, romId: number) {
  if (cat.details[romId] || detailWanted === romId) return;
  detailWanted = romId;
  clearTimeout(detailTimer);
  detailTimer = setTimeout(() => {
    detailWanted = undefined;
    void loadDetails(romId);
  }, 350);
}

const listTitle = (cat: CatState, key: string) => {
  if (key === "installed") return ct("installed");
  if (key === "favorites") return ct("favorites");
  if (key.startsWith("search:")) return ct("searchResults", { term: key.slice(7) });
  const id = Number(key.slice(8));
  return id === -1 ? ct("recomps") : (cat.consoles?.find((c) => c.id === id)?.name ?? ct("games"));
};

/** Aperçu d'un jeu dans la liste ; A ouvre sa page. */
function gamePreview(cat: CatState, romId: number, game: CatGame | undefined): ReactNode {
  const d = fullDetails(cat, romId);
  const progress = cat.progress[romId];
  const box = { boxFaces: d?.game?.boxFaces ?? game?.boxFaces, box3dUrl: d?.game?.box3dUrl ?? game?.box3dUrl, coverUrl: d?.game?.coverUrl ?? game?.coverUrl };
  // Avec une boîte, la jaquette à plat n'est pas téléchargée.
  const local = hasBox(box) ? undefined : imageUrl(box.coverUrl);
  const status = game && gameBadge(game) ? gameBadge(game)! : progress ? ct("statusInstalling") : isInstalled(cat, romId, game) ? ct("statusInstalled") : ct("statusNotInstalled");
  const failed = cat.details[romId];
  const error = failed && typeof failed === "object" && "error" in failed ? failed.error : undefined;
  return (
    <div>
      <NierGameDetail
        image={local}
        imageAlt={game?.name ?? d?.game?.name}
        visual={hasBox(box) ? <CatBoxArt key={romId} source={box} /> : undefined}
        compact
        actions={
          progress && (
            <NierMeter
              label={ct(`phase_${progress.phase}` as CatKey) ?? progress.phase}
              value={progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}
              mutedLabel="…"
            />
          )
        }
        fields={[
          { label: ct("console"), value: d?.game?.console || game?.console || "—" },
          { label: ct("year"), value: String(d?.game?.releaseYear ?? game?.releaseYear ?? "—") },
          { label: ct("kind"), value: kindLabel(game, d) },
          { label: ct("status"), value: status },
        ]}
      />
      {error && <Text>{ct("error", { error })}</Text>}
      {!error && d?.game?.summary && <Text>{d.game.summary}</Text>}
    </div>
  );
}

/** Page du jeu ouvert, glissée par-dessus la liste comme la page d'un jeu Steam ; null sinon. */
export function catalogueGameView(cat: CatState): TabView | null {
  const open = cat.openList;
  if (!open || cat.openGame == null) return null;
  const game = cat.lists[open]?.games.find((g) => g.id === cat.openGame);
  return gamePageView(cat, cat.openGame, game);
}

/** Onglet Catalogue : consoles, puis jeux de la console ouverte (la page du jeu est à part). */
export function catalogueView(cat: CatState): TabView {
  if (!cat.consoles) setTimeout(() => void loadConsoles(), 0);
  const open = cat.openList;
  // Messages du joueur : ses signalements (discussions avec le support) et ses demandes de jeux.
  if (open === "my-reports") return myReportsView();
  if (open === "my-requests") return myRequestsView();
  if (open === "friends") return friendsView();
  if (open === "stats") return statsView();
  if (open === "versions") return versionsView();
  if (open) {
    const list = cat.lists[open];
    // Filtre de la liste (Tous / Installés / Recomp / Émulation), comme la bibliothèque du launcher.
    const games = (list?.games ?? []).filter((g) => matchesKind(g, cat.kind));
    const find = (id?: string) => games.find((g) => `g:${g.id}` === id);
    return {
      menuTitle: `${listTitle(cat, open)}${games.length ? ` · ${games.length}` : ""}${list?.loading && games.length ? " …" : ""}`,
      items: games.map((g): NierMenuItem => {
        const badge = gameBadge(g) ?? (g.installed ? "✓" : undefined);
        const fresh = isNewGame(g);
        return {
          id: `g:${g.id}`,
          label: `${cat.favorites.has(g.id) ? "★ " : ""}${g.name}`,
          badge: fresh ? (badge ? `${ct("badgeNew")} · ${badge}` : ct("badgeNew")) : badge,
          muted: !g.installed && !cat.progress[g.id],
        };
      }),
      sub: {
        labels: CAT_KINDS.map((k) => ct(KIND_LABEL[k])),
        active: CAT_KINDS.indexOf(cat.kind),
        step: (delta) => stepKind(delta),
        hint: ct("filterHint"),
      },
      // ← → : lettre précédente / suivante (« # » : chiffres et autres alphabets).
      jump: (id, delta) => {
        const g = find(id);
        if (!g || !games.length) return undefined;
        const present = LETTERS.filter((l) => games.some((x) => letterOf(x.name) === l));
        const at = present.indexOf(letterOf(g.name));
        const next = present[(at + delta + present.length) % present.length];
        const target = games.find((x) => letterOf(x.name) === next);
        return target ? `g:${target.id}` : undefined;
      },
      jumpHint: ct("letterHint"),
      secondary: (id) => {
        const g = find(id);
        if (!g) return;
        playSfx(cat.favorites.has(g.id) ? "toggleOff" : "toggleOn");
        void toggleFavorite(g.id, g.name);
      },
      secondaryHint: (id) => {
        const g = find(id);
        // Court, le pied de page est plein ; l'étoile et la notification disent l'état.
        return g ? ct("favoriteAdd") : undefined;
      },
      detail: (id) => {
        const game = find(id);
        if (!game) {
          const msg = list?.loading
            ? ct("loading")
            : list?.error
              ? ct("error", { error: list.error })
              : cat.kind !== "all" && list?.games.length
                ? ct("emptyKind", { kind: ct(KIND_LABEL[cat.kind]) })
                : ct("empty");
          return { title: listTitle(cat, open), content: <NierGameDetail art={false} description={msg} /> };
        }
        wantDetails(cat, game.id);
        return { title: game.name, content: gamePreview(cat, game.id, game) };
      },
      activate: (id) => {
        const game = find(id);
        if (!game) return;
        playSfx("confirm");
        setOpenGame(game.id);
      },
      // Pas de « A Ouvrir » : le pied de page manque de place (filtre, lettre, favori).
      hint: () => undefined,
      back: () => {
        playSfx("back");
        setOpenList(null);
        return true;
      },
    };
  }

  const consoles = cat.consoles ?? [];
  const items: NierMenuItem[] = [
    { id: "search", label: ct("search") },
    { id: "installed", label: ct("installed"), badge: cat.status?.data?.installed ? String(cat.status.data.installed) : undefined },
    { id: "favorites", label: ct("favorites"), badge: cat.favorites.size ? String(cat.favorites.size) : undefined },
    { id: "friends", label: ct("friends"), badge: friendsPresent() ? `● ${friendsPresent()}` : undefined },
    { id: "stats", label: ct("stats") },
    { id: "my-reports", label: ct("myReports"), badge: unreadReports() ? `● ${unreadReports()}` : undefined },
    { id: "my-requests", label: ct("myRequests"), badge: requestsCount() ? String(requestsCount()) : undefined },
    { id: "versions", label: ct("versions"), badge: newVersion() ? ct("badgeNewVersion") : cat.status?.data?.version },
    ...consoles.map((c) => ({ id: `console:${c.id}`, label: c.id === -1 ? ct("recomps") : c.name, badge: String(c.romCount) })),
  ];
  return {
    menuTitle: ct("rootTitle"),
    items,
    detail: (id) => {
      if (id === "search") return { title: ct("search"), content: <NierGameDetail art={false} description={ct("searchDesc")} /> };
      if (id === "installed") return { title: ct("installed"), content: <NierGameDetail art={false} description={ct("installedDesc")} /> };
      if (id === "favorites") return { title: ct("favorites"), content: <NierGameDetail art={false} description={ct("favoritesDesc")} /> };
      if (id === "friends") return { title: ct("friends"), content: <NierGameDetail art={false} description={ct("friendsDesc")} /> };
      if (id === "stats") return { title: ct("stats"), content: <NierGameDetail art={false} description={ct("statsDesc")} /> };
      if (id === "versions") return { title: ct("versions"), content: <NierGameDetail art={false} description={ct("versionsDesc")} /> };
      if (id === "my-reports") return { title: ct("myReports"), content: <NierGameDetail art={false} description={ct("myReportsDesc")} /> };
      if (id === "my-requests") return { title: ct("myRequests"), content: <NierGameDetail art={false} description={ct("myRequestsDesc")} /> };
      const c = consoles.find((x) => `console:${x.id}` === id);
      if (!c) {
        const msg = cat.consolesError ? ct("error", { error: cat.consolesError }) : cat.consoles ? ct("noConsoles") : ct("loading");
        return { title: ct("tab"), content: <NierGameDetail art={false} description={msg} /> };
      }
      return {
        title: c.id === -1 ? ct("recomps") : c.name,
        content: <NierGameDetail art={false} description={c.id === -1 ? ct("recompsDesc") : ct("consoleDesc", { n: c.romCount })} />,
      };
    },
    activate: (id) => {
      playSfx("confirm");
      if (id === "search") {
        void promptText(ct("searchTitle"), ct("searchLabel")).then((term) => term && setOpenList(`search:${term}`));
      } else {
        setOpenList(id);
      }
    },
    hint: () => ct("actions"),
  };
}

const KIND_LABEL: Record<CatKind, CatKey> = { all: "kindAll", installed: "kindInstalled", recomp: "kindRecomp", emulation: "kindEmu" };

const LETTERS = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

/** Lettre d'un nom (letterOf du launcher) : sa première lettre sans accent, sinon « # ». */
function letterOf(name: string): string {
  const c = name.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase();
  return c >= "A" && c <= "Z" ? c : "#";
}

// ───────────── Système → FarfaLauncher ─────────────

const SETTINGS_ROWS = ["server", "token", "update", "sync", "logout"] as const;
const ROW_LABEL: Record<(typeof SETTINGS_ROWS)[number], CatKey> = {
  server: "rowServer",
  token: "rowToken",
  update: "rowUpdate",
  sync: "rowSync",
  logout: "rowLogout",
};

export const catalogueSettingsId = "farfalauncher";

export function catalogueSettingsItem(cat: CatState): NierMenuItem {
  const info = cat.status?.data;
  return {
    id: catalogueSettingsId,
    label: ct("settingsItem"),
    badge: cat.busy ? "…" : info?.connected === true ? ct("connected") : info?.serverUrl ? ct("notConnected") : undefined,
  };
}

/** Lignes RetroAchievements (comme la partie RetroAchievements des paramètres du launcher). */
const RA_ROWS = ["ra:link", "ra:check"] as const;

function raRows(): { id: string; label: string }[] {
  const { account, opened, checked } = raState();
  const linked = !!account && typeof account === "object" && "username" in account && !!account.username;
  return [
    { id: "ra:link", label: opened ? ct("raOpened") : linked ? ct("raChange") : ct("raLink") },
    { id: "ra:check", label: checked ? ct("raChecked") : ct("raCheck") },
  ];
}

function raValue(offline: boolean): string {
  const { account } = raState();
  if (offline) return ct("offline");
  if (account === undefined || account === "loading") return "…";
  if ("error" in account) return ct("raUnreadable");
  return account.username ?? ct("raNone");
}

export function catalogueSettingsDetail(cat: CatState, row?: string): ReactNode {
  const status = cat.status;
  const info = status?.data;
  const offline = info?.connected === "offline";
  if (raState().account === undefined && info?.connected === true) setTimeout(() => void loadRa(), 0);
  const connection =
    info?.connected === true ? `${ct("connected")}${info.username ? ` · ${info.username}` : ""}` : info?.connected === "offline" ? ct("offline") : ct("notConnected");
  return (
    <div>
      <NierGameDetail
        art={false}
        fields={[
          { label: ct("server"), value: info?.serverUrl ?? "—" },
          { label: ct("account"), value: connection },
          { label: ct("engine"), value: status?.cli ? (info?.version ?? "?") : ct("notInstalledEngine") },
          { label: ct("pendingSessions"), value: String(info?.pendingSessions ?? 0) },
          { label: ct("raAccount"), value: raValue(offline) },
        ]}
      />
      <NierOptionList options={[...SETTINGS_ROWS.map((r) => ({ id: r, label: ct(ROW_LABEL[r]) })), ...raRows()]} selectedId={row} />
      <Text>{row?.startsWith("ra:") ? ct("raHelp") : (cat.busy ?? cat.notice ?? ct("settingsDesc"))}</Text>
    </div>
  );
}

export function catalogueSettingsPanel(cat: CatState): PanelDef {
  return {
    rows: [...SETTINGS_ROWS, ...RA_ROWS],
    activate: (row) => {
      if (row === "ra:link") {
        const { account } = raState();
        if (!account || typeof account !== "object" || !("profileUrl" in account) || !account.profileUrl) return playSfx("unfocus");
        playSfx("confirm");
        return openRaProfile();
      }
      if (row === "ra:check") {
        playSfx("confirm");
        return void checkRa();
      }
      if (cat.busy) return;
      playSfx("confirm");
      if (row === "server") {
        void promptText(ct("serverPrompt"), ct("serverLabel"), cat.status?.data?.serverUrl ?? "https://").then((url) => {
          if (url) void configure(url, "");
        });
      } else if (row === "token") {
        void promptText(ct("tokenPrompt"), ct("tokenLabel"), "", true).then((token) => {
          if (token) void configure("", token);
        });
      } else if (row === "update") void updateEngine();
      else if (row === "sync") void syncSaves();
      else if (row === "logout") void logout();
    },
  };
}
