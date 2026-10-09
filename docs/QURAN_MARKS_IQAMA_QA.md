# Noor — Quran marks and editable Iqama minutes

Base: `7286e317312ea4d8a6bb04097b408a90aebe76ef` (latest main when work began). No version change or new release.

## Changes

- Separate checked Sajda word ranges from the later ayah where the margin sign appears (notably 16:49→50, 17:107→109, 27:25→26, 41:37→38).
- Letter-anchored overlays measure the already-shaped text with DOM Range. Each endpoint has a base-letter index and fractional position recorded from enlarged scan views; separate strokes follow natural line fragments. Small Quran vowel letters are excluded from base-letter indexing. It leaves Arabic text and the existing word gestures intact. No whole-ayah overline, Quran text replacements, or font substitution.
- Non-interactive rail outside the Quran text shows Sajda and Juz/Hizb/quarter labels. One ResizeObserver per text block prevents overlapping margin labels and reacts to font/viewport changes.
- All 240 quarter beginnings checked against downloaded Tanzil XML; 60 Hizb and 30 Juz beginnings are labels on those boundaries, not estimates from verse counts. No separate invented end-of-Hizb marker.
- Iqama input keeps an independent text draft. Focus selects the current text, Backspace can leave it empty, blur/save validates an integer in the existing 1–9 range. Invalid/empty input shows an inline error and preserves the last committed setting. Arabic and Persian digits are accepted. Saving a changed valid value uses the existing Android setter and rescheduling path.
- Updated the existing source-overlay build workflow so all added source/test files are applied over the archived base. Existing release publishing remains conditional on the original explicit release commit marker.

## References and scope

