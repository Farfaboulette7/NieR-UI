import { Navigation } from "@decky/ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { NierGameDetail, NierHint, NierLayout, NierMeter, NierOptionList, NierSlideOver, NierStatus, type NierMenuItem, type NierOption } from "../nier-ui";
import { loadMedia, playSfx, playTrack, useMedia, useNowPlaying, type NowPlaying } from "./audio";
import { MusicFooter, onMusicViewRequest, takeMusicViewRequest } from "./MusicFooter";
import { GamePanel, openOriginalPage } from "./GamePage";
import { stepIndex, type NierAction, type NierActionHandler } from "./GamepadRoot";
import { NierScreen } from "./NierScreen";
import { getSettings, updateSettings, useSettings, type NierSettings } from "./settings";
import {
  formatLastPlayed,
  formatPlaytime,
  formatSize,
  openGamePage,
  openStorePage,
  useSteamLibrary,
  type SteamCollection,
  type SteamGame,
} from "./steamLibrary";
import { getUpdateStatus, installUpdate, type UpdateStatus } from "./Updates";
import { useBattery, useClock } from "./useSystemStatus";
import { useWishlist, type Wishlist } from "./wishlist";

// Côté Decky : cette page possède l'état, les données et l'entrée manette ;
// nier-ui ne fait que dessiner. Affichée à la place de l'accueil Steam.

const TABS = [
  { id: "library", label: "Bibliothèque" },
  { id: "recent", label: "Récents" },
  { id: "collections", label: "Collections" },
  { id: "store", label: "Boutique" },
  { id: "system", label: "Système" },
];

// Sélection mémorisée : on la retrouve en revenant d'une autre page Steam.
const remembered: { tabId: string; items: Record<string, string | undefined>; collectionId?: string } = {
  tabId: TABS[0].id,
  items: {},
};

/** Ce qu'affiche un onglet : le menu de gauche, la zone de droite, et ce que fait A. */
interface TabView {
  menuTitle: string;
  items: NierMenuItem[];
  /** Zone de droite pour l'item sélectionné (undefined si la liste est vide) ; `row` : ligne choisie dans son panneau. */
  detail: (id: string | undefined, row?: string) => { title: string; content: ReactNode };
  activate: (id: string) => void;
  /** Libellé de A pour l'item sélectionné ; rien = pas d'aide. */
  hint?: (id: string) => string | undefined;
  /** B dans l'onglet (sortir d'une collection...). true si pris en charge. */
  back?: () => boolean;
  /** Gauche / droite sur un item réglable (volume) ; true si pris en charge. */
  adjust?: (id: string, delta: number) => boolean;
  /** L'item sélectionné se règle avec gauche / droite (aide affichée). */
  adjustable?: (id: string) => boolean;
  /** Item dont la zone de droite est une liste de choix : A y entre, haut/bas choisit, B en sort. */
  panel?: (id: string) => { rows: string[]; initial?: string; activate: (row: string) => void } | undefined;
}

