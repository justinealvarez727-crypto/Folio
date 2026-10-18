import { memo, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useSpineColor } from '../lib/hooks';
import { finishedOrderKey } from '../lib/status';
import { navigate, paths } from '../lib/router';
import { useLibraryStore } from '../stores/libraryStore';
import { toast } from '../stores/toastStore';
import type { Book } from '../types';
import { IconMore, IconTrash } from './Icons';

/** Books per stack. When a stack is full the next finished book starts a new stack beside it. */
const STACK_SIZE = 5;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * One book lying flat with its spine toward you.
 * - Colour is sampled from the cover, so the shelf matches the library.
 * - Thickness grows with file size (a stand-in for page count), width and a few pixels of
 *   sideways offset come from the book id, so every stack looks hand-piled but is stable between renders.
 * - Decorative bands near both ends are what you'd see on a real cloth spine.
 */
const Spine = memo(function Spine({ book, onDelete }: { book: Book; onDelete: (b: Book) => void }) {
  const color = useSpineColor(book.id, book.hasCover);
  const [menu, setMenu] = useState(false);

  const h = useMemo(() => Math.round(Math.min(58, Math.max(28, 24 + Math.sqrt(book.fileSize / 1024) * 1.4))), [book.fileSize]);
  const seed = hash(book.id);
  const width = 86 + (seed % 5) * 3.5; // 86–100 % of the stack
  const shift = (((seed >> 4) % 9) - 4) * 2.5; // −10…+10 px
  const small = h < 36;

  return (
    <motion.li
      initial={{ opacity: 0, y: -28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="group relative mx-auto"
      style={{ width: `${width}%`, height: h }}
    >
      <motion.div className="absolute inset-0" style={{ x: shift }} whileHover={{ x: shift + 12 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
        <button
          onClick={() => navigate(paths.read(book.id))}
          title={`${book.title} — ${book.author}`}
          aria-label={`Open ${book.title} by ${book.author}. Finished.`}
          className="relative flex h-full w-full items-center overflow-hidden rounded-[3px] pl-7 pr-9 text-left"
          style={{
            color: color.fg,
            background: `linear-gradient(180deg, ${color.top} 0%, ${color.base} 38%, ${color.bottom} 100%)`,
            boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.18), inset 0 -2px 3px rgb(0 0 0 / 0.2), 0 1px 1px rgb(0 0 0 / 0.35), 0 3px 6px -2px rgb(0 0 0 / 0.3)',
          }}
        >
          {/* cloth bands near each end of the spine */}
          {[10, 15].map((x) => (
            <span key={`l${x}`} aria-hidden className="absolute inset-y-0 w-[1.5px]" style={{ left: x, background: color.band }} />
          ))}
          {[10, 15].map((x) => (
            <span key={`r${x}`} aria-hidden className="absolute inset-y-0 w-[1.5px]" style={{ right: x, background: color.band }} />
          ))}
          <span className={`min-w-0 flex-1 truncate font-serif font-semibold ${small ? 'text-[12px]' : 'text-[14px]'}`}>{book.title}</span>
          <span className="ml-3 hidden max-w-[40%] shrink-0 truncate text-[9.5px] font-medium uppercase tracking-[0.14em] opacity-80 min-[300px]:block">
            {book.author}
          </span>
        </button>

        <button
          className="absolute right-[18px] top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-70"
          style={{ color: color.fg }}
          aria-label={`More options for ${book.title}`}
          aria-haspopup="menu"
          aria-expanded={menu}
          onClick={() => setMenu((m) => !m)}
          onBlur={(e) => {
            if (!e.currentTarget.closest('li')?.contains(e.relatedTarget as Node)) setMenu(false);
          }}
        >
          <IconMore width={16} height={16} />
        </button>
      </motion.div>

      {menu && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+4px)] z-30 w-56 overflow-hidden rounded-lg border border-line bg-surface py-1 text-fg shadow-pop"
          onKeyDown={(e) => e.key === 'Escape' && setMenu(false)}
        >
          <div className="px-3 py-1.5 text-[12px] text-muted line-clamp-2">{book.title}</div>
          <button
            role="menuitem"
            autoFocus
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] hover:bg-surface2"
            onClick={() => {
              setMenu(false);
              useLibraryStore.getState().setFinished(book.id, false);
              toast.info(`Moved “${book.title}” back to your library.`);
            }}
          >
            Move back to library
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

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * The "Finished" shelf. Books are ordered by when they were finished: the oldest sits at the
 * bottom of the first stack and each new finish lands on top. Every stack stands on a wooden plank.
 */
export function BookShelf({ books, onDelete }: { books: Book[]; onDelete: (b: Book) => void }) {
  const stacks = useMemo(() => chunk([...books].sort((a, b) => finishedOrderKey(a) - finishedOrderKey(b)), STACK_SIZE), [books]);

  return (
    <section aria-labelledby="shelf-title">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 id="shelf-title" className="text-[22px] font-bold tracking-tight">
          Finished
        </h2>
        <span className="text-[13px] text-muted">
          {books.length} {books.length === 1 ? 'book' : 'books'}
        </span>
      </div>

      {/* The back wall of the shelf: slightly recessed, with a soft shadow along the top. */}
      <div className="overflow-hidden rounded-xl bg-surface2/70 pt-2 shadow-[inset_0_10px_18px_-10px_rgb(0_0_0/0.18)]">
        <ul className="grid gap-y-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 270px), 1fr))' }}>
          {stacks.map((stack, i) => (
            <li key={stack[0]!.id} className="relative flex flex-col justify-end px-5 pb-[18px] pt-8" aria-label={`Stack ${i + 1}`}>
              {/* flex-col-reverse: first (oldest) book is at the bottom of the pile */}
              <ol className="flex flex-col-reverse gap-[2px]">
                {stack.map((b) => (
                  <Spine key={b.id} book={b} onDelete={onDelete} />
                ))}
              </ol>
              {/* the plank */}
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-[18px]"
                style={{
                  background: 'linear-gradient(180deg, rgb(var(--plank-top)) 0%, rgb(var(--plank-bottom)) 100%)',
                  boxShadow: 'inset 0 2px 0 rgb(255 255 255 / 0.22), inset 0 -2px 0 rgb(0 0 0 / 0.25), 0 6px 10px -4px rgb(0 0 0 / 0.35)',
                }}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
