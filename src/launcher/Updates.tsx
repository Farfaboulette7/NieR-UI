// Mise à jour du plugin depuis les releases GitHub, via l'installateur de Decky
// (même mécanisme que « Installer un plugin depuis une URL », sans rien taper).
// Approche reprise de benderthemes (Updates.tsx).
import { ButtonItem, PanelSection, PanelSectionRow } from "@decky/ui";
import { callable, fetchNoCors, toaster } from "@decky/api";
import { useEffect, useState } from "react";

export interface UpdateStatus {
  current: string;
  latest: string | null;
  url: string | null;
  available: boolean;
  error?: string;
}

const PLUGIN_NAME = "NieRDeck";
// Types d'installation de Decky : 1 = réinstaller, 2 = mettre à jour.
const INSTALL_UPDATE = 2;

const RELEASES_URL = "https://api.github.com/repos/Farfaboulette7/NieR-UI/releases/latest";
const getVersion = callable<[], string>("get_version");

const versionParts = (v: string) => v.replace(/^v/, "").split(".").map((p) => parseInt(p, 10) || 0);
function isNewer(latest: string, current: string): boolean {
  const a = versionParts(latest);
  const b = versionParts(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

/** Dernière release GitHub, lue par le même canal que la fiche du Magasin. */
export async function getUpdateStatus(): Promise<UpdateStatus> {
  const current = await getVersion();
  try {
    const response = await fetchNoCors(RELEASES_URL, { headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) throw new Error(`GitHub a répondu ${response.status}`);
    const release = await response.json();
    const latest = String(release?.tag_name ?? "").replace(/^v/, "");
    const asset = (release?.assets ?? []).find((a: any) => a?.name === "NieRDeck.zip");
    const url: string | null = asset?.browser_download_url ?? null;
    return { current, latest, url, available: !!url && isNewer(latest, current) };
  } catch (e) {
    return { current, latest: null, url: null, available: false, error: String(e) };
  }
}

/** Backend interne de Decky (non documenté) : sert à lancer son installateur. */
const deckyBackend = (): any => (window as any).DeckyBackend ?? (window.opener as any)?.DeckyBackend;

export async function installUpdate(status: UpdateStatus) {
  const backend = deckyBackend();
  if (!backend?.call || !status.url || !status.latest) throw new Error("Installateur de Decky indisponible.");
  // Decky affiche sa propre fenêtre de confirmation, puis télécharge et installe le zip.
  await backend.call("utilities/install_plugin", status.url, PLUGIN_NAME, status.latest, "", INSTALL_UPDATE);
}

/** Au chargement du plugin : notification si une nouvelle version est disponible. */
export async function notifyIfUpdateAvailable() {
  try {
    const status = await getUpdateStatus();
    if (status.available) {
      toaster.toast({ title: "NieRDeck", body: `Mise à jour ${status.latest} disponible : ··· → NieRDeck → Mettre à jour.` });
    }
  } catch (e) {
    console.error("[NieRDeck] vérification des mises à jour", e);
  }
}

export function UpdatesSection() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  const check = async () => {
    setChecking(true);
    setMessage("");
    try {
      setStatus(await getUpdateStatus());
    } catch (e) {
      setMessage(`Vérification impossible : ${e}`);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void check();
  }, []);

  const update = async () => {
    if (!status) return;
    try {
      await installUpdate(status);
      setMessage("Confirme l'installation dans la fenêtre de Decky.");
    } catch (e) {
      setMessage(`Installation impossible : ${e}`);
    }
  };

  const summary = !status
    ? "Vérification…"
    : status.error
      ? `Version installée : ${status.current}. Impossible de joindre GitHub (${status.error}).`
      : status.available
        ? `Version installée : ${status.current}. Nouvelle version : ${status.latest}.`
        : `Version installée : ${status.current}. C'est la dernière.`;

  return (
    <PanelSection title="Mises à jour">
      <PanelSectionRow>
        <div style={{ fontSize: 12, lineHeight: 1.5 }}>{summary}</div>
      </PanelSectionRow>
      {status?.available && (
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={() => void update()}>
            Mettre à jour vers {status.latest}
          </ButtonItem>
        </PanelSectionRow>
      )}
      <PanelSectionRow>
        <ButtonItem layout="below" disabled={checking} onClick={() => void check()}>
          {checking ? "Vérification…" : "Rechercher une mise à jour"}
        </ButtonItem>
      </PanelSectionRow>
      {message && (
        <PanelSectionRow>
          <div style={{ fontSize: 12 }}>{message}</div>
        </PanelSectionRow>
      )}
    </PanelSection>
  );
}
