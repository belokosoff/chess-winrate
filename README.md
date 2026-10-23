# Winrate Stats for Chess.com

**English** | [Русский](README.ru.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md)

A browser extension for Chrome and Firefox (Manifest V3) that shows player statistics on chess.com.
It uses only the public chess.com API and never suggests moves. Unofficial, not affiliated with Chess.com.

## Features

- A stats panel on profile pages (`/member/<username>`), during a game (for your opponent) and on the home page (for your own username from the settings).
- Tabs: Overview, Openings, Endings, When, Trend, Insights, Losses, Compare, Head to head.
- Winrate by color, opening, mode, time control (3+0, 10+0, …) and period; strongest and weakest openings.
- Insights: time usage, winrate against stronger and weaker opponents, sessions (how you play after a loss), accuracy.
- Trend: rating goal with an estimate, week-over-week report, rating and rolling winrate charts.
- Losses: your last 15 losses with a link to the game review on chess.com.
- Compare: two players side by side.
- A "take a break" hint after 3 losses in a row.
- A `WR xx%` badge next to usernames, CSV and JSON export.
- Light and dark themes, a draggable panel (double-click the header to reset it), `Alt+W` collapses the panel.
- A settings popup: language (English/Russian), theme, default period and mode, how many months to load, your username, goal, clear cache.

## Install

**Chrome:** open `chrome://extensions`, enable "Developer mode", click "Load unpacked" and select this folder.

**Firefox:** open `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on…" and select `manifest.json`.
A temporary add-on disappears after Firefox restarts; for a permanent install the add-on has to be signed on addons.mozilla.org.

## Notes

- Head to head is computed from your own games. Enter your username in the popup; otherwise the bottom player on the board is assumed to be you.
- Games are stored in `storage.local` in a compact form. Past months are cached for good, the current month is refreshed every 5 minutes.
- The username selector in a game (`[data-test-element="user-tagline-username"]`) depends on the chess.com markup and may change.
- Accuracy is available only for games you opened a Game Review for on chess.com.

## Publishing

```bash
node scripts/build.js
```

Creates `dist/winrate-stats-chrome-<version>.zip` and `dist/winrate-stats-firefox-<version>.zip`.
Step-by-step instructions and store texts: [store/listing.md](store/listing.md). Privacy policy: [PRIVACY.md](PRIVACY.md).

## Development

```bash
node test/test.js
```

`test/harness.html` renders the panel with real API data without installing the extension. Run
`python3 -m http.server 8765` in the project root and open `http://127.0.0.1:8765/test/harness.html`
(parameters: `?user=<name>&me=<name>&lang=en&kind=profile&goal=450&theme=light`).

## License

MIT, see [LICENSE](LICENSE).
