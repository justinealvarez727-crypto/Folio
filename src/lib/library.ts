import { deleteBookBlobs, saveBookFile, saveCover } from './storage';
import { disposeEpub } from './epubSafe';
import { useAnnotationStore } from '../stores/annotationStore';
import { useLibraryStore } from '../stores/libraryStore';
import type { Book } from '../types';

/** User-presentable import failure. */
export class ImportError extends Error {}

const MAX_BYTES = 150 * 1024 * 1024;

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface ImportResult {
  status: 'added' | 'duplicate';
  book: Book;
}

/**
 * Validate -> parse metadata/cover -> persist blobs -> register in the store.
 * epub.js is imported dynamically so the library screen doesn't download it
 * until the first import (it is bundled in the same chunk as the Reader).
 */
export async function importEpub(file: File): Promise<ImportResult> {
  if (!/\.epub$/i.test(file.name) && file.type !== 'application/epub+zip') {
    throw new ImportError(`“${file.name}” isn’t an EPUB file.`);
  }
  if (file.size > MAX_BYTES) throw new ImportError(`“${file.name}” is larger than 150 MB.`);
  if (file.size < 100) throw new ImportError(`“${file.name}” looks empty.`);

  const buffer = await file.arrayBuffer();
  const magic = new Uint8Array(buffer.slice(0, 2));
  if (magic[0] !== 0x50 || magic[1] !== 0x4b) throw new ImportError(`“${file.name}” isn’t a valid EPUB (not a zip archive).`);

  const id = await sha256Hex(buffer);
  const existing = useLibraryStore.getState().books[id];
  if (existing) return { status: 'duplicate', book: existing };

  const { default: ePub } = await import('epubjs');
  let title = file.name.replace(/\.epub$/i, '');
  let author = 'Unknown author';
  let language: string | null = null;
  let cover: Blob | null = null;

  const epub = ePub(buffer.slice(0));
  try {
    await epub.ready;
    const meta = await epub.loaded.metadata;
    title = (meta.title || title).trim();
    author = (meta.creator || author).trim();
    language = meta.language || null;
    try {
      const url = await epub.coverUrl();
      if (url) {
        const res = await fetch(url);
        if (res.ok) cover = await res.blob();
      }
    } catch {
      /* a missing/broken cover is not fatal */
    }
  } catch (e) {
    throw new ImportError(`Couldn’t read “${file.name}”. The file may be corrupted or DRM-protected.`);
  } finally {
    disposeEpub(epub);
  }

  await saveBookFile(id, buffer);
  if (cover) await saveCover(id, cover);

  const book: Book = {
    id,
    title,
    author,
    language,
    fileName: file.name,
    fileSize: file.size,
    hasCover: !!cover,
    addedAt: Date.now(),
    lastOpenedAt: null,
    progress: { cfi: null, percentage: 0, updatedAt: null },
  };
  useLibraryStore.getState().addBook(book);
  return { status: 'added', book };
}

/** Remove a book and everything derived from it (file, cover, highlights). */
export async function deleteBook(id: string): Promise<void> {
  useLibraryStore.getState().removeBook(id);
  useAnnotationStore.getState().removeByBook(id);
  await deleteBookBlobs(id);
}

/** Fetch the bundled sample EPUB (generated at build time by scripts/make-sample.mjs). */
export async function importSampleBook(): Promise<ImportResult> {
  const res = await fetch('/sample.epub');
  if (!res.ok) throw new ImportError('The sample book could not be loaded.');
  const blob = await res.blob();
  return importEpub(new File([blob], 'the-lantern-keeper.epub', { type: 'application/epub+zip' }));
}
