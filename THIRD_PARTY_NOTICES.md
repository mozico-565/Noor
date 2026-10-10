# Third-party data notices

Noor bundles Quran and reference data for offline use.

- Quran Core Dataset by Mirza Iqbal: CC BY 4.0.
- Underlying Tanzil Uthmani Quran text and metadata: CC BY 3.0. Quran text is kept verbatim.
- Quran bil-Quran code/data packaging: MIT. Its morphology/root mapping cites the Quranic Arabic Corpus (GNU GPL); the root data is kept as a separate data asset and attribution is preserved.
- Al-Mufradat fi Gharib al-Quran: classical work by al-Raghib al-Isfahani, packaged in Quran bil-Quran.
- Asbab al-Nuzul Dataset by mostafaahmed97: MIT, based on "Sahih Asbab al-Nuzul" by Ibrahim Muhammad al-Ali.
- Quranpedia verse-linked Asbab al-Nuzul dumps: "Asbab Nuzul al-Quran" by al-Wahidi and "Al-Muharrar fi Asbab Nuzul al-Quran", dump version 2026-08-10. Quranpedia permits free in-app use and requests attribution when its structured data is redistributed.
- KFGQPC Hafs Smart Quran font, bundled for correct rendering of Uthmani marks (including dagger alif) on Android devices that do not ship a complete Quranic font.
- Noto Naskh Arabic (Copyright 2022 The Noto Project Authors), bundled as `public/fonts/NotoNaskhArabic-Variable.ttf` to preserve the existing default appearance while supplying all Quran code points offline. Licensed under SIL Open Font License 1.1; see `public/fonts/NotoNaskhArabic-OFL.txt`. Source: https://github.com/notofonts/arabic

Do not remove these notices when redistributing the app.


## Additional optional offline reference layers

- `meibassam/mosahaf-tafseer`: aggregated JSON reference layer containing eight Arabic tafsir sources. The upstream README describes it as an automated compilation from public sources and recommends cross-checking in sensitive contexts. Noor stores compact excerpts for retrieval, not a substitute for printed critical editions.
- `AhmedBaset/hadith-json`: ISC-licensed project code/database packaging with 17 hadith collections. The upstream project documents known data limitations. Noor uses it as a retrieval index and displays the named book/reference when present.
- Al Quran Cloud: network fallback for Quran text search verification only when a connection is available.

Noor should not present an inferred answer as a quotation from a source unless the text is actually present in the bundled reference data.


## Quran speech recognition model
- Noor can use the Quran-specialized FastConformer ONNX model from `muhdur/tilawi-fastconformer-quran` on Hugging Face for local speech recognition after download.
- This model is used for Quran speech matching only. It is not a religious source and does not generate Ask-Quran answers.

## Offline speech recognition

- Noor uses local intent parser only as a natural-language intent parser. It is not cited as
  a source for Quran, hadith, tafsir, or religious rulings.


## Adhan Java
Prayer-time calculation library by Batoul Apps, version 1.2.1. MIT License.
https://github.com/batoulapps/adhan-java

## Tilawi FastConformer Quran ASR
Noor can optionally download the Tilawi FastConformer Quran-recitation model on first use for fully on-device voice Quran search and recitation matching. Model weights are CC BY 4.0 and derive from NVIDIA `stt_ar_fastconformer_hybrid_large_pcd_v1.0`. The model is not bundled in the APK. Runtime inference uses ONNX Runtime for Android.


## Amiri Quran
Amiri Quran (Copyright 2010-2022 The Amiri Project Authors) is bundled as `public/fonts/AmiriQuran-Regular.ttf` for the optional Quran font setting. It is distributed under the SIL Open Font License 1.1; see `public/fonts/AmiriQuran-OFL.txt`. Source: https://github.com/aliftype/amiri

## Scheherazade New
Scheherazade New (Copyright 1994-2026 SIL Global, with Reserved Font Names) is bundled as `public/fonts/ScheherazadeNew-Regular.ttf` for the optional Quran font setting. It is distributed under the SIL Open Font License 1.1; see `public/fonts/ScheherazadeNew-OFL.txt`. Source: https://software.sil.org/scheherazade/

## Iqama takbir audio
The file `android/app/src/main/res/raw/iqama_takbir.ogg` was supplied by the Noor project owner from their own prepared video/audio source for use in this application. The preview button and scheduled iqama alert use this same local file; no network or text-to-speech service is required.


## Revelation Journey 49 artwork and geography

- hira.webp, makkah.webp, madinah.webp, travel.webp: four project-specific generated illustrations, October 10, 2026. Conceptual landscapes, never archaeological evidence or depictions of prophets/companions. No third-party photo or image is embedded.
- hijaz-atlas.webp / makkah-atlas.webp: offline Mercator raster prepared from Mapzen Terrain Tiles (SRTM and GMTED2010, USGS; ETOPO1, NOAA) and Natural Earth public-domain land/coastline data.
- Attribution: https://github.com/tilezen/joerd/blob/master/docs/attribution.md ; data: https://registry.opendata.aws/terrain-tiles/ ; coastline: https://www.naturalearthdata.com/about/terms-of-use/ .
- Atlas coordinates approximate present-day locations and do not claim a historical migration route. Place references are included in src/journeyGeography.ts and in the interface.
