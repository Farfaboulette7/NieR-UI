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
import hashlib
import json
import os
import shutil
import stat
import tempfile

import decky

CLI_NAME = "FarfaLauncherDeck-linux-x86_64"
LAUNCHER_REPO = "Farfaboulette7/FarfaLauncher"
# Commandes de lecture appelables directement par l'interface.
READ_COMMANDS = {"info", "consoles", "jeux", "recherche", "installes", "jeu", "executables", "synchroniser", "historique",
                 "resultat", "reveil", "favoris", "fiche", "succes", "compte-ra", "commandes"}
WRITE_COMMANDS = {"desinstaller", "choisir", "deconnexion", "utiliser", "langue", "restaurer", "veille", "favori"}
TIMEOUT = 180
# Pages de livret rendues en PNG (pdftoppm, fourni par SteamOS), gardées au plus.
MANUAL_PAGES_KEPT = 300
# Longueur maximale d'une ligne JSON du moteur (une fiche de jeu PC peut peser plusieurs Mo).
LINE_LIMIT = 64 * 1024 * 1024


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


async def run(args: list, stdin: str | None = None, on_line=None, timeout: float = TIMEOUT, on_proc=None) -> dict:
    """Lance le programme ; renvoie {"data": ...} ou {"error": code, "message": ...}.
    `on_line` reçoit les autres lignes JSON (progression), `on_proc` le processus lancé."""
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
            # Une fiche de jeu PC liste tous ses fichiers sur une seule ligne (94 Ko pour
            # NieR:Automata) : la limite par défaut de 64 Ko la faisait échouer.
            limit=LINE_LIMIT,
        )
    except Exception as e:
        decky.logger.error(f"FarfaLauncherDeck impossible à lancer : {e}")
        return {"error": "cli_failed", "message": str(e)}
    if on_proc is not None:
        on_proc(proc)
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
        # Processus de chaque installation en cours (pour l'annuler).
        self._procs: dict = {}
        # Livret → forme de ses pages (lue une fois par pdfinfo).
        self._pdf_shapes: dict = {}
        # (jeu, n° du livret) → réponse de `livret` (chemin du PDF en cache).
        self._manual_files: dict = {}

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

    async def install(self, rom_id: int, emulator: str | None = None, recomp: str | None = None) -> bool:
        """Installation en arrière-plan : événements catalogue_progress puis catalogue_done.
        `emulator` ou `recomp` : la façon de jouer choisie (sinon celle conseillée)."""
        if rom_id in self._installs:
            return False
        args = ["installer", rom_id]
        if emulator:
            args += ["--emulateur", emulator]
        elif recomp:
            args += ["--recomp", recomp]

        async def progress(msg):
            if msg.get("type") == "progress":
                await decky.emit("catalogue_progress", msg.get("data"))

        async def job():
            try:
                result = await run(args, on_line=progress, timeout=6 * 3600, on_proc=lambda p: self._procs.__setitem__(rom_id, p))
                await decky.emit("catalogue_done", {"romId": rom_id, **result})
            finally:
                self._installs.pop(rom_id, None)
                self._procs.pop(rom_id, None)

        self._installs[rom_id] = asyncio.get_running_loop().create_task(job())
        return True

    def cancel(self, rom_id: int) -> bool:
        """Annule une installation : le moteur reçoit le signal d'arrêt et s'arrête proprement
        (comme « Annuler » dans le launcher). Ce qui était déjà installé reste en place."""
        proc = self._procs.get(rom_id)
        if proc is not None and proc.returncode is None:
            decky.logger.info(f"installation du jeu {rom_id} annulée")
            proc.terminate()
            return True
        # Installation lancée avant un redémarrage du plugin : le moteur tourne encore, seul.
        pid = _orphan_installs().get(rom_id)
        if pid is None:
            return False
        decky.logger.info(f"installation du jeu {rom_id} annulée (moteur {pid}, lancé avant le redémarrage)")
        try:
            os.kill(pid, 15)
        except OSError:
            return False
        return True

    def installing(self) -> list:
        return sorted(set(self._installs.keys()) | set(_orphan_installs().keys()))

    async def image(self, url: str) -> str | None:
        """Image du serveur RomM (avec le jeton), servie à l'interface par le serveur local."""
        res = await run(["image", url], timeout=60)
        path = (res.get("data") or {}).get(url)
        return self._register_file(path) if path and os.path.isfile(path) else None

    # ───── livrets PDF : le navigateur de Steam ne les affiche pas, on rend page par page ─────
    async def manual_page(self, rom_id: int, index: int, page: int, width: int) -> dict:
        """Page `page` (à partir de 1) du livret n° `index`, en PNG large de `width` pixels."""
        # Chemin du PDF gardé : tourner une page ne relance pas le moteur (qui relit le jeu au serveur).
        data = self._manual_files.get((int(rom_id), int(index)))
        if not data or not os.path.isfile(data.get("path") or ""):
            res = await run(["livret", int(rom_id), int(index)], timeout=600)
            data = res.get("data") or {}
            if not data.get("path") or not os.path.isfile(data["path"]):
                return {"error": res.get("error") or "manual", "message": res.get("message") or "Livret introuvable."}
            self._manual_files[(int(rom_id), int(index))] = data
        path = data["path"]
        if not shutil.which("pdftoppm") or not shutil.which("pdfinfo"):
            return {"error": "pdftoppm", "message": "pdftoppm manque sur ce Deck (paquet poppler de SteamOS)."}
        shapes = await self._pdf_pages(path)
        pages = len(shapes)
        if pages < 1:
            return {"error": "pdf", "message": "Livret illisible."}
        page = max(1, min(pages, int(page)))
        width = max(200, min(4000, int(width)))
        folder = os.path.join(decky.DECKY_PLUGIN_RUNTIME_DIR, "livrets")
        os.makedirs(folder, exist_ok=True)
        key = hashlib.sha1(path.encode("utf-8", "surrogateescape")).hexdigest()[:16]
        base = os.path.join(folder, f"{key}-{page}-{width}")
        out = base + ".png"
        if not os.path.isfile(out):
            proc = await asyncio.create_subprocess_exec(
                "pdftoppm", "-png", "-singlefile", "-f", str(page), "-l", str(page),
                "-scale-to-x", str(width), "-scale-to-y", "-1", path, base,
                stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
            )
            try:
                await asyncio.wait_for(proc.wait(), 60)
            except asyncio.TimeoutError:
                proc.kill()
            if not os.path.isfile(out):
                return {"error": "pdf", "message": f"Page {page} illisible."}
            self._prune_pages(folder)
        return {"data": {"url": self._register_file(out), "page": page, "pages": pages, "wide": shapes, "count": data.get("count", 1)}}

    async def _pdf_pages(self, path: str) -> list:
        """Forme de chaque page : True pour une page à l'italienne (plus large que haute)."""
        cached = self._pdf_shapes.get(path)
        if cached is not None:
            return cached
        # Pages vues dans les deux premiers passages (taille et rotation, page par page).
        proc = await asyncio.create_subprocess_exec(
            "pdfinfo", "-f", "1", "-l", "100000", path, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
        )
        try:
            out, _ = await asyncio.wait_for(proc.communicate(), 30)
        except asyncio.TimeoutError:
            proc.kill()
            return []
        sizes: dict = {}
        rotations: dict = {}
        total = 0
        for line in out.decode("utf-8", "replace").splitlines():
            if line.startswith("Pages:"):
                try:
                    total = int(line.split(":", 1)[1])
                except ValueError:
                    return []
                continue
            parts = line.split()
            # « Page    3 size: 594.96 x 841.92 pts (A4) », « Page    3 rot:  90 »
            if len(parts) >= 4 and parts[0] == "Page" and parts[1].isdigit():
                n = int(parts[1])
                try:
                    if parts[2] == "size:" and len(parts) >= 6:
                        sizes[n] = (float(parts[3]), float(parts[5]))
                    elif parts[2] == "rot:":
                        rotations[n] = int(float(parts[3])) % 180
                except ValueError:
                    pass
        shapes = []
        for n in range(1, total + 1):
            w, h = sizes.get(n, (1.0, 1.414))
            if rotations.get(n) == 90:
                w, h = h, w
            shapes.append(w > h)
        self._pdf_shapes[path] = shapes
        return shapes

    @staticmethod
    def _prune_pages(folder: str):
        try:
            files = sorted((os.path.join(folder, f) for f in os.listdir(folder)), key=os.path.getmtime)
            for f in files[:-MANUAL_PAGES_KEPT]:
                os.remove(f)
        except OSError:
            pass

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

    async def update_cli_if_newer(self) -> dict:
        """Met le moteur à jour quand FarfaLauncher a publié une version plus récente que la
        sienne (ou qu'il manque). Une version de test plus récente n'est jamais remplacée."""
        try:
            tag = await latest_tag(LAUNCHER_REPO)
        except Exception as e:
            return {"error": "update_failed", "message": str(e)}
        current = None
        if os.path.isfile(cli_path()):
            current = (await run(["version"], timeout=30)).get("data")
        if current and _version_key(tag) <= _version_key(str(current)):
            return {"data": {"version": current, "updated": False}}
        decky.logger.info(f"FarfaLauncherDeck {current or 'absent'} → {tag}")
        result = await self.update_cli()
        if "data" in result:
            result["data"]["updated"] = True
        return result

    # ───── mise à jour du programme depuis les releases du launcher ─────
    async def update_cli(self) -> dict:
        """Télécharge FarfaLauncherDeck de la dernière version de FarfaLauncher (curl :
        le Python de Decky n'a pas toujours les certificats pour joindre GitHub)."""
        try:
            # Liens directs des releases, sans l'API de GitHub (limitée à 60 appels par heure).
            tag = await latest_tag(LAUNCHER_REPO)
            dest = cli_path()
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            fd, tmp = tempfile.mkstemp(dir=os.path.dirname(dest))
            os.close(fd)
            try:
                await _curl(["-fsSL", "-o", tmp, f"https://github.com/{LAUNCHER_REPO}/releases/download/{tag}/{CLI_NAME}"], timeout=600)
            except Exception:
                os.remove(tmp)
                return {"error": "not_published", "message": f"Pas de {CLI_NAME} dans la version {tag}."}
            os.chmod(tmp, os.stat(tmp).st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
            # Remplacé d'un coup : un jeu lancé garde l'ancien fichier ouvert.
            os.replace(tmp, dest)
            return {"data": {"version": tag}}
        except Exception as e:
            decky.logger.error(f"mise à jour de FarfaLauncherDeck impossible : {e}")
            return {"error": "update_failed", "message": str(e)}


def _orphan_installs() -> dict:
    """Moteurs `installer <id>` en cours, lus dans /proc : {id du jeu: pid}. Ils survivent à un
    redémarrage du plugin (mise à jour), qui perd alors leur trace."""
    found = {}
    exe = cli_path()
    try:
        pids = [p for p in os.listdir("/proc") if p.isdigit()]
    except OSError:
        return found
    for pid in pids:
        try:
            with open(f"/proc/{pid}/cmdline", "rb") as f:
                args = f.read().split(b"\0")
        except OSError:
            continue
        if len(args) >= 3 and args[0].decode("utf-8", "replace") == exe and args[1] == b"installer":
            try:
                found[int(args[2])] = int(pid)
            except ValueError:
                pass
    return found


def _version_key(v: str) -> tuple:
    """`v1.1.1` → (1, 1, 1, 1) ; une bêta (`1.2.0-beta.3`) passe avant la stable du même numéro."""
    v = v.strip().lstrip("v")
    base, _, pre = v.partition("-")
    nums = []
    for part in base.split("."):
        digits = "".join(c for c in part if c.isdigit())
        nums.append(int(digits) if digits else 0)
    while len(nums) < 3:
        nums.append(0)
    pre_num = int("".join(c for c in pre if c.isdigit()) or 0) if pre else 0
    return (*nums[:3], 0 if pre else 1, pre_num)


async def latest_tag(repo: str) -> str:
    """Tag de la dernière release, lu sur la redirection de github.com/<dépôt>/releases/latest
    (pas l'API de GitHub : 60 appels par heure pour toute la maison)."""
    out = await _curl(["-fsSIL", "-o", "/dev/null", "-w", "%{url_effective}", f"https://github.com/{repo}/releases/latest"])
    url = out.decode("utf-8", "replace").strip()
    if "/releases/tag/" not in url:
        raise RuntimeError(f"aucune release publiée ({url})")
    return url.rsplit("/releases/tag/", 1)[1]


async def _curl(args: list, timeout: float = 60) -> bytes:
    curl = shutil.which("curl") or "/usr/bin/curl"
    proc = await asyncio.create_subprocess_exec(curl, *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, env=_env())
    out, err = await asyncio.wait_for(proc.communicate(), timeout)
    if proc.returncode != 0:
        raise RuntimeError(err.decode("utf-8", "replace").strip() or f"curl {proc.returncode}")
    return out
