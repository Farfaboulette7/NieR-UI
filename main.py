import json
import os

import decky


def _settings_path() -> str:
    return os.path.join(decky.DECKY_SETTINGS_DIR, "settings.json")


class Plugin:
    async def _main(self):
        decky.logger.info("NieRDeck chargé")

    async def _unload(self):
        decky.logger.info("NieRDeck déchargé")

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
