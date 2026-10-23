# Winrate Stats for Chess.com

[English](README.md) | [Русский](README.ru.md) | [Español](README.es.md) | [Deutsch](README.de.md) | **Français**

[![CI](https://github.com/belokosoff/chess-winrate/actions/workflows/ci.yml/badge.svg)](https://github.com/belokosoff/chess-winrate/actions/workflows/ci.yml)

Une extension de navigateur pour Chrome et Firefox (Manifest V3) qui affiche les statistiques des joueurs sur chess.com.
Elle utilise uniquement l'API publique de chess.com et ne suggère jamais de coups. Non officielle, sans lien avec Chess.com.

<p align="center">
  <img src="docs/screenshots/overview.png" width="300" alt="Aperçu">
  <img src="docs/screenshots/insights.png" width="300" alt="Analyse">
</p>
<p align="center">
  <img src="docs/screenshots/openings.png" width="300" alt="Ouvertures">
  <img src="docs/screenshots/trend.png" width="300" alt="Tendance">
</p>

## Fonctionnalités

- Un panneau de statistiques sur les profils (`/member/<pseudo>`), pendant une partie (pour votre adversaire) et sur la page d'accueil (pour votre propre pseudo défini dans les réglages).
- Onglets : Aperçu, Ouvertures, Fins de partie, Quand, Tendance, Analyse, Défaites, Comparer et Face à face.
- Taux de victoires par couleur, ouverture, mode, cadence (3+0, 10+0, …) et période ; vos ouvertures les plus fortes et les plus faibles.
- Analyse : utilisation du temps, résultats contre des adversaires plus forts et plus faibles, sessions (comment vous jouez après une défaite) et précision.
- Tendance : objectif de classement avec une estimation, bilan semaine par semaine, graphiques du classement et du taux de victoires glissant.
- Défaites : vos 15 dernières défaites avec un lien vers l'analyse de la partie sur chess.com.
- Un calendrier des parties dans l'onglet « Quand » et votre classement aux problèmes dans l'aperçu.
- Comparer : deux joueurs côte à côte.
- Un rappel « faites une pause » après 3 défaites d'affilée.
- Un badge `WR xx%` à côté des pseudos, ainsi qu'un export CSV et JSON.
- Thèmes clair et sombre, panneau déplaçable (un double-clic sur l'en-tête le remet en place) et `Alt+W` pour le replier.
- Une fenêtre de réglages : langue (anglais, russe, espagnol, allemand, français), thème, période et mode par défaut, nombre de mois à charger, votre pseudo, objectif et vidage du cache.

## Installation

**Chrome :** ouvrez `chrome://extensions`, activez le « Mode développeur », cliquez sur « Charger l'extension non empaquetée » et choisissez ce dossier.

**Firefox :** ouvrez `about:debugging#/runtime/this-firefox`, cliquez sur « Charger un module complémentaire temporaire… » et choisissez `manifest.json`.
Un module temporaire disparaît au redémarrage de Firefox ; pour une installation permanente, il doit être signé sur addons.mozilla.org.

## Remarques

- Le face à face est calculé à partir de vos propres parties. Indiquez votre pseudo dans la fenêtre de réglages ; sinon, le joueur du bas de l'échiquier est considéré comme étant vous.
- Les parties sont stockées de façon compacte dans `storage.local`. Les mois passés sont mis en cache définitivement, le mois en cours est actualisé toutes les 5 minutes.
- Le sélecteur des pseudos dans une partie (`[data-test-element="user-tagline-username"]`) dépend du code de chess.com et peut changer.
- La précision n'est disponible que pour les parties dont vous avez ouvert l'analyse sur chess.com.

## Publication

```bash
node scripts/build.js
```

Crée `dist/winrate-stats-chrome-<version>.zip` et `dist/winrate-stats-firefox-<version>.zip`.
Instructions pas à pas et textes pour les boutiques : [store/listing.md](store/listing.md). Politique de confidentialité : [PRIVACY.md](PRIVACY.md).

## Développement

```bash
node test/test.js
```

`test/harness.html` affiche le panneau avec de vraies données de l'API, sans installer l'extension. Lancez
`python3 -m http.server 8765` à la racine du projet et ouvrez `http://127.0.0.1:8765/test/harness.html`
(paramètres : `?user=<nom>&me=<nom>&lang=en&kind=profile&goal=450&theme=light`).

## Licence

MIT, voir [LICENSE](LICENSE).
