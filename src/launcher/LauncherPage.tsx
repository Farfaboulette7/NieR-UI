import { Navigation, Router } from "@decky/ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { NierGameDetail, NierHint, NierIntro, NierLayout, NierMeter, NierOptionList, NierSlideOver, NierStatus, type NierMenuItem, type NierOption } from "../nier-ui";
import { loadMedia, playSfx, playTrack, useMedia, useNowPlaying, type NowPlaying } from "./audio";
import { MusicFooter, onMusicViewRequest, takeMusicViewRequest } from "./MusicFooter";
import { GamePanel, openOriginalPage } from "./GamePage";
import { setupNierSounds, useSfxSetup } from "./sfxSetup";
import { setAirplaneMode, setBluetooth, setBrightness, setWifi, useSteamSystem, type SteamSystemState } from "./steamSystem";
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

/** Liste de la zone de droite qui peut prendre la main. */
interface PanelDef {
  rows: string[];
  initial?: string;
  activate: (row: string) => void;
  /** Gauche / droite sur une ligne réglable (volume, luminosité) ; true si pris en charge. */
  adjust?: (row: string, delta: number) => boolean;
  adjustable?: (row: string) => boolean;
}

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
  panel?: (id: string) => PanelDef | undefined;
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
  const steamSystem = useSteamSystem(tabId === "system");
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
    view = systemView(settings, updates, media, nowPlaying, sfxSetup, steamSystem);
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
        if (!repeat) panelDef.activate(panelRow);
        return true;
      case "left":
      case "right":
        if (panelDef.adjust?.(panelRow, action === "left" ? -1 : 1)) return true;
        if (action === "right") return true;
        playSfx("unfocus");
        setPanel(null);
        return true;
      case "back":
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
              {panelDef?.adjustable?.(panelRow) ? <NierHint button="LEFTRIGHT" label={t("adjust")} /> : <NierHint button="A" label={t("confirm")} />}
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
const BRIGHTNESS_STEP = 0.05;
const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const VOLUMES: { id: "sfxVolume" | "musicVolume"; label: StringKey; title: StringKey }[] = [
  { id: "sfxVolume", label: "sfxVolume", title: "sfxShort" },
  { id: "musicVolume", label: "musicVolume", title: "musicShort" },
];

type Media = ReturnType<typeof useMedia>;

/** Titre de section dans la zone de droite. */
const Section = ({ children }: { children: ReactNode }) => <div className="nier-options-title">{children}</div>;
const Text = ({ children }: { children: ReactNode }) => (
  <p className="nier-game-description" style={{ margin: "6px 0 12px" }}>
    {children}
  </p>
);

