import { ButtonItem, Navigation, PanelSection, PanelSectionRow, staticClasses, ToggleField } from "@decky/ui";
import { definePlugin, routerHook } from "@decky/api";
import { useEffect, useRef, useState } from "react";
import { HomeSwitch } from "./launcher/HomeSwitch";
import { LauncherPage } from "./launcher/LauncherPage";
import { getSettings, loadSettings, onSettingsChange, updateSettings, useSettings } from "./launcher/settings";
import { registerSteamDocument, setSteamMenuTheme, themedWindows } from "./launcher/steamMenuTheme";

const ROUTE = "/nierdeck";
const HOME_ROUTE = "/library/home";

const NierIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2 12 8 6l14 6-14 6Zm6-1.4a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Z" />
  </svg>
);

/** Ouvre le launcher sans jamais en créer un second : s'il remplace l'accueil, on y retourne. */
function openLauncher() {
  Navigation.CloseSideMenus();
  Navigation.Navigate(getSettings().replaceHome ? HOME_ROUTE : ROUTE);
}

function StandalonePage() {
  const [settings] = useSettings();
  // Garde-fou si la page est atteinte autrement (historique) alors que l'accueil est déjà remplacé.
  useEffect(() => {
    if (settings.replaceHome) Navigation.Navigate(HOME_ROUTE);
  }, [settings.replaceHome]);
  return settings.replaceHome ? null : <LauncherPage mode="standalone" />;
}

/** Liste des fenêtres habillées, rafraîchie tant que le panneau est ouvert. */
function useThemedWindows(): string {
  const [list, setList] = useState(() => themedWindows().join(", "));
  useEffect(() => {
    const iv = setInterval(() => setList(themedWindows().join(", ")), 1000);
    return () => clearInterval(iv);
  }, []);
  return list;
}

function QuickAccessPanel() {
  const [settings, loaded] = useSettings();
  const windows = useThemedWindows();
  // Ce panneau est affiché dans la fenêtre d'accès rapide : on la signale au thème.
  const anchor = useRef<HTMLDivElement>(null);
  useEffect(() => registerSteamDocument(anchor.current?.ownerDocument), []);
  return (
    <PanelSection>
      <div ref={anchor} style={{ display: "none" }} />
      <PanelSectionRow>
        <ToggleField
          label="Lancer au démarrage"
          description="Remplace l'accueil Steam par NieRDeck, dès le démarrage du mode Gaming."
          checked={settings.replaceHome}
          disabled={!loaded}
          onChange={(on) => updateSettings({ replaceHome: on })}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ToggleField
          label="Thème NieR de Steam"
          description={
            settings.themeSteamMenus
              ? `Fenêtres habillées : ${windows || "aucune pour l'instant"}`
              : "Habille le menu STEAM, l'accès rapide, les boîtes de dialogue et les pages de jeu aux couleurs YoRHA."
          }
          checked={settings.themeSteamMenus}
          disabled={!loaded}
          onChange={(on) => updateSettings({ themeSteamMenus: on })}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" description="Affiche le launcher au style YoRHA." onClick={openLauncher}>
          Ouvrir NieRDeck
        </ButtonItem>
      </PanelSectionRow>
    </PanelSection>
  );
}

export default definePlugin(() => {
  // Le thème des menus suit le réglage (et attend qu'il soit chargé).
  let menuTheme: boolean | null = null;
  const syncMenuTheme = () => {
    const on = getSettings().themeSteamMenus;
    if (on !== menuTheme) setSteamMenuTheme((menuTheme = on));
  };
  const stopSync = onSettingsChange(syncMenuTheme);
  void loadSettings();

  routerHook.addRoute(ROUTE, StandalonePage, { exact: true });

  // L'accueil Steam est enveloppé dans HomeSwitch, qui choisit selon le réglage.
  const homePatch = routerHook.addPatch(HOME_ROUTE, (props: any) => {
    try {
      const original = props.children;
      if (original != null && original?.type !== HomeSwitch) props.children = <HomeSwitch original={original} />;
    } catch (e) {
      console.error("[NieRDeck] patch de l'accueil", e);
    }
    return props;
  });

  return {
    name: "NieRDeck",
    titleView: <div className={staticClasses.Title}>NieRDeck</div>,
    content: <QuickAccessPanel />,
    icon: <NierIcon />,
    onDismount() {
      stopSync();
      setSteamMenuTheme(false);
      routerHook.removeRoute(ROUTE);
      routerHook.removePatch(HOME_ROUTE, homePatch);
    },
  };
});
