import { lazy, Suspense, useCallback, useMemo, useRef, useState, type DragEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLibraryStore } from '../stores/libraryStore';
import { deleteBook, importEpub, importSampleBook, ImportError } from '../lib/library';
import { requestPersistentStorage } from '../lib/storage';
import { toast } from '../stores/toastStore';
import { reportError } from '../lib/perf';
import type { Book } from '../types';
import { BookCard } from './BookCard';
import { BookShelf } from './BookShelf';
import { bookState, isFinished } from '../lib/status';
import { Sheet } from './Sheet';
import { SettingsPanel } from './SettingsPanel';
import { navigate, paths } from '../lib/router';
import { IconBook, IconCalendar, IconPlus, IconSearch, IconSettings } from './Icons';

const ConfirmDialog = lazy(() => import('./ConfirmDialog'));

type Sort = 'recent' | 'title' | 'progress' | 'added';
type Filter = 'all' | 'unread' | 'reading' | 'finished';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'reading', label: 'Reading' },
  { id: 'finished', label: 'Finished' },
];

export function Library() {
  const booksMap = useLibraryStore((s) => s.books);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sort, setSort] = useState<Sort>('recent');
  const [filter, setFilter] = useState<Filter>('all');
  const [importing, setImporting] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Book | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const all = useMemo(() => Object.values(booksMap), [booksMap]);

  const { books, shelved } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = all.filter((b) => (!q || `${b.title} ${b.author}`.toLowerCase().includes(q)) && (filter === 'all' || bookState(b) === filter));
    // Finished books leave the cover grid and go on the shelf below it.
    const list = matches.filter((b) => !isFinished(b));
    const shelved = matches.filter(isFinished);
    const by: Record<Sort, (a: Book, b: Book) => number> = {
      recent: (a, b) => (b.lastOpenedAt ?? b.addedAt) - (a.lastOpenedAt ?? a.addedAt),
      added: (a, b) => b.addedAt - a.addedAt,
      title: (a, b) => a.title.localeCompare(b.title),
      progress: (a, b) => b.progress.percentage - a.progress.percentage,
    };
    return { books: list.sort(by[sort]), shelved };
  }, [all, query, sort, filter]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    void requestPersistentStorage();
    setImporting((n) => n + list.length);
    for (const file of list) {
      try {
        const { status, book } = await importEpub(file);
        if (status === 'duplicate') toast.info(`“${book.title}” is already in your library.`);
        else toast.success(`Added “${book.title}”.`);
      } catch (e) {
        if (e instanceof ImportError) toast.error(e.message);
        else {
          reportError(e);
          toast.error(`Couldn’t import “${file.name}”.`);
        }
      } finally {
        setImporting((n) => n - 1);
      }
    }
  }, []);

  const addSample = async () => {
    setImporting((n) => n + 1);
    try {
      const { status, book } = await importSampleBook();
      if (status === 'duplicate') toast.info('The sample book is already in your library.');
      else toast.success(`Added “${book.title}”.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add the sample book.');
    } finally {
      setImporting((n) => n - 1);
    }
  };

  // Drag & drop anywhere on the page. A depth counter avoids flicker from child dragenter/leave.
  const onDragEnter = (e: DragEvent) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    dragDepth.current++;
    setDragging(true);
  };
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
  };

  const empty = all.length === 0;

  return (
    <div
      className="mx-auto flex min-h-full max-w-5xl flex-col px-5 pb-24 sm:px-8"
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <header className="sticky top-0 z-20 -mx-5 flex items-center gap-1 bg-bg/95 px-5 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur sm:-mx-8 sm:px-8">
        <h1 className="mr-auto text-[28px] font-bold leading-tight tracking-tight">Library</h1>
        {!empty && (
          <button
            className="icon-btn"
            onClick={() => setSearchOpen((o) => !o)}
            aria-label="Search library"
            aria-expanded={searchOpen}
          >
            <IconSearch width={20} height={20} />
          </button>
        )}
        <button className="icon-btn" onClick={() => navigate(paths.log())} aria-label="Reading log">
          <IconCalendar width={20} height={20} />
        </button>
        <button className="icon-btn" onClick={() => setShowSettings(true)} aria-label="Appearance settings">
          <IconSettings width={20} height={20} />
        </button>
        <button className="icon-btn text-accent hover:text-accent" onClick={() => fileRef.current?.click()} aria-label="Add book">
          <IconPlus width={24} height={24} strokeWidth={2.2} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".epub,application/epub+zip"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose EPUB files to add"
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </header>

      {!empty && (
        <div className="sticky top-[calc(3.25rem+env(safe-area-inset-top))] z-10 -mx-5 bg-bg/95 px-5 pb-3 backdrop-blur sm:-mx-8 sm:px-8">
          <AnimatePresence initial={false}>
            {searchOpen && (
              <motion.label
                key="search"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="relative mb-2 block overflow-hidden"
              >
                <span className="sr-only">Search title or author</span>
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" width={16} height={16} />
                <input
                  autoFocus
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your library"
                  className="h-10 w-full rounded-full bg-surface2 pl-10 pr-4 text-[15px] placeholder:text-muted"
                />
              </motion.label>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto sm:gap-1.5" role="group" aria-label="Filter books">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  aria-pressed={filter === f.id}
                  className={`shrink-0 rounded-full px-2.5 py-1.5 text-[13px] font-medium transition-colors sm:px-3.5 ${
                    filter === f.id ? 'bg-fg text-bg' : 'bg-surface2 text-fg/80 hover:text-fg'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <label className="flex shrink-0 items-center text-[13px] text-muted">
              <span className="sr-only">Sort by</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="h-8 w-[76px] rounded-md bg-transparent text-[13px] font-medium text-fg sm:w-auto sm:pr-1"
              >
                <option value="recent">Recent</option>
                <option value="added">Added</option>
                <option value="title">Title</option>
                <option value="progress">Progress</option>
              </select>
            </label>
          </div>
          {importing > 0 && (
            <p className="mt-2 flex items-center gap-2 text-[13px] text-muted" role="status">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden />
              Importing {importing}…
            </p>
          )}
        </div>
      )}

      <main id="main" className="mt-3 flex-1">
        {empty ? (
          <EmptyState importing={importing > 0} onPick={() => fileRef.current?.click()} onSample={addSample} />
        ) : books.length === 0 && shelved.length === 0 ? (
          <p className="py-20 text-center text-sm text-muted">
            {query ? `No books match “${query}”.` : `No ${filter === 'all' ? '' : filter + ' '}books.`}
          </p>
        ) : (
          <>
            {books.length > 0 && (
              <ul className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 sm:gap-x-6 md:grid-cols-5 lg:grid-cols-6">
                <AnimatePresence mode="popLayout">
                  {books.map((b) => (
                    <BookCard key={b.id} book={b} onDelete={setPendingDelete} />
                  ))}
                </AnimatePresence>
              </ul>
            )}
            {shelved.length > 0 && (
              <div className={books.length > 0 ? 'mt-12' : 'mt-2'}>
                <BookShelf books={shelved} onDelete={setPendingDelete} />
              </div>
            )}
          </>
        )}
      </main>

      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-3 z-40 flex items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-bg/85 backdrop-blur-sm"
            aria-hidden
          >
            <div className="text-center">
              <IconPlus className="mx-auto mb-2 text-accent" width={28} height={28} />
              <p className="text-base font-medium">Drop EPUB files to add them</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={showSettings} onClose={() => setShowSettings(false)} title="Appearance" placement="bottom">
        <SettingsPanel />
      </Sheet>

      <Suspense fallback={null}>
        {pendingDelete && (
          <ConfirmDialog
            title={`Remove “${pendingDelete.title}”?`}
            body="This deletes the book from this device along with its highlights. This can’t be undone."
            confirmLabel="Remove"
            onCancel={() => setPendingDelete(null)}
            onConfirm={async () => {
              const b = pendingDelete;
              setPendingDelete(null);
              await deleteBook(b.id);
              toast.info(`Removed “${b.title}”.`);
            }}
          />
        )}
      </Suspense>
    </div>
  );
}

function EmptyState({ importing, onPick, onSample }: { importing: boolean; onPick: () => void; onSample: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-16 flex max-w-sm flex-col items-center px-4 text-center sm:mt-24">
      <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-surface2 text-muted">
        <IconBook width={30} height={30} />
      </span>
      <h2 className="text-xl font-bold tracking-tight">Your library is empty</h2>
      <p className="mt-2 text-[15px] text-muted">
        Add an EPUB from your device, or drag one anywhere on this page. Everything stays on your device and works offline.
      </p>
      <div className="mt-7 flex flex-col gap-2 sm:flex-row">
        <button className="btn-primary min-h-[44px] px-5 text-[15px]" onClick={onPick} disabled={importing}>
          <IconPlus /> Add an EPUB
        </button>
        <button className="btn-outline min-h-[44px] px-5 text-[15px]" onClick={onSample} disabled={importing}>
          Try the sample book
        </button>
      </div>
    </motion.div>
  );
}

export function LibrarySkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-5 pt-6 sm:px-8" aria-busy="true" aria-label="Loading your library">
      <div className="skeleton mb-8 h-9 w-40" />
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i}>
            <div className="skeleton aspect-[2/3] w-full" />
            <div className="skeleton mt-3 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
