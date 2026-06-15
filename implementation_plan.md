# Implementation Plan: Push to GitHub & Update README

## 1. Update `README.md`

### Changes needed:

- **Exercise & Widget Types table** — Add row for `Oral Vocabulary Quiz` (type: `oral-vocabulary`)
- **Core Features > For Students** — Add PWA/offline support note, OralVocabulary widget mention, and TTS audio generation
- **Core Features > For Teachers** — Add note about TTS-integrated vocabulary exercise creation
- **Project Structure** — Add `src/lib/tts/` directory entry
- **Tech Stack** — Optionally mention PWA capabilities

### Details to capture:

| Feature | Description |
|---|---|
| **PWA / Offline Support** | Service Worker (`sw.js`), Web App Manifest (`manifest.ts`), app icons (192/512 + apple-touch), offline fallback page, `viewportFit: cover` for notched devices, theme color `#7c3aed` |
| **OralVocabulary Widget** | New exercise type `oral-vocabulary` — audio-based vocabulary quiz where pupils hear a word (TTS-generated) and type the translation; TTS is mandatory for this type |
| **TTS Engine** | Python-based TTS generation (`src/lib/tts/generate_tts.py`) with TypeScript wrapper (`generator.ts`); supports English (en-us) and German (de); integrated into Vocabulary and OralVocabulary build flows |
| **Space Mono font** | Added as `--font-space-mono` CSS variable for monospace/code elements |

### Key edits in README.md:

1. **Section: Core Features > 👩‍🏫 For Teachers**
   - Add TTS + OralVocabulary creator shortcut

2. **Section: Core Features > 🧑‍🎓 For Students**
   - Add PWA installable/offline
   - Add Oral Vocabulary Quiz widget

3. **Section: Exercise & Widget Types table**
   - Add `Oral Vocabulary Quiz` row

4. **Section: Project Structure**
   - Add `src/lib/tts/`

---

## 2. Git: Stage, Commit, Push

```bash
git add -A
git commit -m "feat: PWA support, OralVocabulary widget, and TTS engine

- Add Progressive Web App support (service worker, manifest,
  app icons, offline page, viewport-fit cover)
- Implement OralVocabulary widget with mandatory TTS audio prompts
- Add Python-based TTS generator with TypeScript wrapper
  (supports EN-US and DE)
- Integrate TTS into Vocabulary and OralVocabulary build flows
- Add Space Mono font variable for monospace styling
- Polish UI: layout, widget index, exercise labels"
git push origin main
```

---

## Files modified (for reference)

- `src/app/manifest.ts` — Web App Manifest (new)
- `src/components/PWARegistration.tsx` — SW registration component (new)
- `public/sw.js`, `public/offline.html`, `public/*.png` — PWA assets (new)
- `src/components/widgets/OralVocabulary.tsx` — New widget (new)
- `src/lib/tts/generator.ts`, `src/lib/tts/generate_tts.py` — TTS engine (new)
- `src/app/layout.tsx` — PWA metadata, viewport, Space Mono font
- `src/components/widgets/index.ts` — OralVocabulary registration
- `src/components/widgets/types.ts` — OralVocabulary config type
- `src/lib/exercises.ts` — OralVocabulary schema + Zod union
- `src/lib/exerciseLabels.ts` — "Oral Vocabulary Quiz" label
- `src/app/teacher/create/WorksheetCreator.tsx` — Creator UI integration
- `src/lib/tts/generator.ts` — TTS integration for vocab types
- *(plus other UI polish files)*
