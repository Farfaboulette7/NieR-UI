# NieRDeck

*[English version](README.md)*

Plugin [Decky Loader](https://decky.xyz) pour Steam Deck : un launcher de jeux pour le mode Gaming, au style des menus YoRHA de *NieR:Automata*.

## Fonctionnalités

- **Launcher** à la place de l'accueil Steam, avec cinq onglets :
  - **Bibliothèque** : les jeux installés, avec le temps de jeu (jeux non-Steam compris), la dernière session et la taille.
  - **Récents** : les 30 derniers jeux joués.
  - **Collections** : tes collections Steam, favoris en tête.
  - **Boutique** : ta liste de souhaits Steam, avec prix et réductions. A ouvre la page du jeu dans le Magasin.
  - **Système** : les réglages du plugin (voir plus bas).
- **Page de jeu NieR** à la place de celle de Steam. Elle glisse depuis la droite par-dessus le launcher, et repart avec B :
  - Jouer / Installer ;
  - Informations (Magasin Steam) ;
  - Succès ;
  - Contacts qui ont le jeu ;
  - accès à la page Steam d'origine.
- **Ouverture YoRHa** au démarrage du launcher, et **écran « Lancement en cours »** qui couvre l'attente de Steam jusqu'au démarrage du jeu.
- **Thème NieR de Steam** : menu STEAM, accès rapide, boîtes de dialogue, fenêtre de volume.
- **Bruitages et musique de fond** quand tu es dans NieRDeck. Y met la musique en pause ou la relance ; Y maintenu passe au morceau suivant.
- **Langues** : français et anglais.
- **Mises à jour** depuis le plugin, sans retaper l'URL.

## Installation

Chaque push sur `main` publie une release. Dans Decky : Paramètres → Développeur → « Installer un plugin depuis une URL », avec :

```
https://github.com/Farfaboulette7/NieR-UI/releases/latest/download/NieRDeck.zip
```

Ensuite, les mises à jour se font depuis **Système → Mises à jour** (ou ··· → NieRDeck → Mises à jour).

## Sons et musique

Les bruitages et la bande originale de NieR:Automata appartiennent à Square Enix / PlatinumGames : **ils ne sont pas fournis avec le plugin**. NieRDeck joue les fichiers que tu copies sur ton Deck (en mode Bureau par exemple) :

| Quoi | Où, sur le Deck |
|---|---|
| Bruitages : le pack Audio Loader *YoRHa Decky* | `~/homebrew/sounds/YoRHa Decky/` |
| Musique de fond : des `.mp3`, `.ogg`, `.flac`… (sous-dossiers acceptés) | `~/Music/NieRDeck/` (créé au premier lancement) |

Ensuite, dans **Système** :

- **Musique en cours** ouvre un panneau pour :
  - activer ou couper la musique ;
  - activer ou couper la lecture aléatoire (sinon, les morceaux suivent l'ordre de l'album) ;
  - choisir un morceau.
- **Volume des bruitages** et **Volume de la musique** se règlent avec ← →.

## Commandes

| Bouton | Action |
|---|---|
| Croix / stick gauche | Se déplacer |
| L1 / R1 | Changer d'onglet |
| A | Ouvrir, valider |
| B | Retour |
| Y | Pause / lecture de la musique |
| Y (maintenu) | Morceau suivant |
| ← → | Régler un volume (Système) |

Sur la page d'un jeu, A sur *Informations*, *Succès* ou *Contacts* donne la main à la zone de droite, où ↑ ↓ fait défiler. B rend la main au menu.

## Réglages

Tous activés par défaut, dans **Système** ou dans ··· → NieRDeck :

| Réglage | Effet |
|---|---|
| Lancer au démarrage | NieRDeck remplace l'accueil Steam. |
| Page de jeu NieR | La page NieR remplace la page d'un jeu Steam. |
| Thème NieR de Steam | Couleurs YoRHA pour le menu STEAM, l'accès rapide et les boîtes de dialogue. |
| Langue | Français / English. Par défaut, la langue du Deck. |

## Organisation du projet

| Chemin | Contenu |
|---|---|
| `src/nier-ui/` | La couche visuelle : tokens, mise en page, composants, police. Uniquement React, sans Decky, pour pouvoir être réutilisée ailleurs (par exemple un launcher en mode bureau sur BazziteOS). |
| `src/launcher/` | Le côté Decky : données (bibliothèque, Magasin, succès, contacts), manette, audio, thème Steam, réglages, traductions (`i18n.ts`). |
| `src/index.tsx` | Point d'entrée du plugin : remplacement de l'accueil et de la page de jeu, panneau d'accès rapide. |
| `main.py` | Backend : fichier de réglages, version installée, serveur local des fichiers audio. |
| `.github/workflows/release.yml` | Compile et publie `NieRDeck.zip` à chaque push. |

## Compilation

```bash
npm install
npm run build
```

Pour une installation manuelle, copie `dist/`, `package.json`, `plugin.json` et `main.py` dans `~/homebrew/plugins/NieRDeck/` sur le Deck, puis redémarre Decky (`sudo systemctl restart plugin_loader`).

## Crédits

- Palette et pictogrammes inspirés de [YoRHA-UI-BetterDiscord](https://github.com/AccraZed/YoRHA-UI-BetterDiscord) et de [yorha](https://github.com/metakirby5/yorha).
- Plusieurs techniques d'intégration à Steam (bibliothèque, succès, serveur audio) reprises de benderthemes.
- Emblème YoRHa : issu de *NieR:Automata* (Square Enix), utilisé pour ce projet de fan.
- Police : [Be Vietnam Pro](https://github.com/bettergui/BeVietnamPro), licence SIL OFL 1.1 (`src/nier-ui/fonts/OFL.txt`).
- *NieR:Automata* est une marque de Square Enix. Projet de fan non officiel.
