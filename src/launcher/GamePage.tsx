// Page d'un jeu au style NieR, à la place de la page Steam (/library/app/<id>).
// À gauche : les actions (Jouer, Informations, Succès, page Steam d'origine) ;
// à droite : l'image du jeu ou le contenu de l'entrée sélectionnée.
import { Navigation, useParams } from "@decky/ui";
import { useEffect, useState, type ReactNode } from "react";
import { NierAchievementList, NierGameDetail, NierHint, NierLayout, NierStatus, type NierButton } from "../nier-ui";
import { useAchievements, useStoreInfo } from "./gameDetails";
import { stepIndex, type NierAction } from "./GamepadRoot";
import { NierScreen } from "./NierScreen";
import { useSettings } from "./settings";
import { formatLastPlayed, formatPlaytime, formatSize, getGame, launchGame, type SteamGame } from "./steamLibrary";
import { useBattery, useClock } from "./useSystemStatus";

// ───────────── Retour à la page Steam d'origine ─────────────
// Demandé depuis la page NieR (« Page Steam d'origine », « Installer ») ;
// valable jusqu'à ce qu'on quitte la page du jeu.
let originalFor: number | null = null;
const originalListeners = new Set<() => void>();
function showOriginalPage(appid: number | null) {
  originalFor = appid;
  originalListeners.forEach((l) => l());
}

function useOriginalPage(appid: number): boolean {
  const [, setRev] = useState(0);
  useEffect(() => {
    const l = () => setRev((r) => r + 1);
    originalListeners.add(l);
    return () => {
      originalListeners.delete(l);
    };
  }, []);
  // Quitter la page (démontage) rétablit la page NieR pour la prochaine visite.
  useEffect(() => () => showOriginalPage(null), [appid]);
  return originalFor === appid;
}

/** Rendu à la place de la page d'un jeu Steam. */
export function GamePageSwitch({ original }: { original: ReactNode }) {
  const { appid } = useParams<{ appid: string }>();
  const id = Number(appid);
  const [settings, loaded] = useSettings();
  const showOriginal = useOriginalPage(id);
  if (!loaded || !settings.replaceGamePage || showOriginal || !Number.isFinite(id)) return <>{original}</>;
  return <GamePage appid={id} />;
}

// ───────────── Page NieR ─────────────

/** Le jeu, relu régulièrement (temps de jeu et dernière session changent après une partie). */
function useGame(appid: number): SteamGame | null {
  const [game, setGame] = useState(() => getGame(appid));
  useEffect(() => {
    setGame(getGame(appid));
    const iv = setInterval(() => setGame(getGame(appid)), 5000);
    return () => clearInterval(iv);
  }, [appid]);
  return game;
}

type ItemId = "play" | "info" | "achievements" | "steam";

