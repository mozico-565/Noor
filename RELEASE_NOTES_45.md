# Noor Release 45 — v1.4.1 (41)

Targeted fixes on the current Release 44 source:

- Body portals for Noor dialogs and bottom sheets; independent backdrops, consistent content touch bounds, and correct overlay ordering.
- Add reciters by Arabic name from the public AlQuran Cloud verse-by-verse catalogue, with normalized search, edition selection, verified audio sources, persistence, and removal of added readers only.
- Added online readers use the existing Android playback/offline cache and resumable full-Quran download paths.
- Flashcard sessions sample a unique eligible pool without replacement at every difficulty and scope. Small ranges shorten the session with a clear message.
- Full long explanations are preserved with measured More/Less previews.

The Quran dataset, Quran fonts, built-in reciters, Qibla, prayer scheduling, and Noor Satin Glass identity are preserved.

## Validation

65 automated web tests, TypeScript checks, Quran/font integrity checks, and web/Android debug builds passed during preparation. This release pipeline reruns the required checks and builds both the APK and unsigned release AAB before publishing.

Mahmoud Khalil Al-Husary was resolved from the real public catalogue; an actual MP3 was fetched and validated. Physical Android playback, a complete 6236-file download, and visual/touch QA on a real handset have not been verified. Automated bridge tests do not claim actual audio playback or full download success.

## Assets

- `Noor-Release-45.apk`: installable debug APK.
- `Noor-Release-45-unsigned.aab`: unsigned release bundle; requires release signing before store submission.
- `Noor-Release-45-Source.zip`: complete updated source, excluding generated builds and caches.
- `Noor-Reciter-Cards-Overlay-Fix.zip`: changed/new application and build files with their original paths.
- `SHA256SUMS.txt`: asset checksums.
