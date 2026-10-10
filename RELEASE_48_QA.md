# Noor 48 QA

Base: Release 47, commit 077d575b62986eee38edd8d930b1ec7e28045dd0.

## Changes

- Restored the three-column home tool grid with vertical scrolling, preserved saved ordering and long-press touch sorting.
- Home header spans the viewport: brand on the right, resume action on the left.
- Physical Quran toolbar order: navigation, focus, repeat, automatic scroll/speed on the right.
- Native safe FrameLayout consumes system-bar and display-cutout insets before laying out WebView.
- Revelation Journey: all 114 surahs, 234 original thematic explanations linked to exact Quran ranges, four chapter transitions, symbolic landscapes, genuine detail pages, comparison of first-revelation/mushaf order, map, favorites, visited history and reader return.

## Main files

src/main.tsx, src/styles.css, src/NoorFeatures.tsx, src/RevelationJourney.tsx, src/journeyContent.json, src/journeyEvidence.ts, src/release48.test.tsx, src/main.test.tsx, src/qa-release48.mjs, src/qa-android48.mjs, android/app/src/main/java/com/noor/quran/MainActivity.java, android/app/build.gradle and .github/workflows/build.yml.

## Content review

Original thematic summaries are distinguished from historical reports. Reviewed samples: 1, 12, 18, 24, 28, 48, 55, 96, 108 and 110 against the Quran and the existing Saadi dataset. Historical cards link exact Bukhari/Muslim reports or named tafsir passages. Muslim 2797's narrator uncertainty is shown. Surah 108's classification difference is shown with Ibn Ashur and Tanzil references. No unsupported exact years or map coordinates are assigned to surahs; locations are expressly schematic. Where no specific cause has been verified, the detail page says so. Complete Quran and existing tafsir assets remain unchanged.

## Local validation

- TypeScript passed.
- 104 / 104 tests passed.
- Quran integrity: 114 surahs / 6236 ayahs; bundled font coverage passed.
- Existing Release 43 integration asset checks passed.
- Production web build passed.
- First real browser round verified home bounds, three columns, vertical reachability, toolbar order and touch drag. It exposed delayed persistence of an explicitly opened journey verse; navigation now saves the selected key immediately and the QA also verifies the actual highlighted verse inside the reader viewport.
- A CI-only timeout in the existing Baqarah option test was corrected to await data loading.

- A subsequent browser round exposed unstable restoration caused by offscreen intrinsic-size estimates. Journey cards now use stable layout and persist the selected card offset; QA compares the returned card position within five pixels.

- Real browser QA exposed a map pin losing its click: global liquid-press transforms replaced its anchoring transform. Pin anchoring now uses the independent CSS translate property; the real-click check verifies selection and the sourced Arafat card. Progress is checked again after reload.

## Runtime gate

Publication is gated on two complete browser rounds at 390×844, 430×932 and 320×640 in light/dark (12 scenarios), actual screenshots and JSON results, and actual APK runtime checks on an Android 15 emulator in both themes. The release QA archive contains the definitive results in round1/results.json, round2/results.json and android/result.json. A failed runtime check prevents publication. No physical-device test is claimed.

## Signing limitation

Package ID stays com.noor.quran, versionCode 48 / versionName 1.4.8. This pipeline builds an installable debug APK and an unsigned release AAB. The original installed application's private signing key is not available. A debug APK with a different signing certificate cannot update the previously installed app; increasing versionCode cannot solve that. No signing secrets were added.
