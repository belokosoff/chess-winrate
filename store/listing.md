# Тексты для магазинов

Название: **Winrate Stats for Chess.com**
Версия: 1.0.0
Категория: Chrome — Fun (или Productivity); Firefox — Games & Entertainment.
Языки: English (основной), Русский.

## Краткое описание (Chrome, до 132 символов)

Winrate, openings, endings, time usage and head-to-head stats for chess.com players. Statistics only, no move hints.

## Single purpose (Chrome)

Show statistics (winrate, openings, endings, time usage, accuracy, trends) for chess.com players on chess.com pages, using the public chess.com API.

## Обоснование разрешений

| Разрешение | Зачем |
|---|---|
| `storage` | Хранить настройки (язык, тема, период, цель, положение панели) и кэш ответов публичного API, чтобы не делать лишних запросов. |
| `https://api.chess.com/*` | Запрашивать публичную статистику и архивы партий игроков у официального API chess.com. |
| Content script на `https://www.chess.com/*` | Читать ники на странице и показывать панель статистики и значки WR. |

Удалённого кода нет, данные никуда не отправляются, аналитики нет.

## Поддержка и исходный код

- Support website / контакт: https://github.com/belokosoff/chess-winrate/issues (почту не указывать)
- Исходный код: https://github.com/belokosoff/chess-winrate
- Политика конфиденциальности (публичная ссылка для Chrome): https://github.com/belokosoff/chess-winrate/blob/main/PRIVACY.md

## Раскрытие данных (форма Chrome / AMO)

- Персональные данные не собираются.
- Chrome: отметить, что расширение не собирает и не передаёт ни одну из категорий данных; подтвердить три пункта о неиспользовании данных не по назначению, не продаже и не использовании для кредитных решений.
- Firefox: в манифесте `data_collection_permissions.required = ["none"]`.
- Политика конфиденциальности: `PRIVACY.md` (опубликуйте по публичной ссылке, например на GitHub, и вставьте ссылку в форму Chrome; в AMO можно вставить текст в поле Privacy Policy).

## Описание (English)

Winrate Stats for Chess.com adds a compact stats panel to chess.com. Open any profile, or play a game, and see how a player really performs.

**What you get**
- Winrate overall, by mode, by color and by time control (3+0, 5+0, 10+0, 15+10 …)
- Openings: your strongest and weakest openings as white and black
- How games end: checkmate, resignation, on time, draws
- Time usage: how much of your clock you actually use, and winrate by time used
- Winrate against stronger and weaker opponents
- Accuracy from games you reviewed on chess.com
- Sessions: how you play after a loss or two losses in a row, with a "take a break" warning
- Week-over-week report, rating trend and an optional rating goal with an estimate
- Last losses with a link straight to the game review
- Head-to-head record against your opponent and a compare tab for any two players
- A WR badge next to usernames in a game
- Export to CSV and JSON; light and dark themes; draggable panel; Alt+W to collapse
- English and Russian

**Privacy:** uses only the public chess.com API, stores settings and cache locally, collects nothing. It never analyses positions or suggests moves. Unofficial extension, not affiliated with Chess.com.

## Описание (Русский)

Winrate Stats for Chess.com добавляет на chess.com компактную панель статистики. Откройте профиль или сыграйте партию и посмотрите, как игрок играет на самом деле.

**Что внутри**
- Винрейт: общий, по режимам, по цвету и по контролю времени (3+0, 5+0, 10+0, 15+10 …)
- Дебюты: самые сильные и самые слабые за белых и чёрных
- Как заканчиваются партии: мат, сдача, время, ничьи
- Расход времени: какую часть часов вы реально используете и винрейт по ней
- Винрейт против более сильных и более слабых соперников
- Точность по партиям, которые вы разбирали на chess.com
- Сессии: как вы играете после поражения и двух поражений подряд, с предупреждением «сделайте перерыв»
- Отчёт «неделя к неделе», динамика рейтинга и необязательная цель по рейтингу с прогнозом
- Последние поражения со ссылкой на разбор партии
- Личные встречи с соперником и вкладка сравнения двух игроков
- Значок WR рядом с никами в партии
- Экспорт в CSV и JSON, светлая и тёмная темы, перетаскиваемая панель, Alt+W сворачивает
- Русский и английский интерфейс

**Приватность:** только публичный API chess.com, настройки и кэш хранятся локально, ничего не собирается. Расширение не анализирует позиции и не подсказывает ходы. Неофициальное расширение, не связано с Chess.com.

## Примечания для проверяющих (AMO / Chrome)

- Расширение не подсказывает ходы и не анализирует позиции: только статистика по уже завершённым партиям из публичного API.
- Исходный код не минифицирован и не собирается; пакет = исходники из корня проекта (`scripts/build.js` лишь копирует файлы и убирает ключ `browser_specific_settings` из пакета для Chrome).
- Проверка: открыть `https://www.chess.com/member/<ник>`, панель появится справа внизу.

## Скриншоты (нужны ваши реальные кадры)

Chrome: 1280×800 или 640×400, от 1 до 5 штук. AMO: любой размер, желательно от 3 штук.

1. Профиль игрока с открытой панелью (вкладка «Обзор»).
2. Страница партии: значки WR у обоих ников и панель соперника.
3. Вкладка «Разбор» (расход времени, рейтинг соперника, сессии).
4. Вкладка «Динамика» (цель, неделя, график).
5. Вкладка «Поражения» со ссылками на разбор.

Снимайте на аккаунте и профиле, которые не жалко показать публично.

## Как отправить

**Firefox (addons.mozilla.org)**
1. Войти или создать аккаунт на https://addons.mozilla.org/developers/
2. Submit a New Add-on → выбрать «On this site» (публично) или «On your own» (только подпись, без каталога).
3. Загрузить `dist/winrate-stats-firefox-1.0.0.zip`.
4. Исходники отправлять не нужно (код не минифицирован), на вопрос о build-процессе ответить «No».
5. Заполнить карточку из этого файла, добавить скриншоты и политику конфиденциальности.

**Chrome Web Store**
1. Аккаунт разработчика: https://chrome.google.com/webstore/devconsole (разовый взнос около 5 USD).
2. New item → загрузить `dist/winrate-stats-chrome-1.0.0.zip`.
3. Store listing: описание, скриншоты, иконка 128×128 уже в пакете, категория, язык.
4. Privacy: single purpose, обоснование разрешений, раскрытие данных, ссылка на политику.
5. Submit for review (обычно от нескольких часов до нескольких дней).

**Microsoft Edge Add-ons** (по желанию): тот же zip, что для Chrome.
