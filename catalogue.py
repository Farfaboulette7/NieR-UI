# Module « Catalogue » de NieRDeck : les jeux du serveur RomM de FarfaLauncher.
#
# Tout le travail (liste des jeux, installation avec les réglages de chaque recomp
# ou émulateur, sauvegardes) est fait par FarfaLauncherDeck, le moteur de
# FarfaLauncher sans interface, publié avec chaque version du launcher. Ce
# module le télécharge, l'appelle et relaie ses réponses (lignes JSON) à
# l'interface.
#
# Le jeton RomM est saisi sur le Deck et transmis au programme par son entrée
# standard : il n'est jamais renvoyé à l'interface ni écrit dans les journaux.

import asyncio
import base64
import json
import os
import shutil
import stat
import tempfile

import decky

CLI_NAME = "FarfaLauncherDeck-linux-x86_64"
RELEASES_URL = "https://api.github.com/repos/Farfaboulette7/FarfaLauncher/releases/latest"
# Commandes de lecture appelables directement par l'interface.
READ_COMMANDS = {"info", "consoles", "jeux", "recherche", "installes", "jeu", "executables", "synchroniser"}
WRITE_COMMANDS = {"desinstaller", "choisir", "deconnexion"}
TIMEOUT = 180


def cli_path() -> str:
    """Programme FarfaLauncherDeck, dans les données du plugin (lancé aussi par Steam)."""
    return os.path.join(decky.DECKY_PLUGIN_RUNTIME_DIR, "bin", CLI_NAME)


def _env() -> dict:
    # Même dossier de configuration que lors d'un lancement par Steam (~/.config/farfalauncherdeck).
    env = dict(os.environ)
    env["HOME"] = decky.DECKY_USER_HOME
    env.pop("LD_LIBRARY_PATH", None)
    env.pop("LD_PRELOAD", None)
    return env


def _shortcuts_path() -> str:
    return os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "catalogue.json")


async def run(args: list, stdin: str | None = None, on_line=None, timeout: float = TIMEOUT) -> dict:
    """Lance le programme ; renvoie {"data": ...} ou {"error": code, "message": ...}.
    `on_line` reçoit les autres lignes JSON (progression)."""
    path = cli_path()
    if not os.path.isfile(path):
        return {"error": "cli_missing", "message": "FarfaLauncherDeck n'est pas installé."}
    try:
        proc = await asyncio.create_subprocess_exec(
            path,
            *[str(a) for a in args],
            stdin=asyncio.subprocess.PIPE if stdin is not None else asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
            env=_env(),
            cwd=decky.DECKY_USER_HOME,
        )
    except Exception as e:
        decky.logger.error(f"FarfaLauncherDeck impossible à lancer : {e}")
        return {"error": "cli_failed", "message": str(e)}
    if stdin is not None:
        proc.stdin.write((stdin + "\n").encode("utf-8"))
        await proc.stdin.drain()
        proc.stdin.close()
    result = None

    async def read():
        nonlocal result
        while True:
            line = await proc.stdout.readline()
            if not line:
                break
            try:
                msg = json.loads(line)
            except Exception:
                continue
            kind = msg.get("type")
            if kind == "result":
                result = {"data": msg.get("data")}
            elif kind == "error":
                result = {"error": msg.get("code", "internal"), "message": msg.get("message", "")}
            elif on_line is not None:
                try:
                    await on_line(msg)
                except Exception:
                    pass

    try:
        await asyncio.wait_for(read(), timeout)
        await proc.wait()
    except asyncio.TimeoutError:
        proc.kill()
        return {"error": "timeout", "message": "FarfaLauncherDeck ne répond pas."}
    if result is None:
        return {"error": "cli_failed", "message": f"FarfaLauncherDeck s'est arrêté (code {proc.returncode})."}
    if "error" in result:
        decky.logger.warning(f"FarfaLauncherDeck {args[0] if args else ''} : {result['error']}")
    return result