function systemView(
  settings: NierSettings,
  updates: UpdateState,
  media: Media,
  now: NowPlaying,
  sfxSetup: ReturnType<typeof useSfxSetup>,
  system: SteamSystemState,
): TabView {
  const status = updates.status;
  const tracks = media?.music ?? [];
  const sfxFound = !!media && Object.keys(media.sfx).length > 0;
  const musicDir = media?.musicDir ?? "~/Music/NieRDeck";
  const noMusic = t("noMusic", { dir: musicDir });
  const onOff = (v: boolean | null) => (v == null ? "—" : v ? t("on") : t("off"));
  const trackLabel = (x: { number: number | null; title: string }) => `${x.number != null ? `${String(x.number).padStart(2, "0")}. ` : ""}${x.title}`;

  // ───── Options NieRDeck : les trois interrupteurs ─────
  const optionRows: NierOption[] = TOGGLES.map((x) => ({ id: x.id, label: t(x.label), badge: settings[x.id] ? t("on") : t("off"), active: settings[x.id] }));
  const optionsDetail = (row?: string) => {
    const selected = TOGGLES.find((x) => x.id === row);
    return (
      <div>
        <NierOptionList options={optionRows} selectedId={row} />
        <Text>{selected ? t(selected.description) : t("optionsHelp")}</Text>
      </div>
    );
  };

  // ───── Volume : bruitages et musique, chacun sous son titre ─────
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
  const volumeRows = ["sfxVolume", ...(sfxFound ? [] : ["install"]), "musicVolume"];
  const volumeRow = (v: (typeof VOLUMES)[number]): NierOption => ({ id: v.id, label: t(v.label), badge: settings[v.id] ? `${settings[v.id]} %` : t("muted") });
  const volumeDetail = (row?: string) => (
    <div>
      <Section>{t("sfxShort")}</Section>
      <NierMeter label={t("sfxVolume")} value={settings.sfxVolume} mutedLabel={t("muted")} />
      <NierOptionList
        options={[volumeRow(VOLUMES[0]), ...(sfxFound ? [] : [{ id: "install", label: sfxSetup.loaderInstalled ? t("sfxDownloadPack") : t("sfxInstallAll") }])]}
        selectedId={row}
      />
      <Text>{sfxStatus}</Text>
      <Section>{t("musicShort")}</Section>
      <NierMeter label={t("musicVolume")} value={settings.musicVolume} mutedLabel={t("muted")} />
      <NierOptionList options={[volumeRow(VOLUMES[1])]} selectedId={row} />
      <Text>{tracks.length ? t("volumeHelp") : noMusic}</Text>
    </div>
  );

  // ───── Paramètres Steam : réglages de base, puis les vrais paramètres ─────
  const steamRows = ["wifi", "bluetooth", "airplane", "brightness", "openSteam"];
  const brightnessPct = system.brightness == null ? null : Math.round(system.brightness * 100);
  const steamDetail = (row?: string) => (
    <div>
      <Section>{t("connectivity")}</Section>
      <NierOptionList
        options={[
          { id: "wifi", label: "Wi-Fi", badge: onOff(system.wifi), active: !!system.wifi },
          { id: "bluetooth", label: "Bluetooth", badge: onOff(system.bluetooth), active: !!system.bluetooth },
          { id: "airplane", label: t("airplaneMode"), badge: onOff(system.airplane), active: !!system.airplane },
        ]}
        selectedId={row}
      />
      <Section>{t("display")}</Section>
      <NierMeter label={t("brightness")} value={brightnessPct ?? 0} mutedLabel="0 %" />
      <NierOptionList options={[{ id: "brightness", label: t("brightness"), badge: brightnessPct == null ? "—" : `${brightnessPct} %` }]} selectedId={row} />
      <Section>{t("steamSettings")}</Section>
      <NierOptionList options={[{ id: "openSteam", label: t("openSteamSettings") }]} selectedId={row} />
      <Text>{row === undefined ? t("steamSettingsHelp") : t("steamSettingsDesc")}</Text>
    </div>
  );

  // ───── Musique en cours : deux interrupteurs puis la liste des morceaux ─────
  const musicRows: NierOption[] = [
    { id: "music", label: t("backgroundMusic"), badge: settings.musicEnabled ? t("on") : t("off") },
    { id: "shuffle", label: t("shuffle"), badge: settings.musicShuffle ? t("yes") : t("no") },
    ...tracks.map((x) => ({ id: `t:${x.id}`, label: trackLabel(x), active: now.track?.id === x.id })),
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
        <Section>{row === undefined ? t("tracksHelp", { n: tracks.length }) : t("tracks")}</Section>
        <NierOptionList options={musicRows} selectedId={row} />
      </div>
    );
  };

  const adjustVolume = (id: "sfxVolume" | "musicVolume", delta: number) => {
    const value = Math.max(0, Math.min(100, settings[id] + delta * VOLUME_STEP));
    if (value !== settings[id]) {
      updateSettings({ [id]: value });
      playSfx(delta > 0 ? "volumeUp" : "volumeDown");
    }
  };

  return {
    menuTitle: t("settings"),
    items: [
      { id: "options", label: t("nierOptions") },
      {
        id: "track",
        label: t("nowPlaying"),
        badge: !tracks.length ? "—" : !settings.musicEnabled ? t("no") : now.track?.number != null ? String(now.track.number) : undefined,
      },
      { id: "volume", label: t("volume") },
      { id: "language", label: t("language"), badge: LANGS.find((l) => l.id === settings.language)?.label },
      { id: "updates", label: t("updates"), badge: updates.checking ? "…" : status?.available ? `→ ${status.latest}` : status?.current },
      { id: "steam", label: t("steamSettings") },
      { id: "diagnostic", label: t("diagnostic") },
    ],
    detail: (id, row) => {
      if (id === "options") return { title: t("nierOptions"), content: optionsDetail(row) };
      if (id === "volume") return { title: t("volume"), content: volumeDetail(row) };
      if (id === "steam") return { title: t("steamSettings"), content: steamDetail(row) };
      if (id === "track") return { title: t("nowPlaying"), content: musicDetail(row) };
      if (id === "language") {
        return {
          title: t("language"),
          content: (
            <div>
              <Text>{t("languageDesc")}</Text>
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
              description={status?.error ? t("githubError", { error: status.error }) : status?.available ? t("updateAvailable") : t("upToDate")}
            />
          ),
        };
      }
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
    },
    activate: (id) => {
      if (id === "track") {
        // Sans morceau, A relit le dossier ; sinon, le panneau prend la main.
        playSfx("confirm");
        void loadMedia(true);
      } else if (id === "updates") {
        playSfx("confirm");
        if (status?.available) installUpdate(status).catch((e) => console.error("[NieRDeck] mise à jour", e));
        else void updates.check();
      }
    },
    panel: (id) => {
      if (id === "options") {
        return {
          rows: TOGGLES.map((x) => x.id),
          activate: (row) => {
            const toggle = TOGGLES.find((x) => x.id === row);
            if (!toggle) return;
            playSfx(settings[toggle.id] ? "toggleOff" : "toggleOn");
            updateSettings({ [toggle.id]: !settings[toggle.id] });
          },
        };
      }
      if (id === "volume") {
        return {
          rows: volumeRows,
          activate: (row) => {
            if (row !== "install") return;
            playSfx("confirm");
            void setupNierSounds();
          },
          adjust: (row, delta) => {
            if (row !== "sfxVolume" && row !== "musicVolume") return false;
            adjustVolume(row, delta);
            return true;
          },
          adjustable: (row) => row === "sfxVolume" || row === "musicVolume",
        };
      }
      if (id === "steam") {
        return {
          rows: steamRows,
          activate: (row) => {
            const flip = (v: boolean | null) => {
              playSfx(v ? "toggleOff" : "toggleOn");
              return !v;
            };
            if (row === "wifi") setWifi(flip(system.wifi));
            else if (row === "bluetooth") setBluetooth(flip(system.bluetooth));
            else if (row === "airplane") setAirplaneMode(flip(system.airplane));
            else if (row === "openSteam") {
              playSfx("confirm");
              Navigation.Navigate("/settings");
            }
          },
          adjust: (row, delta) => {
            if (row !== "brightness" || system.brightness == null) return false;
            setBrightness(system.brightness + delta * BRIGHTNESS_STEP);
            playSfx(delta > 0 ? "volumeUp" : "volumeDown");
            return true;
          },
          adjustable: (row) => row === "brightness",
        };
      }
      if (id === "language") {
        return {
          rows: LANGS.map((l) => l.id),
          initial: settings.language,
          activate: (row) => {
            playSfx("confirm");
            updateSettings({ language: row as NierSettings["language"] });
          },
        };
      }
      if (id === "track" && tracks.length) {
        return {
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
        };
      }
      return undefined;
    },
    hint: (id) =>
      id === "track"
        ? tracks.length
          ? t("choose")
          : t("reload")
        : id === "updates"
          ? status?.available
            ? t("install")
            : t("check")
          : id === "diagnostic"
            ? undefined
            : t("choose"),
  };
}