export function LauncherPage() {
  const time = useClock();
  const battery = useBattery();
  const library = useSteamLibrary();
  const [settings] = useSettings();

  const [tabId, setTabIdState] = useState(remembered.tabId);
  const [items, setItems] = useState(remembered.items);
  const [collectionId, setCollectionIdState] = useState(remembered.collectionId);
  // Une collection ouverte a sa propre sélection.
  const tabKey = tabId === "collections" && collectionId ? `collection:${collectionId}` : tabId;
  const setTabId = (id: string) => setTabIdState((remembered.tabId = id));
  const setItemId = (id: string | undefined) => setItems((remembered.items = { ...remembered.items, [tabKey]: id }));
  const setCollectionId = (id: string | undefined) => setCollectionIdState((remembered.collectionId = id));

  const wishlist = useWishlist(tabId === "store");
  const updates = useUpdateStatus(tabId === "system");
  const media = useMedia();
  const nowPlaying = useNowPlaying(tabId === "system");
  // Liste de la zone de droite qui a la main (ex. les morceaux), et sa ligne sélectionnée.
  const [panel, setPanel] = useState<{ tabKey: string; itemId: string; row: string } | null>(null);

  // Page du jeu glissée par-dessus le launcher (sans changer de page Steam),
  // pour qu'elle arrive de la droite et reparte vers la droite.
  const [overlay, setOverlay] = useState<{ appid: number; closing: boolean } | null>(null);
  const overlayAction = useRef<NierActionHandler | null>(null);
  const closeOverlay = () => setOverlay((o) => (o ? { ...o, closing: true } : o));
  // Filet de sécurité si la fin d'animation n'arrive pas (fenêtre masquée...).
  useEffect(() => {
    if (!overlay?.closing) return;
    const t = setTimeout(() => setOverlay(null), 600);
    return () => clearTimeout(t);
  }, [overlay?.closing]);

  const openGame = (game: SteamGame) => {
    playSfx("open");
    // Page NieR désactivée : on va sur la page Steam.
    if (getSettings().replaceGamePage) setOverlay({ appid: game.appid, closing: false });
    else openGamePage(game);
  };

  // ───── Contenu de l'onglet courant ─────
  let view: TabView;
  if (tabId === "library") {
    view = gamesView("Jeux installés", library.installed, library.error ?? "Aucun jeu installé.", openGame);
  } else if (tabId === "recent") {
    view = gamesView("Joués récemment", library.recent, library.error ?? "Aucune session de jeu récente.", openGame);
  } else if (tabId === "collections") {
    const collection = library.collections.find((c) => c.id === collectionId);
    view = collection
      ? gamesView(collection.name, collection.games, "Collection vide.", openGame, () => {
          playSfx("back");
          setCollectionId(undefined);
          return true;
        })
      : collectionsView(library.collections, (id) => {
          playSfx("confirm");
          setCollectionId(id);
        });
  } else if (tabId === "store") {
    view = wishlistView(wishlist);
  } else {
    view = systemView(settings, updates, media, nowPlaying);
  }

  const current = view.items.find((i) => i.id === items[tabKey]) ?? view.items[0];
  const panelDef = current ? view.panel?.(current.id) : undefined;
  const panelRow = panel && panelDef && panel.tabKey === tabKey && panel.itemId === current?.id ? panel.row : undefined;
  const detail = view.detail(current?.id, panelRow);
  const hint = current && view.hint?.(current.id);

  // Pied de page : le morceau en cours mène à Système → Musique en cours.
  const showMusic = () => {
    if (overlay) closeOverlay();
    setPanel(null);
    setTabId("system");
    setItems((remembered.items = { ...remembered.items, system: "track" }));
  };
  useEffect(() => {
    if (takeMusicViewRequest()) showMusic();
    return onMusicViewRequest(() => takeMusicViewRequest() && showMusic());
  }, []);

  const onPanelAction = (action: NierAction, repeat: boolean): boolean => {
    if (!panelDef || panelRow === undefined || !current) return false;
    const rows = panelDef.rows;
    switch (action) {
      case "up":
      case "down": {
        const next = rows[stepIndex(Math.max(0, rows.indexOf(panelRow)), action === "up" ? -1 : 1, rows.length, !repeat)];
        if (next !== panelRow) playSfx("move");
        setPanel({ tabKey, itemId: current.id, row: next });
        return true;
      }
      case "confirm":
        panelDef.activate(panelRow);
        return true;
      case "back":
      case "left":
        playSfx("unfocus");
        setPanel(null);
        return true;
      case "prevTab":
      case "nextTab":
        setPanel(null);
        return false;
      default:
        return true;
    }
  };

  const onAction = (action: NierAction, repeat: boolean): boolean => {
    if (overlay) return overlay.closing || (overlayAction.current?.(action, repeat) ?? true);
    if (panelRow !== undefined && onPanelAction(action, repeat)) return true;
    if (current && panelDef?.rows.length && (action === "confirm" || action === "right")) {
      playSfx("focus");
      setPanel({ tabKey, itemId: current.id, row: panelDef.initial ?? panelDef.rows[0] });
      return true;
    }
    const list = view.items;
    const index = current ? list.indexOf(current) : 0;
    switch (action) {
      case "up":
      case "down":
        // Boucle sur un appui simple ; s'arrête aux bords quand le bouton est maintenu.
        if (list.length) {
          const next = list[stepIndex(index, action === "up" ? -1 : 1, list.length, !repeat)];
          if (next !== current) playSfx("move");
          setItemId(next.id);
        }
        return true;
      case "prevTab":
      case "nextTab": {
        const t = TABS.findIndex((x) => x.id === tabId);
        playSfx("tab");
        setTabId(TABS[stepIndex(t, action === "prevTab" ? -1 : 1, TABS.length, true)].id);
        return true;
      }
      case "confirm":
        if (current) view.activate(current.id);
        return true;
      case "back":
        return view.back?.() ?? false; // sur l'accueil, Steam garde la main
      case "left":
      case "right":
        if (current) view.adjust?.(current.id, action === "left" ? -1 : 1);
        return true;
      default:
        return true;
    }
  };

  return (
    // Plein écran, sous les autres pages Steam (z-index bas).
    <NierScreen zIndex={1} onAction={onAction}>
      <NierLayout
        tabs={TABS}
        activeTabId={tabId}
        onTabChange={setTabId}
        status={<NierStatus time={time} battery={battery} />}
        menuTitle={view.menuTitle}
        menuItems={view.items}
        activeItemId={current?.id}
        onItemSelect={setItemId}
        onItemActivate={view.activate}
        detailTitle={detail.title}
        detailFocused={panelRow !== undefined}
        footerStart={
          <>
            <NierHint button="STEAM" label="Menu" />
            <NierHint button="QAM" label="Accès rapide" />
            <MusicFooter onClick={showMusic} />
          </>
        }
        footer={
          panelRow !== undefined ? (
            <>
              <NierHint button="UPDOWN" label="Choisir" />
              <NierHint button="A" label="Valider" />
              <NierHint button="B" label="Retour" />
            </>
          ) : (
            <>
              <NierHint button={["L1", "R1"]} label="Onglets" />
              {current && view.adjustable?.(current.id) && <NierHint button="LEFTRIGHT" label="Régler" />}
              {hint && <NierHint button="A" label={hint} />}
              {view.back && <NierHint button="B" label="Retour" />}
            </>
          )
        }
      >
        {detail.content}
      </NierLayout>
      {overlay && (
        <NierSlideOver closing={overlay.closing} onClosed={() => setOverlay(null)}>
          <GamePanel
            appid={overlay.appid}
            onBack={closeOverlay}
            onOriginal={() => openOriginalPage(overlay.appid)}
            actionRef={overlayAction}
            footerExtra={<MusicFooter onClick={showMusic} />}
          />
        </NierSlideOver>
      )}
    </NierScreen>
  );
}

