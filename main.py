import asyncio
import json
import os
import urllib.request

import decky

RELEASES_URL = "https://api.github.com/repos/Farfaboulette7/NieR-UI/releases/latest"


def _settings_path() -> str:
    return os.path.join(decky.DECKY_SETTINGS_DIR, "settings.json")


def _installed_version() -> str:
    """Version du package.json livré avec le plugin (fixée par le workflow de release)."""
    try:
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "package.json"), "r", encoding="utf-8") as f:
            return str(json.load(f).get("version", "0.0.0"))
    except Exception:
        return "0.0.0"


def _version_tuple(version: str) -> tuple:
    parts = []
    for piece in version.lstrip("v").split("."):
        digits = "".join(c for c in piece if c.isdigit())
        parts.append(int(digits) if digits else 0)
    return tuple(parts)


def _update_status() -> dict:
    current = _installed_version()
    request = urllib.request.Request(RELEASES_URL, headers={"Accept": "application/vnd.github+json", "User-Agent": "NieRDeck"})
    with urllib.request.urlopen(request, timeout=10) as response:
        release = json.load(response)
    latest = str(release.get("tag_name", "")).lstrip("v")
    asset = next((a for a in release.get("assets", []) if a.get("name") == "NieRDeck.zip"), None)
    return {
        "current": current,
        "latest": latest,
        "url": asset.get("browser_download_url") if asset else None,
        "available": bool(asset) and _version_tuple(latest) > _version_tuple(current),
    }


class Plugin:
    async def _main(self):
        decky.logger.info("NieRDeck chargé")

    async def _unload(self):
        decky.logger.info("NieRDeck déchargé")

    # ───── mises à jour (releases GitHub) ─────
    async def get_update_status(self):
        try:
            return await asyncio.get_running_loop().run_in_executor(None, _update_status)
        except Exception as e:
            decky.logger.error(f"vérification des mises à jour impossible : {e}")
            return {"current": _installed_version(), "latest": None, "url": None, "available": False, "error": str(e)}

    # ───── réglages (fichier JSON dans le dossier settings de Decky) ─────
    async def get_settings(self):
        try:
            with open(_settings_path(), "r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, dict) else None
        except FileNotFoundError:
            return None
        except Exception as e:
            decky.logger.error(f"lecture des réglages impossible : {e}")
            return None

    async def set_settings(self, settings: dict) -> bool:
        if not isinstance(settings, dict):
            return False
        path = _settings_path()
        tmp = path + ".tmp"
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(settings, f, ensure_ascii=False, indent=2)
            os.replace(tmp, path)
            return True
        except Exception as e:
            decky.logger.error(f"écriture des réglages impossible : {e}")
            return False
