import type { Book as EpubBook, Rendition } from 'epubjs';

/** If epub.js never finishes opening (corrupt file), dispose anyway after this long. */
const DISPOSE_TIMEOUT_MS = 15_000;

/**
 * Destroy an epub.js book (and its rendition) without tripping an epub.js race.
 *
 * Opening a book runs a background chain inside epub.js (blob-URL replacement for assets, then
 * CSS replacement, then display options) that is *not* part of `epub.ready`. `Book.destroy()` clears
 * the fields that chain still uses, so destroying early (the reader taps Back right after opening, or
 * an import reads the metadata and discards its temporary book) makes the chain throw
 * "Cannot read properties of undefined (reading 'replaceCss' / 'displayOptions')".
 *
 * `epub.opened` resolves at the very end of that chain, so we wait for it, then destroy.
 */
export function disposeEpub(epub: EpubBook | null | undefined, rendition?: Rendition | null): void {
  const destroy = () => {
    try {
      rendition?.destroy();
      epub?.destroy();
    } catch {
      /* already torn down */
    }
  };
  if (!epub) return destroy();

  const opened: Promise<unknown> | undefined = epub.opened; // captured now: destroy() clears the field
  if (!opened) return destroy();

  let done = false;
  const once = () => {
    if (done) return;
    done = true;
    destroy();
  };
  void opened.then(once, once);
  setTimeout(once, DISPOSE_TIMEOUT_MS);
}
