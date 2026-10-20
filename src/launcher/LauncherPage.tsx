import { useState } from "react";
import { NierGameDetail, NierLayout } from "../nier-ui";
import { MOCK_TABS } from "./mockData";

// Côté Decky : cette page possède l'état et les données ; nier-ui ne fait que dessiner.

export function LauncherPage() {
  const [tabId, setTabId] = useState(MOCK_TABS[0].id);
  const tab = MOCK_TABS.find((t) => t.id === tabId) ?? MOCK_TABS[0];
  const [itemId, setItemId] = useState<string | undefined>(tab.games[0]?.id);
  const game = tab.games.find((x) => x.id === itemId);

  const changeTab = (id: string) => {
    setTabId(id);
    setItemId(MOCK_TABS.find((t) => t.id === id)?.games[0]?.id);
  };

  return (
    // Plein écran au-dessus de l'en-tête et du pied de page Steam (comme benderthemes).
    <div style={{ position: "fixed", inset: 0, zIndex: 900 }}>
      <NierLayout
        tabs={MOCK_TABS}
        activeTabId={tab.id}
        onTabChange={changeTab}
        menuTitle={tab.menuTitle}
        menuItems={tab.games.map((x) => ({ id: x.id, label: x.name, badge: x.playtime }))}
        activeItemId={game?.id}
        onItemSelect={setItemId}
        detailTitle={game?.name ?? tab.label}
        footer={
          <>
            <span>Ⓐ Lancer</span>
            <span>Ⓑ Retour</span>
            <span>L1 / R1 Onglets</span>
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
    </div>
  );
}
