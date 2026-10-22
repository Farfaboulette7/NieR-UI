import { Navigation } from "@decky/ui";
import { useRef, useState } from "react";
import { NierGameDetail, NierHint, NierLayout, NierStage, NierStatus } from "../nier-ui";
import { GamepadRoot, type NierAction } from "./GamepadRoot";
import { useHiddenSteamChrome } from "./steamChrome";
import { formatLastPlayed, formatPlaytime, formatSize, launchGame, useSteamLibrary, type SteamGame, type SteamLibrary } from "./steamLibrary";
import { useBattery, useClock } from "./useSystemStatus";

// Côté Decky : cette page possède l'état, les données et l'entrée manette ;
// nier-ui ne fait que dessiner.

/** "home" : à la place de l'accueil Steam. "standalone" : page ouverte depuis l'accès rapide. */
export type LauncherMode = "home" | "standalone";

interface Tab {
  id: string;
  label: string;
  menuTitle: string;
  games: (lib: SteamLibrary) => SteamGame[];
  empty: string;
}

const TABS: Tab[] = [
  { id: "library", label: "Bibliothèque", menuTitle: "Jeux installés", games: (l) => l.installed, empty: "Aucun jeu installé." },
  { id: "recent", label: "Récents", menuTitle: "Joués récemment", games: (l) => l.recent, empty: "Aucune session de jeu récente." },
  { id: "collections", label: "Collections", menuTitle: "Favoris", games: (l) => l.favorites, empty: "Aucun favori. Ajoute des jeux aux favoris dans Steam." },
  { id: "store", label: "Boutique", menuTitle: "Liste de souhaits", games: () => [], empty: "Bientôt disponible." },
  { id: "system", label: "Système", menuTitle: "Paramètres", games: () => [], empty: "Bientôt disponible." },
];

const step = (index: number, delta: number, length: number, wrap: boolean) => {
  const next = index + delta;
  if (wrap) return (next + length) % length;
  return Math.max(0, Math.min(length - 1, next));
};

export function LauncherPage({ mode = "standalone" }: { mode?: LauncherMode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useHiddenSteamChrome(rootRef);
  const time = useClock();
  const battery = useBattery();
  const library = useSteamLibrary();

  const [tabId, setTabId] = useState(TABS[0].id);
  const tab = TABS.find((t) => t.id === tabId) ?? TABS[0];
  const games = tab.games(library);
  const [itemId, setItemId] = useState<string>();
  // Par défaut (ou si le jeu a disparu de la liste) : le premier.
  const game = games.find((g) => String(g.appid) === itemId) ?? games[0];

  const changeTab = (id: string) => {
    setTabId(id);
    setItemId(undefined);
  };

  const launch = (id: string) => {
    const target = games.find((g) => String(g.appid) === id);
    if (target) launchGame(target);
  };

  const onAction = (action: NierAction, repeat: boolean): boolean => {
    const index = game ? games.indexOf(game) : 0;
    switch (action) {
      case "up":
      case "down":
        // Boucle sur un appui simple ; s'arrête aux bords quand le bouton est maintenu.
        if (games.length) setItemId(String(games[step(index, action === "up" ? -1 : 1, games.length, !repeat)].appid));
        return true;
      case "prevTab":
      case "nextTab": {
        const t = TABS.indexOf(tab);
        changeTab(TABS[step(t, action === "prevTab" ? -1 : 1, TABS.length, true)].id);
        return true;
      }
      case "confirm":
        if (game) launchGame(game);
        return true;
      case "back":
        if (mode === "standalone") {
          Navigation.NavigateBack();
          return true;
        }
        return false; // sur l'accueil, Steam garde la main
      default:
        return true; // gauche/droite : rien pour l'instant, mais on garde le focus
    }
  };

  return (
    // Plein écran. En mode accueil, on reste sous les autres pages Steam (z-index bas).
    <div ref={rootRef} data-nierdeck-root="" style={{ position: "fixed", inset: 0, zIndex: mode === "standalone" ? 900 : 1 }}>
      <GamepadRoot onAction={onAction}>
        <NierStage>
          <NierLayout
            tabs={TABS}
            activeTabId={tab.id}
            onTabChange={changeTab}
            status={<NierStatus time={time} battery={battery} />}
            menuTitle={`${tab.menuTitle}${games.length ? ` · ${games.length}` : ""}`}
            menuItems={games.map((g) => ({ id: String(g.appid), label: g.name, badge: formatPlaytime(g.playtime, true) }))}
            activeItemId={game ? String(game.appid) : undefined}
            onItemSelect={setItemId}
            onItemActivate={launch}
            detailTitle={game?.name ?? tab.label}
            footerStart={
              <>
                <NierHint button="STEAM" label="Menu" />
                <NierHint button="QAM" label="Accès rapide" />
              </>
            }
            footer={
              <>
                <NierHint button={["L1", "R1"]} label="Onglets" />
                {game && <NierHint button="A" label={game.installed ? "Lancer" : "Installer"} />}
                {mode === "standalone" && <NierHint button="B" label="Retour" />}
              </>
            }
          >
            {game ? (
              <NierGameDetail
                image={game.banners}
                imageAlt={game.name}
                fields={[
                  { label: "Temps de jeu", value: formatPlaytime(game.playtime) },
                  { label: "Dernière session", value: formatLastPlayed(game.lastPlayed) },
                  { label: "Taille", value: game.installed ? formatSize(game.sizeOnDisk) : "—" },
                  { label: "Statut", value: game.installed ? "Installé" : "Non installé" },
                ]}
              />
            ) : (
              <NierGameDetail description={library.error ?? tab.empty} />
            )}
          </NierLayout>
        </NierStage>
      </GamepadRoot>
    </div>
  );
}
