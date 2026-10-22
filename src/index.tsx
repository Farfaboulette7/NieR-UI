import { DropdownItem, PanelSection, PanelSectionRow, staticClasses, ToggleField } from "@decky/ui";
import { definePlugin, routerHook } from "@decky/api";
import { useEffect, useRef, useState } from "react";
import { stopMusic } from "./launcher/audio";
import { LaunchScreen } from "./launcher/LaunchScreen";
import { refreshLocalIndex } from "./launcher/steamLibrary";
import { GamePageSwitch } from "./launcher/GamePage";
import { HomeSwitch } from "./launcher/HomeSwitch";
import { getSettings, loadSettings, onSettingsChange, updateSettings, useSettings } from "./launcher/settings";
import { LANGS, t } from "./launcher/i18n";
import { notifyIfUpdateAvailable, UpdatesSection } from "./launcher/Updates";
import { registerSteamDocument, setSteamMenuTheme, themedWindows } from "./launcher/steamMenuTheme";

const HOME_ROUTE = "/library/home";
const GAME_ROUTE = "/library/app/:appid";

const NierIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2 12 8 6l14 6-14 6Zm6-1.4a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Z" />
  </svg>
);

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
    <>
    <PanelSection>
      <div ref={anchor} style={{ display: "none" }} />
      <PanelSectionRow>
        <ToggleField
          label={t("replaceHome")}
          description={t("replaceHomeDesc")}
          checked={settings.replaceHome}
          disabled={!loaded}
          onChange={(on) => updateSettings({ replaceHome: on })}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ToggleField
          label={t("replaceGamePage")}
          description={t("replaceGamePageDesc")}
          checked={settings.replaceGamePage}
          disabled={!loaded}
          onChange={(on) => updateSettings({ replaceGamePage: on })}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ToggleField
          label={t("themeSteam")}
          description={
            settings.themeSteamMenus
              ? t("themedWindows", { list: windows || t("themedNone") })
              : t("themeSteamDesc")
          }
          checked={settings.themeSteamMenus}
          disabled={!loaded}
          onChange={(on) => updateSettings({ themeSteamMenus: on })}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <DropdownItem
          label={t("language")}
          rgOptions={LANGS.map((l) => ({ data: l.id, label: l.label }))}
          selectedOption={settings.language}
          disabled={!loaded}
          onChange={(o) => updateSettings({ language: o.data })}
        />
      </PanelSectionRow>
    </PanelSection>
    <UpdatesSection />

    </>
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
  refreshLocalIndex(true);
  // Laisse Steam finir de démarrer avant d'interroger GitHub.
  const updateTimer = setTimeout(() => void notifyIfUpdateAvailable(), 15_000);

  // L'accueil Steam est enveloppé dans HomeSwitch, qui choisit selon le réglage.
  // Écran de lancement d'un jeu, par-dessus toutes les pages Steam.
  routerHook.addGlobalComponent("NieRDeckLaunch", LaunchScreen);

  const homePatch = routerHook.addPatch(HOME_ROUTE, (props: any) => {
    try {
      const original = props.children;
      if (original != null && original?.type !== HomeSwitch) props.children = <HomeSwitch original={original} />;
    } catch (e) {
      console.error("[NieRDeck] patch de l'accueil", e);
    }
    return props;
  });

  // Même principe pour la page d'un jeu : GamePageSwitch choisit entre la page NieR et celle de Steam.
  const gamePatch = routerHook.addPatch(GAME_ROUTE, (props: any) => {
    try {
      const original = props.children;
      if (original != null && original?.type !== GamePageSwitch) props.children = <GamePageSwitch original={original} />;
    } catch (e) {
      console.error("[NieRDeck] patch de la page de jeu", e);
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
      clearTimeout(updateTimer);
      setSteamMenuTheme(false);
      stopMusic();
      routerHook.removePatch(HOME_ROUTE, homePatch);
      routerHook.removePatch(GAME_ROUTE, gamePatch);
      routerHook.removeGlobalComponent("NieRDeckLaunch");
    },
  };
});