class Catalogue:
    def __init__(self, register_file):
        # Sert un fichier local à l'interface (petit serveur HTTP de NieRDeck) ; renvoie son URL.
        self._register_file = register_file
        self._installs: dict = {}

    async def status(self) -> dict:
        """Programme installé, sa version, et l'état de la connexion au serveur."""
        if not os.path.isfile(cli_path()):
            return {"cli": False, "cliPath": cli_path()}
        info = await run(["info"], timeout=30)
        return {"cli": True, "cliPath": cli_path(), **info}

    async def call(self, args: list) -> dict:
        if not args or args[0] not in READ_COMMANDS | WRITE_COMMANDS:
            return {"error": "internal", "message": "commande refusée"}
        return await run(args)

    async def configure(self, server: str | None, token: str | None) -> dict:
        args = ["config"]
        if server:
            args += ["--serveur", server.strip()]
        if token:
            args.append("--jeton")
        return await run(args, stdin=token.strip() if token else None, timeout=60)

    async def install(self, rom_id: int, emulator: str | None = None) -> bool:
        """Installation en arrière-plan : événements catalogue_progress puis catalogue_done."""
        if rom_id in self._installs:
            return False
        args = ["installer", rom_id] + (["--emulateur", emulator] if emulator else [])

        async def progress(msg):
            if msg.get("type") == "progress":
                await decky.emit("catalogue_progress", msg.get("data"))

        async def job():
            try:
                result = await run(args, on_line=progress, timeout=6 * 3600)
                await decky.emit("catalogue_done", {"romId": rom_id, **result})
            finally:
                self._installs.pop(rom_id, None)

        self._installs[rom_id] = asyncio.get_running_loop().create_task(job())
        return True

    def installing(self) -> list:
        return list(self._installs.keys())

    async def image(self, url: str) -> str | None:
        """Image du serveur RomM (avec le jeton), servie à l'interface par le serveur local."""
        res = await run(["image", url], timeout=60)
        path = (res.get("data") or {}).get(url)
        return self._register_file(path) if path and os.path.isfile(path) else None

    async def image_base64(self, url: str) -> dict | None:
        """Image en base64, pour les visuels d'un raccourci Steam."""
        res = await run(["image", url], timeout=60)
        path = (res.get("data") or {}).get(url)
        if not path or not os.path.isfile(path):
            return None
        with open(path, "rb") as f:
            head = f.read(12)
            f.seek(0)
            data = base64.b64encode(f.read()).decode("ascii")
        fmt = "png" if head.startswith(b"\x89PNG") else "jpg"
        return {"data": data, "format": fmt}

    # ───── raccourcis Steam des jeux installés (jeu RomM → appid du raccourci) ─────
    def shortcuts(self) -> dict:
        try:
            with open(_shortcuts_path(), "r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, dict) else {}
        except Exception:
            return {}

    def set_shortcut(self, rom_id: int, appid: int | None) -> dict:
        data = self.shortcuts()
        if appid:
            data[str(rom_id)] = appid
        else:
            data.pop(str(rom_id), None)
        tmp = _shortcuts_path() + ".tmp"
        os.makedirs(os.path.dirname(tmp), exist_ok=True)
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f)
        os.replace(tmp, _shortcuts_path())
        return data

    # ───── mise à jour du programme depuis les releases du launcher ─────
    async def update_cli(self) -> dict:
        """Télécharge FarfaLauncherDeck de la dernière version de FarfaLauncher (curl :
        le Python de Decky n'a pas toujours les certificats pour joindre GitHub)."""
        try:
            out = await _curl(["-fsSL", "-H", "Accept: application/vnd.github+json", RELEASES_URL])
            release = json.loads(out)
            asset = next((a for a in release.get("assets", []) if a.get("name") == CLI_NAME), None)
            if not asset:
                return {"error": "not_published", "message": f"Pas de {CLI_NAME} dans la version {release.get('tag_name')}."}
            dest = cli_path()
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            fd, tmp = tempfile.mkstemp(dir=os.path.dirname(dest))
            os.close(fd)
            await _curl(["-fsSL", "-o", tmp, asset["browser_download_url"]], timeout=600)
            os.chmod(tmp, os.stat(tmp).st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
            # Remplacé d'un coup : un jeu lancé garde l'ancien fichier ouvert.
            os.replace(tmp, dest)
            return {"data": {"version": release.get("tag_name")}}
        except Exception as e:
            decky.logger.error(f"mise à jour de FarfaLauncherDeck impossible : {e}")
            return {"error": "update_failed", "message": str(e)}


async def _curl(args: list, timeout: float = 60) -> bytes:
    curl = shutil.which("curl") or "/usr/bin/curl"
    proc = await asyncio.create_subprocess_exec(curl, *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, env=_env())
    out, err = await asyncio.wait_for(proc.communicate(), timeout)
    if proc.returncode != 0:
        raise RuntimeError(err.decode("utf-8", "replace").strip() or f"curl {proc.returncode}")
    return out
