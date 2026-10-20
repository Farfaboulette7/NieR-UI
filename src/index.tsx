import { ButtonItem, Navigation, PanelSection, PanelSectionRow, staticClasses, ToggleField } from "@decky/ui";
import { definePlugin, routerHook } from "@decky/api";
import { HomeSwitch } from "./launcher/HomeSwitch";
import { LauncherPage } from "./launcher/LauncherPage";
import { loadSettings, updateSettings, useSettings } from "./launcher/settings";

const ROUTE = "/nierdeck";
const HOME_ROUTE = "/library/home";

const NierIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2 12 8 6l14 6-14 6Zm6-1.4a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Z" />
  </svg>
);

const StandalonePage = () => <LauncherPage mode="standalone" />;

function QuickAccessPanel() {
  const [settings, loaded] = useSettings();
  return (
    <PanelSection>
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
        <ButtonItem
          layout="below"
          description="Ouvre le launcher au style YoRHA."
          onClick={() => {
            Navigation.CloseSideMenus();
            Navigation.Navigate(ROUTE);
          }}
        >
          Ouvrir NieRDeck
        </ButtonItem>
      </PanelSectionRow>
    </PanelSection>
  );
}

export default definePlugin(() => {
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
      routerHook.removeRoute(ROUTE);
      routerHook.removePatch(HOME_ROUTE, homePatch);
    },
  };
});