// ───────────── Vues des onglets ─────────────

function gameDetail(game: SteamGame): ReactNode {
  return (
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
  );
}

/** Onglet listant des jeux : A ouvre la page du jeu. */
function gamesView(title: string, games: SteamGame[], empty: string, open: (g: SteamGame) => void, back?: () => boolean): TabView {
  const find = (id?: string) => games.find((g) => String(g.appid) === id);
  return {
    menuTitle: `${title}${games.length ? ` · ${games.length}` : ""}`,
    items: games.map((g) => ({ id: String(g.appid), label: g.name, badge: formatPlaytime(g.playtime, true) })),
    detail: (id) => {
      const game = find(id);
      return game ? { title: game.name, content: gameDetail(game) } : { title, content: <NierGameDetail art={false} description={empty} /> };
    },
    activate: (id) => {
      const game = find(id);
      if (game) open(game);
    },
    hint: () => "Ouvrir",
    back,
  };
}

function collectionsView(collections: SteamCollection[], open: (id: string) => void): TabView {
  const find = (id?: string) => collections.find((c) => c.id === id);
  return {
    menuTitle: `Collections${collections.length ? ` · ${collections.length}` : ""}`,
    items: collections.map((c) => ({ id: c.id, label: c.name, badge: String(c.games.length) })),
    detail: (id) => {
      const c = find(id);
      if (!c) return { title: "Collections", content: <NierGameDetail art={false} description="Aucune collection. Crée-en dans la bibliothèque Steam." /> };
      const playtime = c.games.reduce((sum, g) => sum + g.playtime, 0);
      const recent = [...c.games].sort((x, y) => y.lastPlayed - x.lastPlayed)[0];
      return {
        title: c.name,
        content: (
          <NierGameDetail
            image={(recent ?? c.games[0])?.banners}
            imageAlt={c.name}
            fields={[
              { label: "Jeux", value: String(c.games.length) },
              { label: "Installés", value: String(c.games.filter((g) => g.installed).length) },
              { label: "Temps de jeu", value: formatPlaytime(playtime) },
              { label: "Dernier joué", value: recent && recent.lastPlayed ? recent.name : "—" },
            ]}
          />
        ),
      };
    },
    activate: open,
    hint: () => "Ouvrir",
  };
}

