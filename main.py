import asyncio
import hashlib
import json
import os
import re
import secrets
from urllib.parse import unquote

import decky


def _settings_path() -> str:
    return os.path.join(decky.DECKY_SETTINGS_DIR, "settings.json")


def _installed_version() -> str:
    """Version du package.json livré avec le plugin (fixée par le workflow de release)."""
    try:
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "package.json"), "r", encoding="utf-8") as f:
            return str(json.load(f).get("version", "0.0.0"))
    except Exception:
        return "0.0.0"


# ───────────── Sons et musique ─────────────
# Les fichiers audio de NieR (bruitages, bande originale) appartiennent à
# Square Enix / PlatinumGames : ils ne sont pas livrés avec le plugin. On lit
# ceux que l'utilisateur a copiés sur son Deck :
#  - bruitages : le pack NieR « YoRHa Decky » de l'extension Audio Loader
#    (~/homebrew/sounds/) : c'est Audio Loader qui le distribue, pas NieRDeck ;
#  - musique : ~/Music/NieRDeck (mp3, ogg...).
# Un petit serveur HTTP local (127.0.0.1, port aléatoire, jeton secret) les
# sert à l'interface, comme le fait benderthemes.

AUDIO_EXT = {".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".flac": "audio/flac", ".m4a": "audio/mp4", ".opus": "audio/ogg"}


class _Media:
    server = None
    port = 0
    token = secrets.token_hex(16)
    files: dict = {}  # identifiant -> chemin : seuls ces fichiers sont servis


_media = _Media()


def _music_dir() -> str:
    return os.path.join(decky.DECKY_USER_HOME, "Music", "NieRDeck")


def _pack_name(folder: str) -> str:
    """Nom d'un pack Audio Loader (pack.json), ou celui de son dossier."""
    try:
        with open(os.path.join(folder, "pack.json"), "r", encoding="utf-8") as f:
            return str(json.load(f).get("name") or os.path.basename(folder))
    except Exception:
        return os.path.basename(folder)


def _sfx_dir():
    """Dossier du pack de bruitages NieR / YoRHa installé avec Audio Loader, ou None."""
    root = os.path.join(decky.DECKY_HOME, "sounds")
    preferred = os.path.join(root, "YoRHa Decky")
    if os.path.isdir(preferred):
        return preferred
    try:
        for name in sorted(os.listdir(root)):
            folder = os.path.join(root, name)
            if os.path.isdir(folder) and re.search(r"yorha|nier", f"{name} {_pack_name(folder)}", re.IGNORECASE):
                return folder
    except OSError:
        pass
    return None


def _register(path: str) -> str:
    # Clé stable : une nouvelle lecture du dossier ne casse pas un morceau en cours de lecture.
    key = hashlib.sha1(path.encode("utf-8", "surrogateescape")).hexdigest()[:16]
    _media.files[key] = path
    return key


# « Nier Automata - 01. Significance - Nothing » → numéro 1, titre « Significance - Nothing »
_TRACK_PREFIX = re.compile(r"^(?:nier\s*automata\s*-\s*)?(?:(\d+)[.\s_-]+)?", re.IGNORECASE)


def _music_tracks():
    folder = _music_dir()
    os.makedirs(folder, exist_ok=True)
    found = []
    # Le dossier, et un niveau de sous-dossiers (ex. l'album copié tel quel).
    subfolders = [os.path.join(folder, d) for d in sorted(os.listdir(folder)) if os.path.isdir(os.path.join(folder, d))]
    for current in [folder] + subfolders:
        names = sorted(os.listdir(current))
        for name in names:
            stem, ext = os.path.splitext(name)
            if ext.lower() not in AUDIO_EXT:
                continue
            m = _TRACK_PREFIX.match(stem)
            title = stem[m.end():].strip() if m else stem
            found.append({
                "id": _register(os.path.join(current, name)),
                "title": title or stem,
                "number": int(m.group(1)) if m and m.group(1) else None,
            })
    return found


async def _media_info():
    await _ensure_server()
    base = f"http://127.0.0.1:{_media.port}/{_media.token}" if _media.server else None
    sfx_dir = _sfx_dir()
    sfx = {}
    if sfx_dir:
        for name in sorted(os.listdir(sfx_dir)):
            if os.path.splitext(name)[1].lower() in AUDIO_EXT:
                sfx[name] = _register(os.path.join(sfx_dir, name))
    music = await asyncio.get_running_loop().run_in_executor(None, _music_tracks)
    return {"base": base, "sfx": sfx, "sfxDir": sfx_dir, "music": music, "musicDir": _music_dir()}


async def _send(writer, status: str, headers: dict, body: bytes = b""):
    head = f"HTTP/1.1 {status}\r\n" + "".join(f"{k}: {v}\r\n" for k, v in headers.items()) + "\r\n"
    writer.write(head.encode("latin-1") + body)
    await writer.drain()


async def _serve(reader, writer):
    """GET /<jeton>/<identifiant> : un des fichiers enregistrés, avec prise en charge de Range."""
    try:
        line = (await asyncio.wait_for(reader.readline(), 15)).decode("latin-1").strip()
        req = {}
        while True:
            h = (await asyncio.wait_for(reader.readline(), 15)).decode("latin-1")
            if h in ("\r\n", "\n", ""):
                break
            k, _, v = h.partition(":")
            req[k.strip().lower()] = v.strip()
        parts = line.split(" ")
        method = parts[0] if parts else ""
        seg = unquote(parts[1].split("?", 1)[0] if len(parts) > 1 else "/").strip("/").split("/")
        base = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Range",
            "Access-Control-Expose-Headers": "Content-Length, Content-Range",
            "Connection": "close",
            "Cache-Control": "no-store",
        }
        if method == "OPTIONS":
            await _send(writer, "204 No Content", base)
            return
        path = _media.files.get(seg[1]) if len(seg) == 2 and seg[0] == _media.token else None
        if method not in ("GET", "HEAD") or not path or not os.path.isfile(path):
            await _send(writer, "404 Not Found", {**base, "Content-Length": "0"})
            return
        size = os.path.getsize(path)
        ext = os.path.splitext(path)[1].lower()
        start, end, status = 0, size - 1, "200 OK"
        rng = re.match(r"bytes=(\d*)-(\d*)", req.get("range", ""))
        if rng and size:
            if rng.group(1):
                start = int(rng.group(1))
                if rng.group(2):
                    end = min(int(rng.group(2)), size - 1)
            elif rng.group(2):
                start = max(0, size - int(rng.group(2)))
            if start > end:
                await _send(writer, "416 Range Not Satisfiable", {**base, "Content-Range": f"bytes */{size}", "Content-Length": "0"})
                return
            status = "206 Partial Content"
        headers = {
            **base,
            "Content-Type": AUDIO_EXT.get(ext) or "application/octet-stream",
            "Accept-Ranges": "bytes",
            "Content-Length": str(end - start + 1),
        }
        if status.startswith("206"):
            headers["Content-Range"] = f"bytes {start}-{end}/{size}"
        await _send(writer, status, headers)
        if method == "HEAD":
            return
        with open(path, "rb") as f:
            f.seek(start)
            left = end - start + 1
            while left > 0:
                buf = f.read(min(262144, left))
                if not buf:
                    break
                writer.write(buf)
                await writer.drain()
                left -= len(buf)
    except Exception:
        pass
    finally:
        try:
            writer.close()
        except Exception:
            pass


async def _ensure_server():
    if _media.server is not None:
        return
    try:
        _media.server = await asyncio.start_server(_serve, "127.0.0.1", 0)
        _media.port = _media.server.sockets[0].getsockname()[1]
    except Exception as e:
        decky.logger.error(f"serveur audio impossible : {e}")
        _media.server = None


class Plugin:
    async def _main(self):
        decky.logger.info("NieRDeck chargé")

    async def _unload(self):
        if _media.server is not None:
            _media.server.close()
            _media.server = None
        decky.logger.info("NieRDeck déchargé")

    # ───── sons et musique (fichiers locaux du Deck) ─────
    async def get_media(self):
        """Bruitages et musiques trouvés sur le Deck, et l'adresse du serveur qui les sert."""
        try:
            return await _media_info()
        except Exception as e:
            decky.logger.error(f"sons et musique indisponibles : {e}")
            return {"base": None, "sfx": {}, "sfxDir": None, "music": [], "musicDir": _music_dir(), "error": str(e)}

    # ───── mises à jour (releases GitHub) ─────
    async def get_version(self):
        """Version installée. La release GitHub est lue côté interface (fetchNoCors) :
        le Python de Decky n'a pas toujours les certificats pour joindre GitHub."""
        return _installed_version()

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
