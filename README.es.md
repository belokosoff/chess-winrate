# Winrate Stats for Chess.com

[English](README.md) | [Русский](README.ru.md) | **Español** | [Deutsch](README.de.md) | [Français](README.fr.md)

Extensión de navegador para Chrome y Firefox (Manifest V3) que muestra estadísticas de los jugadores en chess.com.
Usa solo la API pública de chess.com y nunca sugiere jugadas. No es oficial y no está afiliada a Chess.com.

> La interfaz de la extensión está disponible en inglés y ruso.

## Funciones

- Un panel de estadísticas en los perfiles (`/member/<usuario>`), durante una partida (para tu rival) y en la página de inicio (para tu propio usuario indicado en los ajustes).
- Pestañas: Resumen, Aperturas, Finales, Cuándo, Tendencia, Análisis, Derrotas, Comparar y Cara a cara.
- Porcentaje de victorias por color, apertura, modo, control de tiempo (3+0, 10+0, …) y periodo; tus aperturas más fuertes y más débiles.
- Análisis: uso del tiempo, resultados contra rivales más fuertes y más débiles, sesiones (cómo juegas tras una derrota) y precisión.
- Tendencia: objetivo de rating con una estimación, informe semana a semana y gráficos de rating y de porcentaje de victorias.
- Derrotas: tus últimas 15 derrotas con un enlace al análisis de la partida en chess.com.
- Comparar: dos jugadores lado a lado.
- Un aviso de «haz una pausa» tras 3 derrotas seguidas.
- Una insignia `WR xx%` junto a los nombres de usuario y exportación a CSV y JSON.
- Temas claro y oscuro, panel movible (doble clic en el encabezado para devolverlo a su sitio) y `Alt+W` para plegarlo.
- Una ventana de ajustes: idioma (inglés/ruso), tema, periodo y modo por defecto, meses que se cargan, tu usuario, objetivo y borrar la caché.

## Instalación

**Chrome:** abre `chrome://extensions`, activa el «Modo de desarrollador», pulsa «Cargar descomprimida» y elige esta carpeta.

**Firefox:** abre `about:debugging#/runtime/this-firefox`, pulsa «Cargar complemento temporal…» y elige `manifest.json`.
Un complemento temporal desaparece al reiniciar Firefox; para una instalación permanente hay que firmarlo en addons.mozilla.org.

## Notas

- El cara a cara se calcula con tus propias partidas. Indica tu usuario en la ventana de ajustes; si no, se asume que eres el jugador de abajo del tablero.
- Las partidas se guardan en `storage.local` de forma compacta. Los meses pasados se guardan en caché de forma permanente y el mes actual se actualiza cada 5 minutos.
- El selector de nombres de usuario en una partida (`[data-test-element="user-tagline-username"]`) depende del código de chess.com y puede cambiar.
- La precisión solo está disponible para partidas cuyo análisis abriste en chess.com.

## Publicación

```bash
node scripts/build.js
```

Crea `dist/winrate-stats-chrome-<versión>.zip` y `dist/winrate-stats-firefox-<versión>.zip`.
Instrucciones paso a paso y textos para las tiendas: [store/listing.md](store/listing.md). Política de privacidad: [PRIVACY.md](PRIVACY.md).

## Desarrollo

```bash
node test/test.js
```

`test/harness.html` muestra el panel con datos reales de la API sin instalar la extensión. Ejecuta
`python3 -m http.server 8765` en la raíz del proyecto y abre `http://127.0.0.1:8765/test/harness.html`
(parámetros: `?user=<nombre>&me=<nombre>&lang=en&kind=profile&goal=450&theme=light`).

## Licencia

MIT, consulta [LICENSE](LICENSE).