function wishlistView(wishlist: Wishlist): TabView {
  const find = (id?: string) => wishlist.items.find((w) => String(w.appid) === id);
  const empty = wishlist.loading
    ? "Chargement de la liste de souhaits…"
    : wishlist.error
      ? `Liste de souhaits indisponible (${wishlist.error}).`
      : "Liste de souhaits vide, ou privée. Pour qu'elle apparaisse : profil Steam → Confidentialité → Détails des jeux → Public.";
  return {
    menuTitle: `Liste de souhaits${wishlist.items.length ? ` · ${wishlist.items.length}` : ""}`,
    items: wishlist.items.map((w) => ({ id: String(w.appid), label: w.name, badge: w.discount ? `-${w.discount}%` : w.price || undefined })),
    detail: (id) => {
      const w = find(id);
      if (!w) return { title: "Boutique", content: <NierGameDetail art={false} description={empty} /> };
      return {
        title: w.name,
        content: (
          <NierGameDetail
            image={w.images}
            imageAlt={w.name}
            fields={[
              { label: "Prix", value: w.price ? (w.discount ? `${w.price} (-${w.discount} %)` : w.price) : "—" },
              { label: "Sortie", value: w.releaseDate || "—" },
            ]}
          />
        ),
      };
    },
    activate: (id) => {
      playSfx("confirm");
      openStorePage(Number(id));
    },
    hint: () => "Magasin",
  };
}

// ───────────── Système : réglages de l'extension ─────────────

const TOGGLES: { id: keyof NierSettings; label: string; description: string }[] = [
  {
    id: "replaceHome",
    label: "Lancer au démarrage",
    description: "Affiche NieRDeck à la place de l'accueil Steam, dès le démarrage du mode Gaming. Désactivé, l'accueil Steam revient.",
  },
  {
    id: "replaceGamePage",
    label: "Page de jeu NieR",
    description: "Remplace la page d'un jeu Steam par la page NieR (Jouer, Informations, Succès).",
  },
  {
    id: "themeSteamMenus",
    label: "Thème NieR de Steam",
    description: "Habille le menu STEAM, l'accès rapide, les boîtes de dialogue et les pages de jeu aux couleurs YoRHA.",
  },
];

interface UpdateState {
  status: UpdateStatus | null;
  checking: boolean;
  check: () => Promise<void>;
}