const formatDate = (seconds: number) =>
  seconds > 0 ? new Date(seconds * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "";

function GamePage({ appid }: { appid: number }) {
  const time = useClock();
  const battery = useBattery();
  const game = useGame(appid);
  const [itemId, setItemId] = useState<ItemId>("play");
  const achievements = useAchievements(game);
  const store = useStoreInfo(game, itemId === "info");

  // Jeu inconnu de la bibliothèque : la page Steam saura mieux faire.
  useEffect(() => {
    if (!game) showOriginalPage(appid);
  }, [game === null, appid]);
  if (!game) return null;

  const items: { id: ItemId; label: string; badge?: string; hint?: string }[] = [
    { id: "play", label: game.installed ? "Jouer" : "Installer", hint: game.installed ? "Lancer" : "Installer" },
    { id: "info", label: "Informations" },
    { id: "achievements", label: "Succès", badge: achievements.total ? `${achievements.unlocked}/${achievements.total}` : undefined },
    { id: "steam", label: "Page Steam d'origine", hint: "Ouvrir" },
  ];
  const current = items.find((i) => i.id === itemId) ?? items[0];

  const activate = (id: ItemId) => {
    if (id === "play") {
      if (game.installed) launchGame(game);
      else showOriginalPage(appid); // le bouton Installer est sur la page Steam
    } else if (id === "steam") {
      showOriginalPage(appid);
    } else {
      setItemId(id);
    }
  };

  const onAction = (action: NierAction, repeat: boolean): boolean => {
    const index = items.indexOf(current);
    switch (action) {
      case "up":
      case "down":
        setItemId(items[stepIndex(index, action === "up" ? -1 : 1, items.length, !repeat)].id);
        return true;
      case "confirm":
        activate(current.id);
        return true;
      case "back":
        Navigation.NavigateBack();
        return true;
      default:
        return true;
    }
  };

  let detail: ReactNode;
  if (itemId === "info") {
    const info = store.info;
    detail = game.shortcut ? (
      <NierGameDetail image={game.heroes.concat(game.banners)} description="Jeu non-Steam : pas de fiche du Magasin." />
    ) : store.loading ? (
      <NierGameDetail description="Chargement de la fiche du Magasin…" />
    ) : info ? (
      <NierGameDetail
        fields={[
          { label: "Genres", value: info.genres.join(", ") || "—" },
          { label: "Développeur", value: info.developers.join(", ") || "—" },
          { label: "Éditeur", value: info.publishers.join(", ") || "—" },
          { label: "Sortie", value: info.releaseDate || "—" },
        ]}
        description={info.description}
      />
    ) : (
      <NierGameDetail description="Fiche du Magasin indisponible (hors ligne ou jeu retiré)." />
    );
  } else if (itemId === "achievements") {
    detail = (
      <NierAchievementList
        unlocked={achievements.unlocked}
        total={achievements.total}
        items={achievements.list.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          achieved: a.achieved,
          icon: a.icon,
          note: a.achieved ? formatDate(a.unlockedAt) : "Verrouillé",
        }))}
        emptyText={
          game.shortcut ? "Les jeux non-Steam n'ont pas de succès." : achievements.loading ? "Chargement des succès…" : "Ce jeu n'a pas de succès."
        }
      />
    );
  } else if (itemId === "steam") {
    detail = (
      <NierGameDetail
        image={game.heroes.concat(game.banners)}
        description="Ouvre la page Steam habituelle de ce jeu : activité, contenu perso, communauté, propriétés. Elle reste habillée au style NieR."
      />
    );
  } else {
    detail = (
      <NierGameDetail
        image={game.heroes.concat(game.banners)}
        imageAlt={game.name}
        fields={[
          { label: "Temps de jeu", value: formatPlaytime(game.playtime) },
          { label: "Dernière session", value: formatLastPlayed(game.lastPlayed) },
          { label: "Taille", value: game.installed ? formatSize(game.sizeOnDisk) : "—" },
          { label: "Statut", value: game.installed ? "Installé" : "Non installé" },
        ]}
      />
    );
  }

  const confirmHint: { button: NierButton; label: string } | null = current.hint ? { button: "A", label: current.hint } : null;

  return (
    <NierScreen zIndex={2} onAction={onAction}>
      <NierLayout
        tabs={[{ id: "game", label: game.name }]}
        activeTabId="game"
        onTabChange={() => {}}
        status={<NierStatus time={time} battery={battery} />}
        menuTitle="Menu du jeu"
        menuItems={items.map(({ id, label, badge }) => ({ id, label, badge }))}
        activeItemId={current.id}
        onItemSelect={(id) => setItemId(id as ItemId)}
        onItemActivate={(id) => activate(id as ItemId)}
        detailTitle={current.id === "play" ? game.name : current.label}
        footerStart={
          <>
            <NierHint button="STEAM" label="Menu" />
            <NierHint button="QAM" label="Accès rapide" />
          </>
        }
        footer={
          <>
            {confirmHint && <NierHint button={confirmHint.button} label={confirmHint.label} />}
            <NierHint button="B" label="Retour" />
          </>
        }
      >
        {detail}
      </NierLayout>
    </NierScreen>
  );
}
