# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.0] - 2026-10-23

### Added
- Game calendar in the "When" tab: one cell per day, colored by the day's winrate, brightness by the number of games.
- Puzzle rating and Puzzle Rush best score in the Overview tab.
- Interface in Spanish, German and French (in addition to English and Russian).

### Changed
- The cache of API responses is limited to about 4 MB. The least recently used entries are removed first, and a write that fails because of the storage quota is retried after cleaning up.
- Firefox 140 (Android 142) is now required, as `data_collection_permissions` needs it.

## [1.0.0] - 2026-10-23

### Added
- Stats panel on profile pages, during a game (for the opponent) and on the home page (for your own username).
- Tabs: Overview, Openings, Endings, When, Trend, Insights, Losses, Compare, Head to head.
- Winrate by color, opening, mode, time control and period; strongest and weakest openings.
- Time usage, winrate against stronger and weaker opponents, sessions, accuracy.
- Rating goal with an estimate, week-over-week report, rating and rolling winrate charts.
- Last losses with a link to the game review; "take a break" hint after 3 losses in a row.
- `WR` badge next to usernames; CSV and JSON export.
- Light and dark themes, draggable panel, `Alt+W` to collapse, settings popup.
- English and Russian interface.