Visual reference: [KSU Electronic Mushaf](https://quran.ksu.edu.sa/m.php), default Medina/Hafs scans. Full pages and enlarged crops were inspected for all fifteen spans. The King Fahd Complex editions page could not be retrieved reliably in this session; no direct Complex source verification is claimed.

Partition reference: [Tanzil Quran Metadata](https://tanzil.net/docs/Quran_Metadata), [quran-data.xml](https://tanzil.net/res/text/metadata/quran-data.xml), CC-BY according to the downloaded XML header. Snapshot SHA-256: `8867c1d88191472adec9db694b3cd9f135b1a2ef580574d32cf888dcb22c5c7a`.

| Line ayah | Word indices (1-based) | Covered text | Margin ayah | Scan page |
|---|---|---|---|---|
| 7:206 | 11–11 | يَسْجُدُونَ | 7:206 | [176](https://quran.ksu.edu.sa/png_big/176.png) |
| 13:15 | 1–2 | وَلِلَّهِ يَسْجُدُ | 13:15 | [251](https://quran.ksu.edu.sa/png_big/251.png) |
| 16:49 | 1–2 | وَلِلَّهِ يَسْجُدُ | 16:50 | [272](https://quran.ksu.edu.sa/png_big/272.png) |
| 17:107 | 16–18 | يَخِرُّونَ لِلْأَذْقَانِ سُجَّدًا | 17:109 | [293](https://quran.ksu.edu.sa/png_big/293.png) |
| 19:58 | 27–28 | خَرُّوا۟ سُجَّدًا | 19:58 | [309](https://quran.ksu.edu.sa/png_big/309.png) |
| 22:18 | 5–6 | يَسْجُدُ لَهُۥ | 22:18 | [334](https://quran.ksu.edu.sa/png_big/334.png) |
| 22:77 | 5–5 | وَٱسْجُدُوا۟ | 22:77 | [341](https://quran.ksu.edu.sa/png_big/341.png) |
| 25:60 | 4–4 | ٱسْجُدُوا۟ | 25:60 | [365](https://quran.ksu.edu.sa/png_big/365.png) |
| 27:25 | 1–2 | أَلَّا يَسْجُدُوا۟ | 27:26 | [379](https://quran.ksu.edu.sa/png_big/379.png) |
| 32:15 | 8–9 | خَرُّوا۟ سُجَّدًا | 32:15 | [416](https://quran.ksu.edu.sa/png_big/416.png) |
| 38:24 | 30–31 | وَخَرَّ رَاكِعًا | 38:24 | [454](https://quran.ksu.edu.sa/png_big/454.png) |
| 41:37 | 12–13 | وَٱسْجُدُوا۟ لِلَّهِ | 41:38 | [480](https://quran.ksu.edu.sa/png_big/480.png) |
| 53:62 | 1–2 | فَٱسْجُدُوا۟ لِلَّهِ | 53:62 | [528](https://quran.ksu.edu.sa/png_big/528.png) |
| 84:21 | 5–6 | لَا يَسْجُدُونَ | 84:21 | [589](https://quran.ksu.edu.sa/png_big/589.png) |
| 96:19 | 4–4 | وَٱسْجُدْ | 96:19 | [598](https://quran.ksu.edu.sa/png_big/598.png) |

The current corpus assigns 96:19 to page 597; its line is on scan page 598. This is recorded as `datasetPage`, without altering current navigation or Quran data.

Endpoint references now record the printed stroke coordinates and the endpoint letter's ink interval. The range in 22:18 was corrected to include `لَهُۥ`. Font-specific DOM ranges place the stroke inside the corresponding base letters without splitting Arabic glyphs or changing the Quran text. The first consonant in 38:24 and the alif after the conjunction in 96:19 are explicit start anchors.

This is a geometric adaptation to the existing Noto Naskh, Amiri and Scheherazade fonts, **not a pixel-identical reproduction of the printed Medina font**. Fractional positions read from scans should not be mistaken for a certified reproduction of glyph outlines. No physical Android handset was used.

## Validation

- 70 Vitest tests pass (65 existing + five targeted mark/input tests).
- TypeScript `tsc --noEmit`: pass.
- Production Vite build: pass.
- `qa:quran`: 114 surahs, 6236 ayahs, 604 dataset pages; zero text differences; zero missing required Quran code points across all three bundled fonts.
- Existing `qa:release43`: pass.
- Independent downloaded XML comparison: all 240 quarter boundaries match.
- Production Chromium 153, mobile/touch: all 15 Sajda locations × three bundled fonts × light/dark phone widths (390×844 / 430×932): **90 views passed**. Amiri/Scheherazade also use 125% CSS zoom. Each visible first/last endpoint was independently remeasured from shaped-letter DOM ranges and differed from the stroke by at most 1 CSS pixel; no missing stroke, nonpositive stroke width, margin overlap or page error. These checks establish layout stability, not scan-to-font pixel identity.
- Actual runtime screenshots updated for 7:206, 22:18 and 41:37 in both modes. Detailed results: `qa/mushaf-marks/endpoint-runtime.json`.
- Browser keyboard: delete 1→empty→9, select/delete 10→5, invalid text paste simulation, empty save rejection, persisted setting after reload: pass. Existing bridge tests verify the setter and native source reads the same preference for scheduling; no real alarm delivery is claimed.
- The current app hardcodes continuous mode. Dormant page-mode rendering receives the same mark components, but page-mode runtime was not accessible and was not enabled by this patch.
- Source and workflow were uploaded through the signed-in Cloud Browser to the existing `main` branch. GitHub Actions run [37874977301](https://github.com/mozico-565/Noor/actions/runs/37874977301) succeeded for tested source commit `17a6469a14bf8cc0dc93bc23c38845a77fe26e7b`: all 70 web tests, Quran integrity, production web build, debug APK and unsigned AAB. The APK was downloaded and its SHA-256 checked against the build checksum: `fe37346930883ed532a8982bbd8bcb17dc2d9148dbfdabafd9054a7a54b206fa`. APK ZIP integrity passed; all 6236 Quran ayahs match the tested local corpus exactly, and the new stroke/endpoint/iqama code is physically bundled. APK package `com.noor.quran`, Android minimum 26, existing version retained. Android device installation, alarm delivery and keyboard interaction on a physical handset were not tested. No new release or version change.

## Real runtime screenshots

These are captured from the production app, not generated mockups:

| View | Light | Dark |
|---|---|---|
| Sajda 7:206 | [Screenshot](qa/mushaf-marks/sajda-7-206-light.png) | [Screenshot](qa/mushaf-marks/sajda-7-206-dark.png) |
| Line 41:37 | [Screenshot](qa/mushaf-marks/sajda-41-37-light.png) | [Screenshot](qa/mushaf-marks/sajda-41-37-dark.png) |
| Juz 2 start | [Screenshot](qa/mushaf-marks/juz-2-light.png) | [Screenshot](qa/mushaf-marks/juz-2-dark.png) |
| Iqama editor | [Screenshot](qa/mushaf-marks/iqama-light.png) | [Screenshot](qa/mushaf-marks/iqama-dark.png) |
