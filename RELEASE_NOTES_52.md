# Noor Release 52

- Restore all sixteen fiqh lessons across eight sections by making the standalone content container scrollable. Flexible quiz options and scroll reset make long answers and results reachable; exiting a quiz requires an explicit decision so accidental Back preserves answers.
- Compact the shared header to 60px and retain independent content scrolling.
- Original parchment and geographic ink atlas derived from existing terrain/coastline data, with eight sourced locations, location chips above the map, smooth focus, drag/pinch zoom and closable context cards.
- Remove migration checkbox, zoom slider, regional filter buttons and map progress/title clutter while preserving journey progress.
- Update historical atlas tests and add Noor 52 UI and Android diagnostic checks. The native QA reacquires the active WebView around reload/unlock and waits for the visible Quran toolbar before using real UI controls.

Publication is gated by TypeScript, Quran/font integrity, unit/integration tests, production build, real Chromium flows, Gradle build and Android background/locked-screen playback checks. A build alone does not establish functional playback.

Terrain: Mapzen Terrain Tiles, USGS SRTM/GMTED2010, NOAA ETOPO1. Coastline: Natural Earth, public domain. Modern approximate positions are educational references, not precise revelation locations.
