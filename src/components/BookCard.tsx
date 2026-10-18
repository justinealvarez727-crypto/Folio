import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { useCoverUrl } from '../lib/hooks';
import { navigate, paths } from '../lib/router';
import { toast } from '../stores/toastStore';
import { useLibraryStore } from '../stores/libraryStore';
import { isFinished } from '../lib/status';
import type { Book } from '../types';
import { IconMore, IconTrash } from './Icons';

/** Deterministic cover for books that ship without one. */
function placeholderGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `linear-gradient(160deg, hsl(${h} 38% 36%), hsl(${(h + 30) % 360} 42% 20%))`;
}

type Status = { kind: 'new' } | { kind: 'reading'; pct: number } | { kind: 'finished' };

function statusOf(b: Book): Status {
  if (isFinished(b)) return { kind: 'finished' };
  if (!b.progress.cfi && b.progress.percentage === 0) return { kind: 'new' };
  return { kind: 'reading', pct: Math.max(1, Math.round(b.progress.percentage * 100)) };
}

const statusText = (s: Status) => (s.kind === 'new' ? 'New' : s.kind === 'finished' ? 'Finished' : `${s.pct}% read`);

/**
 * Library tile in the Kindle manner: just the cover (with a soft drop shadow),
 * and underneath a quiet status line — a NEW badge or "42%" — plus a ⋯ menu.
 * No card chrome, no progress bar: the cover is the interface.
 */
export const BookCard = memo(function BookCard({ book, onDelete }: { book: Book; onDelete: (b: Book) => void }) {
  const cover = useCoverUrl(book.id, book.hasCover);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [menu, setMenu] = useState(false);
  const status = statusOf(book);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 360, damping: 34 }}
      className="relative"
    >
      <button
        onClick={() => navigate(paths.read(book.id))}
        className="block w-full text-left"
        title={`${book.title} — ${book.author}`}
        aria-label={`Open ${book.title} by ${book.author}. ${statusText(status)}.`}
      >
        <motion.div
          whileTap={{ scale: 0.97 }}
          className="relative aspect-[2/3] w-full overflow-hidden rounded-[3px] shadow-[0_2px_6px_rgb(0_0_0/0.28),0_8px_18px_-6px_rgb(0_0_0/0.25)]"
          style={{ background: cover ? 'rgb(var(--surface-2))' : placeholderGradient(book.id) }}
        >
          {cover ? (
            <>
              {!imgLoaded && <div className="skeleton absolute inset-0 rounded-none" />}
              <img
                src={cover}
                alt=""
                loading="lazy"
                decoding="async"
                onLoad={() => setImgLoaded(true)}
                className={`h-full w-full object-cover transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
              />
            </>
          ) : (
            <div className="flex h-full flex-col justify-between p-3 text-white/95">
              <span className="font-serif text-[15px] font-semibold leading-snug line-clamp-5">{book.title}</span>
              <span className="text-[11px] uppercase tracking-wider opacity-80 line-clamp-2">{book.author}</span>
            </div>
          )}
          {/* subtle spine highlight, like a hardcover */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-r from-black/25 to-transparent" />
        </motion.div>
      </button>

      <div className="mt-2 flex items-center justify-between">
        {status.kind === 'new' ? (
          <span className="rounded-sm bg-accent px-1.5 py-[1px] text-[10px] font-bold uppercase tracking-wider text-accent-fg">New</span>
        ) : (
          <span className="text-[12px] text-muted">{statusText(status)}</span>
        )}
        <button
          className="icon-btn -mr-2 h-8 w-8"
          aria-label={`More options for ${book.title}`}
          aria-haspopup="menu"
          aria-expanded={menu}
          onClick={() => setMenu((m) => !m)}
          onBlur={(e) => {
            if (!e.currentTarget.parentElement?.parentElement?.contains(e.relatedTarget as Node)) setMenu(false);
          }}
        >
          <IconMore width={18} height={18} />
        </button>
      </div>

      {menu && (
        <div
          role="menu"
          className="absolute bottom-9 right-0 z-10 w-52 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-pop"
          onKeyDown={(e) => e.key === 'Escape' && setMenu(false)}
        >
          <div className="px-3 py-1.5 text-[12px] text-muted line-clamp-2">{book.title}</div>
          <button
            role="menuitem"
            autoFocus
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] hover:bg-surface2"
            onClick={() => {
              setMenu(false);
              useLibraryStore.getState().setFinished(book.id, true);
              toast.success(`“${book.title}” is on your Finished shelf.`);
            }}
          >
            Mark as finished
          </button>
          <button
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] text-danger hover:bg-surface2"
            onClick={() => {
              setMenu(false);
              onDelete(book);
            }}
          >
            <IconTrash width={15} height={15} /> Remove from library
          </button>
        </div>
      )}
    </motion.li>
  );
});
