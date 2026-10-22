// Page d'un jeu au style NieR, à la place de la page Steam (/library/app/<id>).
// À gauche : les actions (Jouer, Informations, Succès, page Steam d'origine) ;
// à droite : l'image du jeu ou le contenu de l'entrée sélectionnée.
import { Navigation, useParams } from "@decky/ui";
import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { NierAchievementList, NierGameDetail, NierHint, NierLayout, NierPeopleList, NierStatus, type NierButton } from "../nier-ui";
import { playSfx } from "./audio";
import { useAchievements, useFriendsWhoPlayed, useStoreInfo } from "./gameDetails";
import { stepIndex, type NierAction, type NierActionHandler } from "./GamepadRoot";
import { NierScreen } from "./NierScreen";
import { MusicFooter, requestMusicView } from "./MusicFooter";
import { getSettings, useSettings } from "./settings";
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

type ItemId = "play" | "info" | "achievements" | "friends" | "steam";

const formatDate = (seconds: number) =>
  seconds > 0 ? new Date(seconds * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "";

/** Ouvre la page Steam d'origine d'un jeu, en court-circuitant la page NieR. */
export function openOriginalPage(appid: number) {
  showOriginalPage(appid);
  Navigation.Navigate(`/library/app/${appid}`);
}

export interface GamePanelProps {
  appid: number;
  /** B : retour à l'écran précédent. */
  onBack: () => void;
  /** « Page Steam d'origine » et « Installer ». */
  onOriginal: () => void;
  /** Reçoit le gestionnaire manette de la page, à appeler par l'écran qui la contient. */
  actionRef: MutableRefObject<NierActionHandler | null>;
  /** Ajouté au pied de page, après les aides STEAM / ··· (morceau en cours...). */
  footerExtra?: ReactNode;
}

/**
 * Contenu de la page d'un jeu, sans écran autour : affiché seul (route Steam)
 * ou glissé par-dessus le launcher.
 */
export function GamePanel({ appid, onBack, onOriginal, actionRef, footerExtra }: GamePanelProps) {
  const time = useClock();
  const battery = useBattery();
  const game = useGame(appid);
  const [itemId, setItemIdState] = useState<ItemId>("play");
  // La zone de droite a la main : haut/bas la font défiler, B ou gauche rend la main au menu.
  const [panelFocus, setPanelFocus] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);
  const setItemId = (id: ItemId) => {
    setItemIdState(id);
    setPanelFocus(false);
  };
  const achievements = useAchievements(game);
  const store = useStoreInfo(game, itemId === "info");
  const friends = useFriendsWhoPlayed(game);

  // Jeu inconnu de la bibliothèque : la page Steam saura mieux faire.
  useEffect(() => {
    if (!game) onOriginal();
  }, [game === null, appid]);
  if (!game) {
    actionRef.current = null;
    return null;
  }

  const items: { id: ItemId; label: string; badge?: string; hint?: string }[] = [
    { id: "play", label: game.installed ? "Jouer" : "Installer", hint: game.installed ? "Lancer" : "Installer" },
    { id: "info", label: "Informations", hint: "Parcourir" },
    // Un jeu non-Steam n'a en général pas de succès : pas d'entrée vide.
    ...(game.shortcut && !achievements.total
      ? []
      : [{ id: "achievements" as const, label: "Succès", hint: "Parcourir", badge: achievements.total ? `${achievements.unlocked}/${achievements.total}` : undefined }]),
    // Ce que montre l'onglet Activité de Steam : les contacts qui ont le jeu.
    ...(game.shortcut
      ? []
      : [{ id: "friends" as const, label: "Contacts", hint: "Parcourir", badge: friends.friends.length ? String(friends.friends.length) : undefined }]),
    { id: "steam", label: "Page Steam d'origine", hint: "Ouvrir" },
  ];
  const current = items.find((i) => i.id === itemId) ?? items[0];

  const activate = (id: ItemId) => {
    if (id === "play") {
      if (game.installed) {
        playSfx("launch");
        launchGame(game);
      } else {
        playSfx("confirm");
        onOriginal(); // le bouton Installer est sur la page Steam
      }
    } else if (id === "steam") {
      playSfx("confirm");
      onOriginal();
    } else {
      setItemIdState(id);
      if (!panelFocus) playSfx("focus");
      setPanelFocus(true);
    }
  };
  const browsable = current.id === "info" || current.id === "achievements" || current.id === "friends";

  actionRef.current = (action: NierAction, repeat: boolean): boolean => {
    if (panelFocus) {
      switch (action) {
        case "up":
        case "down":
          detailRef.current?.scrollBy({ top: action === "up" ? -90 : 90, behavior: repeat ? "auto" : "smooth" });
          return true;
        case "left":
        case "back":
          playSfx("unfocus");
          setPanelFocus(false);
          return true;
        default:
          return true;
      }
    }
    const index = items.indexOf(current);
    switch (action) {
      case "up":
      case "down":
      {
        const next = items[stepIndex(index, action === "up" ? -1 : 1, items.length, !repeat)];
        if (next !== current) playSfx("move");
        setItemId(next.id);
        return true;
      }
      case "confirm":
        activate(current.id);
        return true;
      case "right":
        if (browsable) activate(current.id);
        return true;
      case "back":
        playSfx("close");
        onBack();
        return true;
      default:
        return true;
    }
  };

  const heroes = game.heroes.concat(game.banners);
  let detail: ReactNode;
  if (current.id === "info") {
    const info = store.info;
    detail = game.shortcut ? (
      <NierGameDetail image={heroes} description="Jeu non-Steam : pas de fiche du Magasin." />
    ) : store.loading ? (
      <NierGameDetail image={heroes} description="Chargement de la fiche du Magasin…" />
    ) : info ? (
      <NierGameDetail
        image={info.images.concat(heroes)}
        imageAlt={game.name}
        fields={[
          { label: "Genres", value: info.genres.join(", ") || "—" },
          { label: "Développeur", value: info.developers.join(", ") || "—" },
          { label: "Éditeur", value: info.publishers.join(", ") || "—" },
          { label: "Sortie", value: info.releaseDate || "—" },
        ]}
        description={info.description}
      />
    ) : (
      <NierGameDetail image={heroes} description="Fiche du Magasin indisponible (hors ligne ou jeu retiré)." />
    );
  } else if (current.id === "achievements") {
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
        emptyText={achievements.loading ? "Chargement des succès…" : "Ce jeu n'a pas de succès."}
      />
    );
  } else if (current.id === "friends") {
    const playing = friends.friends.filter((f) => f.playingThis).length;
    detail = (
      <NierPeopleList
        heading={
          friends.friends.length
            ? `${friends.friends.length} contact${friends.friends.length > 1 ? "s ont" : " a"} ce jeu${playing ? ` · ${playing} en train d'y jouer` : ""}`
            : undefined
        }
        items={friends.friends.map((f) => ({
          id: f.id,
          name: f.name,
          avatar: f.avatar,
          active: f.online,
          status: f.playingThis ? "Joue à ce jeu en ce moment" : f.game ? `Joue à ${f.game}` : f.online ? "En ligne" : "Hors ligne",
        }))}
        emptyText={friends.loading ? "Recherche des contacts…" : "Aucun de tes contacts n'a ce jeu."}
      />
    );
  } else if (current.id === "steam") {
    detail = (
      <NierGameDetail
        image={heroes}
        description="Ouvre la page Steam habituelle de ce jeu : activité, contenu perso, communauté, propriétés. Elle reste habillée au style NieR."
      />
    );
  } else {
    detail = (
      <NierGameDetail
        image={heroes}
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
    <NierLayout
      title={game.name}
      status={<NierStatus time={time} battery={battery} />}
      menuTitle="Menu du jeu"
      menuItems={items.map(({ id, label, badge }) => ({ id, label, badge }))}
      activeItemId={current.id}
      onItemSelect={(id) => id !== current.id && setItemId(id as ItemId)}
      onItemActivate={(id) => activate(id as ItemId)}
      detailTitle={current.id === "play" ? game.name : current.label}
      detailFocused={panelFocus}
      detailRef={detailRef}
      footerStart={
        <>
          <NierHint button="STEAM" label="Menu" />
          <NierHint button="QAM" label="Accès rapide" />
          {footerExtra}
        </>
      }
      footer={
        panelFocus ? (
          <>
            <NierHint button="UPDOWN" label="Défiler" />
            <NierHint button="B" label="Menu du jeu" />
          </>
        ) : (
          <>
            {confirmHint && <NierHint button={confirmHint.button} label={confirmHint.label} />}
            <NierHint button="B" label="Retour" />
          </>
        )
      }
    >
      {detail}
    </NierLayout>
  );
}

/** Retour au launcher (l'accueil), sur Système → Musique en cours. */
function openMusicInLauncher() {
  requestMusicView();
  Navigation.Navigate("/library/home");
}

/** Page affichée par la route Steam /library/app/<id> (ouverte par Steam, au lancement d'un jeu...). */
function GamePage({ appid }: { appid: number }) {
  const actionRef = useRef<NierActionHandler | null>(null);
  return (
    <NierScreen zIndex={2} onAction={(action, repeat) => actionRef.current?.(action, repeat) ?? false}>
      <GamePanel
        appid={appid}
        onBack={() => Navigation.NavigateBack()}
        onOriginal={() => showOriginalPage(appid)}
        actionRef={actionRef}
        footerExtra={<MusicFooter onClick={getSettings().replaceHome ? openMusicInLauncher : undefined} />}
      />
    </NierScreen>
  );
}
