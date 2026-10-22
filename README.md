# NieRDeck

Plugin [Decky Loader](https://decky.xyz) pour Steam Deck : un launcher de jeux pour le mode Gaming, au style des menus YoRHA de *NieR:Automata*.

## Structure

- `src/nier-ui/` : la couche visuelle (tokens, layout, fiche de jeu, police). Elle ne dépend que de React, pour pouvoir être réutilisée ailleurs (par exemple en mode bureau sur BazziteOS).
- `src/launcher/` : la page du launcher côté Decky (état, données).
- `src/index.tsx` : le point d'entrée du plugin (route `/nierdeck` et bouton dans le menu d'accès rapide).

## Installation sur le Steam Deck

Chaque push sur `main` publie automatiquement une release. Dans Decky : Paramètres → Développeur → « Installer un plugin depuis une URL », avec :

```
https://github.com/Farfaboulette7/NieR-UI/releases/latest/download/NieRDeck.zip
```

La même URL installe toujours la dernière version.

## Build

```bash
npm install
npm run build
```

Copier ensuite `dist/`, `package.json`, `plugin.json` et `main.py` dans `~/homebrew/plugins/NieRDeck/` sur le Deck, puis redémarrer Decky (`sudo systemctl restart plugin_loader`).

## Crédits

- Palette et pictogrammes inspirés de [YoRHA-UI-BetterDiscord](https://github.com/AccraZed/YoRHA-UI-BetterDiscord) et de [yorha](https://github.com/metakirby5/yorha).
- Police : [Be Vietnam Pro](https://github.com/bettergui/BeVietnamPro), sous licence SIL OFL 1.1 (`src/nier-ui/fonts/OFL.txt`).
- *NieR:Automata* est une marque de Square Enix. Projet de fan non officiel.
