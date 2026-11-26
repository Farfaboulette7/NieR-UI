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
import { fullDetails, gamePageView, isInstalled, kindLabel } from "./gamePage";
import { configure, imageUrl, loadConsoles, loadDetails, logout, setOpenGame, setOpenList, syncSaves, updateEngine, type CatGame, type catalogueState } from "./store";

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
  if (key.startsWith("search:")) return ct("searchResults", { term: key.slice(7) });
  const id = Number(key.slice(8));
  return id === -1 ? ct("recomps") : (cat.consoles?.find((c) => c.id === id)?.name ?? ct("games"));
};

/** Aperçu d'un jeu dans la liste ; A ouvre sa page. */
function gamePreview(cat: CatState, romId: number, game: CatGame | undefined): ReactNode {
  const d = fullDetails(cat, romId);
  const progress = cat.progress[romId];
  const local = imageUrl(d?.game?.coverUrl ?? game?.coverUrl);
  const status = progress ? ct("statusInstalling") : isInstalled(cat, romId, game) ? ct("statusInstalled") : ct("statusNotInstalled");
  const failed = cat.details[romId];
  const error = failed && typeof failed === "object" && "error" in failed ? failed.error : undefined;
  return (
    <div>
      <NierGameDetail
        image={local}
        imageAlt={game?.name ?? d?.game?.name}
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
  if (open) {
    const list = cat.lists[open];
    const games = list?.games ?? [];
    const find = (id?: string) => games.find((g) => `g:${g.id}` === id);
    return {
      menuTitle: `${listTitle(cat, open)}${games.length ? ` · ${games.length}` : ""}`,
      items: games.map(
        (g): NierMenuItem => ({
          id: `g:${g.id}`,
          label: g.name,
          badge: cat.progress[g.id] ? "↓" : g.installed ? "✓" : undefined,
          muted: !g.installed && !cat.progress[g.id],
        }),
      ),
      detail: (id) => {
        const game = find(id);
        if (!game) {
          const msg = list?.loading ? ct("loading") : list?.error ? ct("error", { error: list.error }) : ct("empty");
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
      hint: (id) => (find(id) ? ct("openGame") : undefined),
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
    ...consoles.map((c) => ({ id: `console:${c.id}`, label: c.id === -1 ? ct("recomps") : c.name, badge: String(c.romCount) })),
  ];
  return {
    menuTitle: ct("rootTitle"),
    items,
    detail: (id) => {
      if (id === "search") return { title: ct("search"), content: <NierGameDetail art={false} description={ct("searchDesc")} /> };
      if (id === "installed") return { title: ct("installed"), content: <NierGameDetail art={false} description={ct("installedDesc")} /> };
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

export function catalogueSettingsDetail(cat: CatState, row?: string): ReactNode {
  const status = cat.status;
  const info = status?.data;
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
        ]}
      />
      <NierOptionList options={SETTINGS_ROWS.map((r) => ({ id: r, label: ct(ROW_LABEL[r]) }))} selectedId={row} />
      <Text>{cat.busy ?? cat.notice ?? ct("settingsDesc")}</Text>
    </div>
  );
}

export function catalogueSettingsPanel(cat: CatState): PanelDef {
  return {
    rows: [...SETTINGS_ROWS],
    activate: (row) => {
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
