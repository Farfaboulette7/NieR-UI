import { Navigation } from "@decky/ui";
import { toaster } from "@decky/api";
import { useRef, useState } from "react";
import { NierGameDetail, NierHint, NierLayout, NierStage, NierStatus } from "../nier-ui";
import { GamepadRoot, type NierAction } from "./GamepadRoot";
import { MOCK_TABS } from "./mockData";
import { useHiddenSteamChrome } from "./steamChrome";
import { useBattery, useClock } from "./useSystemStatus";

// Côté Decky : cette page possède l'état, les données et l'entrée manette ;
// nier-ui ne fait que dessiner.

/** "home" : à la place de l'accueil Steam. "standalone" : page ouverte depuis l'accès rapide. */
export type LauncherMode = "home" | "standalone";

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

  const [tabId, setTabId] = useState(MOCK_TABS[0].id);
  const tab = MOCK_TABS.find((t) => t.id === tabId) ?? MOCK_TABS[0];
  const [itemId, setItemId] = useState<string | undefined>(tab.games[0]?.id);
  const game = tab.games.find((x) => x.id === itemId);

  const changeTab = (id: string) => {
    setTabId(id);
    setItemId(MOCK_TABS.find((t) => t.id === id)?.games[0]?.id);
  };

  const launch = (id: string) => {
    const name = tab.games.find((x) => x.id === id)?.name ?? id;
    toaster.toast({ title: "NieRDeck", body: `${name} : lancement indisponible (données fictives).` });
  };

  const onAction = (action: NierAction, repeat: boolean): boolean => {
    const games = tab.games;
    const index = games.findIndex((x) => x.id === itemId);
    switch (action) {
      case "up":
      case "down":
        // Boucle sur un appui simple ; s'arrête aux bords quand le bouton est maintenu.
        if (games.length) setItemId(games[step(Math.max(index, 0), action === "up" ? -1 : 1, games.length, !repeat)].id);
        return true;
      case "prevTab":
      case "nextTab": {
        const t = MOCK_TABS.findIndex((x) => x.id === tab.id);
        changeTab(MOCK_TABS[step(t, action === "prevTab" ? -1 : 1, MOCK_TABS.length, true)].id);
        return true;
      }
      case "confirm":
        if (game) launch(game.id);
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
            tabs={MOCK_TABS}
            activeTabId={tab.id}
            onTabChange={changeTab}
            status={<NierStatus time={time} battery={battery} />}
            menuTitle={tab.menuTitle}
            menuItems={tab.games.map((x) => ({ id: x.id, label: x.name, badge: x.playtime }))}
            activeItemId={game?.id}
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
                {game && <NierHint button="A" label="Lancer" />}
                {mode === "standalone" && <NierHint button="B" label="Retour" />}
              </>
            }
          >
            {game ? (
              <NierGameDetail
                fields={[
                  { label: "Temps de jeu", value: game.playtime },
                  { label: "Dernière session", value: game.lastPlayed },
                  { label: "Taille", value: game.size },
                ]}
                description={game.description}
              />
            ) : (
              <NierGameDetail description="Aucune donnée disponible pour cette section." />
            )}
          </NierLayout>
        </NierStage>
      </GamepadRoot>
    </div>
  );
}
