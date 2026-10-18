# Folio — EPUB reader PWA (Kindle-style layout)

An offline-first EPUB reader you can install on your phone. React 18 + TypeScript · Zustand (persisted) · Tailwind · Framer Motion · epub.js · Vite PWA.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173  (generates public/sample.epub first)
npm run build      # typecheck + production build -> dist/
npm run preview    # serve the production build (service worker active)
```

Node 18+ required.

## Install on your phone (PWA)

1. **Deploy** (free): push this folder to GitHub and import it in [Vercel](https://vercel.com) or [Netlify](https://netlify.com). Config files are included — just click Deploy. (Or `npx vercel` from this folder.)
2. Open the deployed `https://…` link on your phone. PWAs require HTTPS, which both hosts provide.
3. **Android (Chrome):** menu ⋮ → *Install app*. **iPhone (Safari):** Share → *Add to Home Screen*.
4. It now opens full-screen from its own icon and works offline. Add books with the **+** button (or "Try the sample book").

Note: iOS can clear data of web apps that are unused for a long time. Keep a copy of your EPUB files.

## Kindle-style design

- **Library:** a cover-only grid with soft shadows, a blue **NEW** badge for unread books, "42% read" under started ones, and a ⋯ menu per book. Filter chips (All / Unread / Reading / Finished), search and sort.
- **Finished shelf:** books you finish leave the cover grid and are piled **spine-out on a wooden shelf**, five to a stack. Each spine takes its color from the book's cover, its thickness from the file size, and shows the title and author. The book finished longest ago is at the bottom, and each new one lands on top. Hover (or focus) a spine to pull it out; tap it to reopen the book. A book is shelved automatically at 99%, or manually with **⋯ → Mark as finished**; **⋯ → Move back to library** on a spine undoes it.
- **Reading view:** edge-to-edge justified text with nothing in the way. Only the book title is shown on top; **Location n of N · percent · time left** is at the bottom.
- **Tap zones:** tap the **left side** for the previous page, the **right side** for the next, the **middle** to show/hide the menu. Swiping works too, and so do ← / → / PageUp / PageDown on a keyboard. The whole screen is tappable, including the white margins.
- **Menu (middle tap):** back, **Aa**, contents, highlights & notes, plus a progress scrubber with the chapter name. It briefly appears when you open a book and tucks itself away.
- **Aa panel:** White / Black / Sepia themes, font size, Serif / Sans, margins (narrow / normal / wide), line spacing, pages vs. continuous scroll, justify toggle.
- **Highlights:** select text → pick yellow, green, blue or pink. Tap a highlight to recolour, add a note, or delete it. Export all highlights as Markdown.

## Reading log

The calendar icon in the Library header opens **Reading log**: a month grid where every day you read shows the cover of the book (two side by side, plus a "+n" badge for more). Tap a day to see each book read that day, the time spent, how far you got, and a shortcut to reopen it. The top shows days read this month, reading time and your current streak (it survives until you miss a whole day).

How it's counted: each page turn credits the time since the last one, capped at 3 minutes so a phone left on the table doesn't count. A day is logged after ~30 seconds of reading or 2 page turns. Entries snapshot the title and author, so history stays readable after a book is removed. Everything is stored on the device (IndexedDB, `folio-log`).

## Architecture

```
src/
  types/            Domain interfaces (Book, Highlight, ReaderSettings, …)
  lib/
    library.ts      EPUB import pipeline (validate → parse → store → register)
    storage.ts      IndexedDB: Zustand storage adapter + blob helpers
    perf.ts         Web Vitals, timing marks, error reporting
    router.ts       Hash router (zero server config)
    hooks.ts        Hydration gate, theme, focus trap, cover URLs, spine colours
    status.ts       Finished/unread/reading state
    readingLog.ts   Pure day/month/streak maths for the reading log
    useReadingTracker.ts  Feeds the log from the reader
    epubSafe.ts     Race-free teardown of epub.js books
    themes.ts       Reader palettes (mirrored into the epub iframe)
  stores/           Zustand: library, annotations, reading log, settings, toasts
  components/       Library, BookCard, BookShelf, Reader, SettingsPanel, Sheet, ErrorBoundary, …
scripts/
  make-sample.mjs   Builds public/sample.epub with a cover (runs before dev/build)
  make-icons.py     Generates PWA PNG icons (already committed in /public)
```

Key decisions (commented in the code):

- **Metadata in Zustand, bytes in IndexedDB.** Stores hold small JSON; `.epub` files, covers and the epub.js location index live in IndexedDB, so there is no localStorage size ceiling. Settings use localStorage so the theme applies before first paint.
- **Locations like Kindle.** A book is indexed once in the background at ~250 characters per "Location" (cached afterwards). Time left = remaining characters ÷ 238 wpm.
- **Highlights are derived state.** The store is the source of truth; an effect diffs it against epub.js annotations.
- **Code splitting.** epub.js + JSZip (~107 kB gzip) load only when a book is opened or imported.
- **Safe updates.** The service worker asks before updating, so a new version never reloads the page mid-chapter.

## Accessibility (WCAG 2.1 AA)

Skip link · visible focus rings · dialogs with focus trap / Escape / focus return · native radios and range inputs · `role="progressbar"` · polite live region for toasts · a real "Show reading menu" button for keyboard users (the middle tap is mouse/touch only) · all colour pairs ≥ 4.5:1 · `prefers-reduced-motion` respected.

## Deploy config

`vercel.json` and `netlify.toml` are included. The app uses hash routing, so any static host works with no rewrite rules.

Optional env (see `.env.example`): `VITE_TELEMETRY_URL` — endpoint for Web Vitals/error beacons. Empty = nothing leaves the device.

## Known limits

- DRM-protected EPUBs can't be opened. Fixed-layout EPUBs render but aren't specially optimised.
- No cross-device sync — everything is stored on the device. A sync layer would slot in behind `lib/storage.ts`.
- Kindle's own fonts (Bookerly, Amazon Ember) are not bundled; the reader uses them only if installed and otherwise falls back to Georgia / system sans.
