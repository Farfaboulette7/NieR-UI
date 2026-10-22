# NieRDeck

*[Version française](README.fr.md)*

A [Decky Loader](https://decky.xyz) plugin for the Steam Deck: a game launcher for Gaming mode, styled after the YoRHA menus of *NieR:Automata*.

## Features

- **Launcher** in place of the Steam home screen, with five tabs:
  - **Library**: installed games, with playtime (non-Steam games included), last session and size.
  - **Recent**: the last 30 games played.
  - **Collections**: your Steam collections, favorites first.
  - **Store**: your Steam wishlist, with prices and discounts. A opens the game's Store page.
  - **System**: the plugin settings (see below).
- **NieR game page** in place of Steam's. It slides in from the right over the launcher, and slides out on B:
  - Play / Install;
  - Information (from the Steam Store);
  - Achievements;
  - Friends who own the game;
  - a link to the original Steam page.
- **NieR theme for Steam**: STEAM menu, quick access menu, dialogs, volume popup.
- **Sound effects and background music** played while you are in NieRDeck. Y pauses or resumes the music.
- **Languages**: French and English.
- **Updates** from the plugin itself, without retyping the URL.

## Installation

Every push to `main` publishes a release. In Decky: Settings → Developer → *Install plugin from URL*, with:

```
https://github.com/Farfaboulette7/NieR-UI/releases/latest/download/NieRDeck.zip
```

After that, updates are done from **System → Updates** (or ··· → NieRDeck → Updates).

## Sound and music

NieR:Automata's sound effects and soundtrack belong to Square Enix / PlatinumGames, so **they are not shipped with the plugin**. NieRDeck plays the files you copy to your Deck (in Desktop mode, for example):

| What | Where on the Deck |
|---|---|
| Sound effects: the Audio Loader pack *YoRHa Decky* | `~/homebrew/sounds/YoRHa Decky/` |
| Background music: any `.mp3`, `.ogg`, `.flac`… (subfolders allowed) | `~/Music/NieRDeck/` (created at first launch) |

Then, in **System**:

- **Now playing** opens a panel to:
  - turn the music on or off;
  - switch shuffle on or off (otherwise tracks play in album order);
  - pick a track.
- **Sound effects volume** and **Music volume** are adjusted with ← →.

## Controls

| Button | Action |
|---|---|
| D-pad / left stick | Move |
| L1 / R1 | Switch tabs |
| A | Open, confirm |
| B | Back |
| Y | Pause / play the music |
| ← → | Adjust a volume (System) |

On the game page, A on *Information*, *Achievements* or *Friends* gives control to the right-hand panel, where ↑ ↓ scrolls. B gives control back to the menu.

## Settings

All on by default, in **System** or in ··· → NieRDeck:

| Setting | Effect |
|---|---|
| Launch at startup | NieRDeck replaces the Steam home screen. |
| NieR game page | The NieR page replaces Steam's game page. |
| NieR theme for Steam | YoRHA colors for the STEAM menu, quick access menu and dialogs. |
| Language | Français / English. Defaults to the Deck's language. |

## Project layout

| Path | Content |
|---|---|
| `src/nier-ui/` | The visual layer: tokens, layout, components, font. React only, no Decky imports, so it can be reused elsewhere (e.g. a desktop launcher on BazziteOS). |
| `src/launcher/` | The Decky side: data (library, store, achievements, friends), gamepad input, audio, Steam theme, settings, translations (`i18n.ts`). |
| `src/index.tsx` | Plugin entry point: route patches (home screen, game page) and the quick access panel. |
| `main.py` | Backend: settings file, installed version, local server for the audio files. |
| `.github/workflows/release.yml` | Builds and publishes `NieRDeck.zip` on every push. |

## Build

```bash
npm install
npm run build
```

For a manual install, copy `dist/`, `package.json`, `plugin.json` and `main.py` to `~/homebrew/plugins/NieRDeck/` on the Deck, then restart Decky (`sudo systemctl restart plugin_loader`).

## Credits

- Palette and pictograms inspired by [YoRHA-UI-BetterDiscord](https://github.com/AccraZed/YoRHA-UI-BetterDiscord) and [yorha](https://github.com/metakirby5/yorha).
- Several Steam integration techniques (library, achievements, audio server) adapted from benderthemes.
- Font: [Be Vietnam Pro](https://github.com/bettergui/BeVietnamPro), SIL OFL 1.1 (`src/nier-ui/fonts/OFL.txt`).
- *NieR:Automata* is a trademark of Square Enix. Unofficial fan project.
