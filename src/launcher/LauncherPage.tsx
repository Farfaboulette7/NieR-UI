import { Navigation, Router } from "@decky/ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { NierGameDetail, NierHint, NierIntro, NierLayout, NierMeter, NierOptionList, NierSlideOver, NierStatus, type NierMenuItem, type NierOption } from "../nier-ui";
import { loadMedia, playSfx, playTrack, useMedia, useNowPlaying, type NowPlaying } from "./audio";
import { MusicFooter, onMusicViewRequest, takeMusicViewRequest } from "./MusicFooter";
import { GamePanel, openOriginalPage } from "./GamePage";
import { setupNierSounds, useSfxSetup } from "./sfxSetup";
import { hasSteamGridDb } from "./collections";
import { LANGS, t, type StringKey } from "./i18n";
import { launcherState } from "./launcherState";
import { stepIndex, type NierAction, type NierActionHandler } from "./GamepadRoot";
import { NierScreen } from "./NierScreen";
import { getSettings, updateSettings, useSettings, type NierSettings } from "./settings";
import {
  formatLastPlayed,
  formatPlaytime,
  formatSize,
  libraryDiagnostic,
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

const TABS: { id: string; label: StringKey }[] = [
  { id: "recent", label: "tabRecent" },
  { id: "library", label: "tabLibrary" },
  { id: "collections", label: "tabCollections" },
  { id: "store", label: "tabStore" },
  { id: "system", label: "tabSystem" },
];

// Sélection mémorisée : on la retrouve en revenant d'une autre page Steam.
const remembered: { tabId: string; items: Record<string, string | undefined>; collectionId?: string } = {
  tabId: TABS[0].id,
  items: {},
};

// L'animation d'ouverture (emblème YoRHa) se joue au démarrage, puis à chaque
// sortie de veille si le launcher est à l'écran.
let introPlayed = false;
/** Écart entre deux tours d'une minuterie d'une seconde qui trahit une mise en veille. */
const SLEEP_GAP_MS = 8000;

declare const SteamClient: any;

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
  // Clé de l'animation : la changer la rejoue depuis le début.
  const [intro, setIntro] = useState<number | null>(() => (introPlayed ? null : 0));
  useEffect(() => {
    introPlayed = true;
    // Sortie de veille. Steam la signale (pas toujours au plugin), et les minuteries
    // s'arrêtent pendant la veille : un grand saut entre deux tours la trahit aussi.
    let lastWake = 0;
    const replay = () => {
      // Pas pendant un jeu (le launcher n'est pas visible), ni deux fois pour le même réveil.
      if (Router.MainRunningApp || Date.now() - lastWake < 10_000) return;
      lastWake = Date.now();
      setIntro(Date.now());
    };
    let reg: any = null;
    try {
      reg = SteamClient?.System?.RegisterForOnResumeFromSuspend?.(replay);
    } catch (e) {
      console.error("[NieRDeck] sortie de veille", e);
    }
    // Pendant un jeu, Steam ralentit aussi les minuteries : un saut juste après une
    // partie n'est pas un réveil.
    let lastTick = Date.now();
    let wasRunning = !!Router.MainRunningApp;
    const tick = setInterval(() => {
      const now = Date.now();
      const running = !!Router.MainRunningApp;
      if (now - lastTick > SLEEP_GAP_MS && !running && !wasRunning) replay();
      lastTick = now;
      wasRunning = running;
    }, 1000);
    return () => {
      clearInterval(tick);
      try {
        reg?.unregister?.();
      } catch {
        /* déjà libéré */
      }
    };
  }, []);

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
  const sfxSetup = useSfxSetup();
  // Liste de la zone de droite qui a la main (ex. les morceaux), et sa ligne sélectionnée.
  const [panel, setPanel] = useState<{ tabKey: string; itemId: string; row: string } | null>(null);

  // Page du jeu glissée par-dessus le launcher (sans changer de page Steam),
  // pour qu'elle arrive de la droite et reparte vers la droite.
  // Elle reste ouverte si Steam démonte le launcher (lancement d'un jeu) : au retour,
  // elle est réaffichée telle quelle, sans animation.
  const [overlay, setOverlayState] = useState<{ appid: number; closing: boolean; instant?: boolean } | null>(() =>
    launcherState.overlayAppid != null ? { appid: launcherState.overlayAppid, closing: false, instant: true } : null,
  );
  const setOverlay = (o: { appid: number; closing: boolean } | null) => {
    if (!o?.closing) launcherState.overlayAppid = o ? o.appid : null;
    setOverlayState(o);
  };
  const overlayAction = useRef<NierActionHandler | null>(null);
  const closeOverlay = () => {
    launcherState.overlayAppid = null;
    setOverlayState((o) => (o ? { ...o, closing: true } : o));
  };
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
    view = gamesView(t("tabLibrary"), library.owned, library.error ?? t("noInstalledGames"), openGame);
    view.menuTitle = t("libraryCount", { installed: library.installed.length, total: library.owned.length });
  } else if (tabId === "recent") {
    view = gamesView(t("recentlyPlayed"), library.recent, library.error ?? t("noRecentGames"), openGame);
  } else if (tabId === "collections") {
    const collection = library.collections.find((c) => c.id === collectionId);
    view = collection
      ? gamesView(collection.name, collection.games, t("emptyCollection"), openGame, () => {
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
    view = systemView(settings, updates, media, nowPlaying, sfxSetup);
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
    // → entre dans le panneau, sauf sur un item réglable (volume) où il sert à régler.
    if (current && panelDef?.rows.length && (action === "confirm" || (action === "right" && !view.adjustable?.(current.id)))) {
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
        tabs={TABS.map((x) => ({ id: x.id, label: t(x.label) }))}
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
            <NierHint button="STEAM" label={t("menu")} />
            <NierHint button="QAM" label={t("quickAccess")} />
            <MusicFooter onClick={showMusic} />
          </>
        }
        footer={
          panelRow !== undefined ? (
            <>
              <NierHint button="UPDOWN" label={t("choose")} />
              <NierHint button="A" label={t("confirm")} />
              <NierHint button="B" label={t("back")} />
            </>
          ) : (
            <>
              <NierHint button={["L1", "R1"]} label={t("tabs")} />
              {current && view.adjustable?.(current.id) && <NierHint button="LEFTRIGHT" label={t("adjust")} />}
              {hint && <NierHint button="A" label={hint} />}
              {view.back && <NierHint button="B" label={t("back")} />}
            </>
          )
        }
      >
        {detail.content}
      </NierLayout>
      {intro !== null && <NierIntro key={intro} onDone={() => setIntro(null)} />}
      {overlay && (
        <NierSlideOver closing={overlay.closing} instant={overlay.instant} onClosed={() => setOverlay(null)}>
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
        { label: t("playtime"), value: formatPlaytime(game.playtime) },
        { label: t("lastSession"), value: formatLastPlayed(game.lastPlayed) },
        { label: t("size"), value: game.installed ? formatSize(game.sizeOnDisk) : "—" },
        { label: t("status"), value: game.installed ? t("installed") : t("notInstalled") },
      ]}
    />
  );
}

/** Onglet listant des jeux : A ouvre la page du jeu. */
function gamesView(title: string, games: SteamGame[], empty: string, open: (g: SteamGame) => void, back?: () => boolean): TabView {
  const find = (id?: string) => games.find((g) => String(g.appid) === id);
  return {
    menuTitle: `${title}${games.length ? ` · ${games.length}` : ""}`,
    // Jeux non installés sur le Deck : estompés.
    items: games.map((g) => ({ id: String(g.appid), label: g.name, badge: formatPlaytime(g.playtime, true), muted: !g.installed })),
    detail: (id) => {
      const game = find(id);
      return game ? { title: game.name, content: gameDetail(game) } : { title, content: <NierGameDetail art={false} description={empty} /> };
    },
    activate: (id) => {
      const game = find(id);
      if (game) open(game);
    },
    hint: () => t("open"),
    back,
  };
}

function collectionsView(collections: SteamCollection[], open: (id: string) => void): TabView {
  const find = (id?: string) => collections.find((c) => c.id === id);
  return {
    menuTitle: `${t("tabCollections")}${collections.length ? ` · ${collections.length}` : ""}`,
    items: collections.map((c) => ({ id: c.id, label: c.name, badge: String(c.games.length) })),
    detail: (id) => {
      const c = find(id);
      if (!c) return { title: t("tabCollections"), content: <NierGameDetail art={false} description={t("noCollections")} /> };
      const playtime = c.games.reduce((sum, g) => sum + g.playtime, 0);
      const recent = [...c.games].sort((x, y) => y.lastPlayed - x.lastPlayed)[0];
      return {
        title: c.name,
        content: (
          <NierGameDetail
            image={(recent ?? c.games[0])?.banners}
            imageAlt={c.name}
            fields={[
              { label: t("games"), value: String(c.games.length) },
              { label: t("installedCount"), value: String(c.games.filter((g) => g.installed).length) },
              { label: t("totalPlaytime"), value: formatPlaytime(playtime) },
              { label: t("lastPlayedGame"), value: recent && recent.lastPlayed ? recent.name : "—" },
            ]}
          />
        ),
      };
    },
    activate: open,
    hint: () => t("open"),
  };
}

function wishlistView(wishlist: Wishlist): TabView {
  const find = (id?: string) => wishlist.items.find((w) => String(w.appid) === id);
  const empty = wishlist.loading
    ? t("wishlistLoading")
    : wishlist.error
      ? t("wishlistError", { error: wishlist.error })
      : t("wishlistEmpty");
  return {
    menuTitle: `${t("wishlist")}${wishlist.items.length ? ` · ${wishlist.items.length}` : ""}`,
    items: wishlist.items.map((w) => ({ id: String(w.appid), label: w.name, badge: w.discount ? `-${w.discount}%` : w.price || undefined })),
    detail: (id) => {
      const w = find(id);
      if (!w) return { title: t("tabStore"), content: <NierGameDetail art={false} description={empty} /> };
      return {
        title: w.name,
        content: (
          <NierGameDetail
            image={w.images}
            imageAlt={w.name}
            fields={[
              { label: t("price"), value: w.price ? (w.discount ? `${w.price} (-${w.discount} %)` : w.price) : "—" },
              { label: t("release"), value: w.releaseDate || "—" },
            ]}
          />
        ),
      };
    },
    activate: (id) => {
      playSfx("confirm");
      openStorePage(Number(id));
    },
    hint: () => t("storeHint"),
  };
}

// ───────────── Système : réglages de l'extension ─────────────

const TOGGLES: { id: "replaceHome" | "replaceGamePage" | "themeSteamMenus"; label: StringKey; description: StringKey }[] = [
  { id: "replaceHome", label: "replaceHome", description: "replaceHomeDesc" },
  { id: "replaceGamePage", label: "replaceGamePage", description: "replaceGamePageDesc" },
  { id: "themeSteamMenus", label: "themeSteam", description: "themeSteamDesc" },
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
const VOLUMES: { id: "sfxVolume" | "musicVolume"; label: StringKey }[] = [
  { id: "sfxVolume", label: "sfxVolume" },
  { id: "musicVolume", label: "musicVolume" },
];

type Media = ReturnType<typeof useMedia>;

function systemView(
  settings: NierSettings,
  updates: UpdateState,
  media: Media,
  now: NowPlaying,
  sfxSetup: ReturnType<typeof useSfxSetup>,
): TabView {
  const status = updates.status;
  const isToggle = (id: string) => TOGGLES.find((t) => t.id === id);
  const isVolume = (id: string) => VOLUMES.find((v) => v.id === id);
  const tracks = media?.music ?? [];
  const sfxFound = !!media && Object.keys(media.sfx).length > 0;
  const musicDir = media?.musicDir ?? "~/Music/NieRDeck";
  const noMusic = t("noMusic", { dir: musicDir });
  const trackLabel = (t: { number: number | null; title: string }) => `${t.number != null ? `${String(t.number).padStart(2, "0")}. ` : ""}${t.title}`;

  // Bruitages absents : une ligne propose d'installer Audio Loader et son pack NieR.
  const sfxRow = sfxSetup.loaderInstalled ? t("sfxDownloadPack") : t("sfxInstallAll");
  const sfxStatus =
    sfxSetup.step === "installingLoader"
      ? t("sfxInstalling")
      : sfxSetup.step === "downloadingPack"
        ? t("sfxDownloading")
        : sfxSetup.step === "error"
          ? t("sfxError", { error: sfxSetup.error })
          : sfxFound
            ? t("sfxPackInUse", { name: media?.sfxPack ?? "Audio Loader" })
            : t("noSfx");

  const volumeDetail = (id: "sfxVolume" | "musicVolume", row?: string): ReactNode => (
    <div>
      <NierMeter label={id === "sfxVolume" ? t("sfxShort") : t("musicShort")} value={settings[id]} mutedLabel={t("muted")} />
      <p className="nier-game-description" style={{ marginTop: 18 }}>
        {id === "musicVolume" && !tracks.length ? noMusic : t("volumeHelp")}
      </p>
      {id === "sfxVolume" && (
        <>
          <div className="nier-options-title">{t("sfxSource")}</div>
          <p className="nier-game-description" style={{ marginBottom: 12 }}>
            {sfxStatus}
          </p>
          {!sfxFound && <NierOptionList options={[{ id: "install", label: sfxRow }]} selectedId={row} />}
        </>
      )}
    </div>
  );

  // Panneau « Musique en cours » : deux interrupteurs puis la liste des morceaux.
  const musicRows: NierOption[] = [
    { id: "music", label: t("backgroundMusic"), badge: settings.musicEnabled ? t("on") : t("off") },
    { id: "shuffle", label: t("shuffle"), badge: settings.musicShuffle ? t("yes") : t("no") },
    ...tracks.map((t) => ({ id: `t:${t.id}`, label: trackLabel(t), active: now.track?.id === t.id })),
  ];
  const musicDetail = (row?: string): ReactNode => {
    const playing = now.track;
    const pct = now.duration ? Math.round((now.position / now.duration) * 100) : 0;
    if (!tracks.length) return <NierGameDetail art={false} description={noMusic} />;
    return (
      <div>
        <div className="nier-ach-progress">
          <div className="nier-ach-progress-label">
            <span>{playing && settings.musicEnabled ? trackLabel(playing) : t("musicDisabled")}</span>
            <span>{playing ? `${formatTime(now.position)} / ${formatTime(now.duration)}${now.playing ? "" : ` · ${t("paused")}`}` : ""}</span>
          </div>
          <div className="nier-ach-progress-bar">
            <div className="nier-ach-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="nier-options-title">
          {row === undefined ? t("tracksHelp", { n: tracks.length }) : t("tracks")}
        </div>
        <NierOptionList options={musicRows} selectedId={row} />
      </div>
    );
  };

  return {
    menuTitle: t("settings"),
    items: [
      ...TOGGLES.map((x) => ({ id: x.id, label: t(x.label), badge: settings[x.id] ? t("yes") : t("no") })),
      {
        id: "track",
        label: t("nowPlaying"),
        badge: !tracks.length ? "—" : !settings.musicEnabled ? t("no") : now.track?.number != null ? String(now.track.number) : undefined,
      },
      ...VOLUMES.map((v) => ({ id: v.id, label: t(v.label), badge: settings[v.id] ? `${settings[v.id]} %` : t("muted") })),
      { id: "language", label: t("language"), badge: LANGS.find((l) => l.id === settings.language)?.label },
      { id: "updates", label: t("updates"), badge: updates.checking ? "…" : status?.available ? `→ ${status.latest}` : status?.current },
      { id: "steam", label: t("steamSettings") },
      { id: "diagnostic", label: t("diagnostic") },
    ],
    detail: (id, row) => {
      const toggle = id ? isToggle(id) : undefined;
      if (toggle) {
        return {
          title: t(toggle.label),
          content: (
            <NierGameDetail
              art={false}
              fields={[{ label: t("state"), value: settings[toggle.id] ? t("on") : t("off") }]}
              description={t(toggle.description)}
            />
          ),
        };
      }
      const volume = id ? isVolume(id) : undefined;
      if (volume) return { title: t(volume.label), content: volumeDetail(volume.id, row) };
      if (id === "track") return { title: t("nowPlaying"), content: musicDetail(row) };
      if (id === "language") {
        return {
          title: t("language"),
          content: (
            <div>
              <p className="nier-game-description" style={{ marginBottom: 14 }}>
                {t("languageDesc")}
              </p>
              <NierOptionList options={LANGS.map((l) => ({ id: l.id, label: l.label, active: l.id === settings.language }))} selectedId={row} />
            </div>
          ),
        };
      }
      if (id === "updates") {
        return {
          title: t("updates"),
          content: (
            <NierGameDetail
              art={false}
              fields={[
                { label: t("installedVersion"), value: status?.current ?? "…" },
                { label: t("latestVersion"), value: updates.checking ? t("checking") : (status?.latest ?? "—") },
              ]}
              description={
                status?.error
                  ? t("githubError", { error: status.error })
                  : status?.available
                    ? t("updateAvailable")
                    : t("upToDate")
              }
            />
          ),
        };
      }
      if (id === "diagnostic") {
        const d = libraryDiagnostic();
        return {
          title: t("diagnostic"),
          content: (
            <NierGameDetail
              art={false}
              fields={[
                { label: t("diagSteamGames"), value: d.steam },
                { label: t("diagShortcuts"), value: d.shortcuts },
                { label: "Audio Loader", value: sfxSetup.loaderInstalled ? t("yes") : t("no") },
                { label: t("sfxShort"), value: media?.sfxPack ?? t("no") },
                { label: "SteamGridDB", value: hasSteamGridDb() ? t("yes") : t("no") },
              ]}
              description={t("diagnosticDesc")}
            />
          ),
        };
      }
      return {
        title: t("steamSettings"),
        content: <NierGameDetail art={false} description={t("steamSettingsDesc")} />,
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
      id === "sfxVolume" && !sfxFound
        ? {
            rows: ["install"],
            activate: () => {
              playSfx("confirm");
              void setupNierSounds();
            },
          }
        : id === "language"
        ? {
            rows: LANGS.map((l) => l.id),
            initial: settings.language,
            activate: (row) => {
              playSfx("confirm");
              updateSettings({ language: row as NierSettings["language"] });
            },
          }
        : id === "track" && tracks.length
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
        ? t("change")
        : isVolume(id)
          ? id === "sfxVolume" && !sfxFound
            ? t("install")
            : undefined
          : id === "track"
            ? tracks.length
              ? t("choose")
              : t("reload")
            : id === "language"
              ? t("choose")
              : id === "updates"
                ? status?.available
                  ? t("install")
                  : t("check")
                : id === "diagnostic"
                  ? undefined
                  : t("open"),
  };
}