function useUpdateStatus(enabled: boolean): UpdateState {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const check = async () => {
    setChecking(true);
    try {
      setStatus(await getUpdateStatus());
    } catch (e) {
      console.error("[NieRDeck] vérification des mises à jour", e);
    } finally {
      setChecking(false);
    }
  };
  useEffect(() => {
    if (enabled && !status && !checking) void check();
  }, [enabled]);
  return { status, checking, check };
}


const VOLUME_STEP = 10;
const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const VOLUMES: { id: "sfxVolume" | "musicVolume"; label: string }[] = [
  { id: "sfxVolume", label: "Volume des bruitages" },
  { id: "musicVolume", label: "Volume de la musique" },
];

type Media = ReturnType<typeof useMedia>;

function systemView(settings: NierSettings, updates: UpdateState, media: Media, now: NowPlaying): TabView {
  const status = updates.status;
  const isToggle = (id: string) => TOGGLES.find((t) => t.id === id);
  const isVolume = (id: string) => VOLUMES.find((v) => v.id === id);
  const tracks = media?.music ?? [];
  const sfxFound = !!media && Object.keys(media.sfx).length > 0;
  const musicDir = media?.musicDir ?? "~/Music/NieRDeck";
  const noMusic = `Aucune musique trouvée. Copie tes morceaux (mp3, ogg…) dans ${musicDir}, puis appuie sur A ici pour relire le dossier.`;
  const trackLabel = (t: { number: number | null; title: string }) => `${t.number != null ? `${String(t.number).padStart(2, "0")}. ` : ""}${t.title}`;

  const volumeDetail = (id: "sfxVolume" | "musicVolume"): ReactNode => {
    const missing =
      id === "sfxVolume"
        ? !sfxFound && "Aucun bruitage trouvé. Copie le dossier « YoRHa Decky » (pack Audio Loader) dans ~/homebrew/sounds/ sur le Deck."
        : !tracks.length && noMusic;
    return (
      <div>
        <NierMeter label={id === "sfxVolume" ? "Bruitages" : "Musique"} value={settings[id]} />
        <p className="nier-game-description" style={{ marginTop: 18 }}>
          {missing || "← → : régler le volume, par pas de 10 %."}
        </p>
      </div>
    );
  };

  // Panneau « Musique en cours » : deux interrupteurs puis la liste des morceaux.
  const musicRows: NierOption[] = [
    { id: "music", label: "Musique de fond", badge: settings.musicEnabled ? "Activée" : "Désactivée" },
    { id: "shuffle", label: "Lecture aléatoire", badge: settings.musicShuffle ? "Oui" : "Non" },
    ...tracks.map((t) => ({ id: `t:${t.id}`, label: trackLabel(t), active: now.track?.id === t.id })),
  ];
  const musicDetail = (row?: string): ReactNode => {
    const t = now.track;
    const pct = now.duration ? Math.round((now.position / now.duration) * 100) : 0;
    if (!tracks.length) return <NierGameDetail art={false} description={noMusic} />;
    return (
      <div>
        <div className="nier-ach-progress">
          <div className="nier-ach-progress-label">
            <span>{t && settings.musicEnabled ? trackLabel(t) : "Musique désactivée"}</span>
            <span>{t ? `${formatTime(now.position)} / ${formatTime(now.duration)}${now.playing ? "" : " · pause"}` : ""}</span>
          </div>
          <div className="nier-ach-progress-bar">
            <div className="nier-ach-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="nier-options-title">
          {row === undefined ? `A : choisir un morceau parmi les ${tracks.length}, ou régler la lecture.` : "Morceaux"}
        </div>
        <NierOptionList options={musicRows} selectedId={row} />
      </div>
    );
  };

  return {
    menuTitle: "Paramètres",
    items: [
      ...TOGGLES.map((t) => ({ id: t.id, label: t.label, badge: settings[t.id] ? "Oui" : "Non" })),
      {
        id: "track",
        label: "Musique en cours",
        badge: !tracks.length ? "—" : !settings.musicEnabled ? "Non" : now.track?.number != null ? String(now.track.number) : undefined,
      },
      ...VOLUMES.map((v) => ({ id: v.id, label: v.label, badge: settings[v.id] ? `${settings[v.id]} %` : "Coupé" })),
      { id: "updates", label: "Mises à jour", badge: updates.checking ? "…" : status?.available ? `→ ${status.latest}` : status?.current },
      { id: "steam", label: "Paramètres Steam" },
    ],
    detail: (id, row) => {
      const toggle = id ? isToggle(id) : undefined;
      if (toggle) {
        return {
          title: toggle.label,
          content: (
            <NierGameDetail
              art={false}
              fields={[{ label: "État", value: settings[toggle.id] ? "Activé" : "Désactivé" }]}
              description={toggle.description}
            />
          ),
        };
      }
      const volume = id ? isVolume(id) : undefined;
      if (volume) return { title: volume.label, content: volumeDetail(volume.id) };
      if (id === "track") return { title: "Musique en cours", content: musicDetail(row) };
      if (id === "updates") {
        return {
          title: "Mises à jour",
          content: (
            <NierGameDetail
              art={false}
              fields={[
                { label: "Installée", value: status?.current ?? "…" },
                { label: "Dernière", value: updates.checking ? "Vérification…" : (status?.latest ?? "—") },
              ]}
              description={
                status?.error
                  ? `Impossible de joindre GitHub (${status.error}).`
                  : status?.available
                    ? "A : installer la nouvelle version (Decky demande une confirmation)."
                    : "NieRDeck est à jour. A : vérifier à nouveau."
              }
            />
          ),
        };
      }
      return {
        title: "Paramètres Steam",
        content: <NierGameDetail art={false} description="Ouvre les paramètres du Steam Deck : réseau, affichage, son, contrôleur…" />,
      };
    },
    activate: (id) => {
      const toggle = isToggle(id);
      if (toggle) {
        playSfx(settings[toggle.id] ? "toggleOff" : "toggleOn");
        updateSettings({ [toggle.id]: !settings[toggle.id] });
      } else if (id === "track") {
        // Sans morceau, A relit le dossier ; sinon, le panneau prend la main.
        playSfx("confirm");
        void loadMedia(true);
      } else if (id === "updates") {
        playSfx("confirm");
        if (status?.available) installUpdate(status).catch((e) => console.error("[NieRDeck] mise à jour", e));
        else void updates.check();
      } else if (id === "steam") {
        playSfx("confirm");
        Navigation.Navigate("/settings");
      }
    },
    panel: (id) =>
      id === "track" && tracks.length
        ? {
            rows: musicRows.map((r) => r.id),
            initial: now.track ? `t:${now.track.id}` : undefined,
            activate: (row) => {
              if (row === "music") {
                playSfx(settings.musicEnabled ? "toggleOff" : "toggleOn");
                updateSettings({ musicEnabled: !settings.musicEnabled });
              } else if (row === "shuffle") {
                playSfx(settings.musicShuffle ? "toggleOff" : "toggleOn");
                updateSettings({ musicShuffle: !settings.musicShuffle });
              } else if (row.startsWith("t:")) {
                playSfx("confirm");
                playTrack(row.slice(2));
              }
            },
          }
        : undefined,
    adjust: (id, delta) => {
      const volume = isVolume(id);
      if (!volume) return false;
      const value = Math.max(0, Math.min(100, settings[volume.id] + delta * VOLUME_STEP));
      if (value === settings[volume.id]) return true;
      updateSettings({ [volume.id]: value });
      playSfx(delta > 0 ? "volumeUp" : "volumeDown");
      return true;
    },
    adjustable: (id) => !!isVolume(id),
    hint: (id) =>
      isToggle(id)
        ? "Changer"
        : isVolume(id)
          ? undefined
          : id === "track"
            ? tracks.length
              ? "Choisir"
              : "Relire"
            : id === "updates"
              ? status?.available
                ? "Installer"
                : "Vérifier"
              : "Ouvrir",
  };
}
