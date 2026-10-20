import { ButtonItem, Navigation, PanelSection, PanelSectionRow, staticClasses } from "@decky/ui";
import { definePlugin, routerHook } from "@decky/api";
import { LauncherPage } from "./launcher/LauncherPage";

const ROUTE = "/nierdeck";

const NierIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2 12 8 6l14 6-14 6Zm6-1.4a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Z" />
  </svg>
);

function QuickAccessPanel() {
  return (
    <PanelSection>
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
  routerHook.addRoute(ROUTE, LauncherPage, { exact: true });

  return {
    name: "NieRDeck",
    titleView: <div className={staticClasses.Title}>NieRDeck</div>,
    content: <QuickAccessPanel />,
    icon: <NierIcon />,
    onDismount() {
      routerHook.removeRoute(ROUTE);
    },
  };
});
