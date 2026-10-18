import { memo, useMemo, useState } from 'react';
import { useLibraryStore } from '../stores/libraryStore';
import { useLogStore } from '../stores/logStore';
import { useCoverUrl } from '../lib/hooks';
import { navigate, paths } from '../lib/router';
import {
  booksRead,
  currentStreak,
  dayKey,
  formatDuration,
  monthCells,
  monthStats,
  type DayBook,
} from '../lib/readingLog';
import { IconBack, IconNext } from './Icons';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function tint(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `linear-gradient(160deg, hsl(${h} 38% 36%), hsl(${(h + 30) % 360} 42% 20%))`;
}

/** A book cover (or a tinted stand-in with the title's initial) that fills its box. */
const Cover = memo(function Cover({ bookId, title, className = '' }: { bookId: string; title: string; className?: string }) {
  const hasCover = useLibraryStore((s) => !!s.books[bookId]?.hasCover);
  const url = useCoverUrl(bookId, hasCover);
  return url ? (
    <img src={url} alt="" draggable={false} className={`h-full w-full object-cover ${className}`} />
  ) : (
    <span
      aria-hidden
      className={`flex h-full w-full items-center justify-center font-serif text-[1.1em] font-semibold text-white/90 ${className}`}
      style={{ background: tint(bookId) }}
    >
      {title.trim().charAt(0).toUpperCase()}
    </span>
  );
});

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 px-3 first:pl-0 last:pr-0">
      <div className="text-[22px] font-bold leading-tight tracking-tight">{value}</div>
      <div className="text-[12px] text-muted">{label}</div>
    </div>
  );
}

function DayCell({
  day,
  list,
  today,
  selected,
  label,
  onSelect,
}: {
  day: number;
  list: DayBook[];
  today: boolean;
  selected: boolean;
  label: string;
  onSelect: () => void;
}) {
  const shown = list.slice(0, list.length > 2 ? 2 : list.length);
  const extra = list.length - 2;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={label}
      aria-pressed={selected}
      className={`relative aspect-square w-full overflow-hidden rounded-[3px] text-[12px] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
        list.length ? 'shadow-[0_1px_3px_rgb(0_0_0/0.28)]' : 'border border-line'
      } ${selected ? 'ring-2 ring-fg ring-offset-2 ring-offset-bg' : ''}`}
    >
      {list.length > 0 && (
        <span className="absolute inset-0 flex">
          {shown.map((b, i) => (
            <span key={b.bookId} className={`relative h-full flex-1 overflow-hidden ${i ? 'border-l border-bg' : ''}`}>
              <Cover bookId={b.bookId} title={b.title} />
            </span>
          ))}
        </span>
      )}
      {list.length > 0 && <span className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" aria-hidden />}
      <span
        aria-hidden
        className={`absolute bottom-0.5 left-1 font-semibold leading-none ${list.length ? 'text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]' : today ? 'text-accent' : 'text-muted'}`}
      >
        {day}
      </span>
      {extra > 0 && (
        <span aria-hidden className="absolute right-0.5 top-0.5 rounded-sm bg-black/70 px-1 text-[10px] font-semibold leading-4 text-white">
          +{extra}
        </span>
      )}
      {today && list.length === 0 && <span aria-hidden className="absolute inset-x-1 bottom-0 h-[2px] rounded bg-accent" />}
    </button>
  );
}

function DayDetail({ list, date }: { list: DayBook[]; date: Date }) {
  const books = useLibraryStore((s) => s.books);
  const title = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <section aria-live="polite" className="mt-8">
      <h2 className="border-b border-line pb-2 text-[15px] font-bold">{title}</h2>
      {list.length === 0 ? (
        <p className="py-6 text-[14px] text-muted">No reading logged this day.</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((b) => {
            const inLibrary = !!books[b.bookId];
            const gained = Math.round((b.endPct - b.startPct) * 100);
            const row = (
              <>
                <span className="block h-[72px] w-[48px] shrink-0 overflow-hidden rounded-[3px] shadow-[0_1px_3px_rgb(0_0_0/0.3)]">
                  <Cover bookId={b.bookId} title={b.title} />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[15px] font-semibold">{b.title}</span>
                  <span className="block truncate text-[13px] text-muted">{b.author}</span>
                  <span className="mt-1 block text-[13px] text-fg/80">
                    {formatDuration(b.seconds)}
                    {gained > 0 && ` · +${gained}% of the book`}
                    {` · now at ${Math.round(b.endPct * 100)}%`}
                  </span>
                </span>
                {inLibrary ? (
                  <span className="shrink-0 text-[13px] font-medium text-accent">Open</span>
                ) : (
                  <span className="shrink-0 text-[12px] text-muted">Removed</span>
                )}
              </>
            );
            return (
              <li key={b.bookId}>
                {inLibrary ? (
                  <button type="button" className="flex w-full items-center gap-3 py-3 hover:bg-surface2/60" onClick={() => navigate(paths.read(b.bookId))}>
                    {row}
                  </button>
                ) : (
                  <div className="flex w-full items-center gap-3 py-3">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function ReadingLog() {
  const days = useLogStore((s) => s.days);
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState(dayKey(now));
  const todayKey = dayKey(now);

  const cells = useMemo(() => monthCells(cursor.y, cursor.m), [cursor]);
  const stats = useMemo(() => monthStats(days, cursor.y, cursor.m), [days, cursor]);
  const streak = useMemo(() => currentStreak(days), [days]);
  const isCurrent = cursor.y === now.getFullYear() && cursor.m === now.getMonth();

  const shift = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };
  const [sy, sm, sd] = selected.split('-').map(Number) as [number, number, number];
  const selectedDate = new Date(sy, sm - 1, sd);

  return (
    <div className="mx-auto min-h-full max-w-xl px-5 pb-24 sm:px-8">
      <header className="sticky top-0 z-20 -mx-5 flex items-center gap-1 bg-bg/95 px-5 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur sm:-mx-8 sm:px-8">
        <button className="icon-btn -ml-2" onClick={() => navigate(paths.library())} aria-label="Back to library">
          <IconBack width={22} height={22} />
        </button>
        <h1 className="text-[22px] font-bold tracking-tight">Reading log</h1>
      </header>

      <main id="main" tabIndex={-1} className="outline-none">
        <div className="mt-3 flex divide-x divide-line border-y border-line py-3">
          <Stat value={String(stats.daysRead)} label={stats.daysRead === 1 ? 'day read' : 'days read'} />
          <Stat value={formatDuration(stats.seconds)} label="reading time" />
          <Stat value={String(streak)} label={streak === 1 ? 'day streak' : 'day streak'} />
        </div>

        <div className="mt-6 flex items-center">
          <h2 className="mr-auto text-[18px] font-bold" aria-live="polite">
            {MONTHS[cursor.m]} {cursor.y}
          </h2>
          {!isCurrent && (
            <button className="btn-ghost mr-1 !min-h-[32px] text-accent" onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })}>
              Today
            </button>
          )}
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month">
            <IconBack width={20} height={20} />
          </button>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month" disabled={isCurrent}>
            <IconNext width={20} height={20} />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1.5 sm:gap-2" role="group" aria-label={`${MONTHS[cursor.m]} ${cursor.y}`}>
          {WEEKDAYS.map((w, i) => (
            <div key={i} aria-hidden className="pb-1 text-center text-[11px] font-semibold uppercase text-muted">
              {w}
            </div>
          ))}
          {cells.map((day, i) => {
            if (day == null) return <div key={`b${i}`} aria-hidden />;
            const date = new Date(cursor.y, cursor.m, day);
            const key = dayKey(date);
            const list = booksRead(days, key);
            const future = key > todayKey;
            return (
              <div key={key} className={future ? 'opacity-40' : ''}>
                <DayCell
                  day={day}
                  list={list}
                  today={key === todayKey}
                  selected={key === selected}
                  label={`${date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}: ${
                    list.length ? list.map((b) => b.title).join(', ') : 'no reading'
                  }`}
                  onSelect={() => setSelected(key)}
                />
              </div>
            );
          })}
        </div>

        <DayDetail list={booksRead(days, selected)} date={selectedDate} />
        <p className="mt-8 text-center text-[12px] text-muted">
          A day is logged once you read for about half a minute or turn a couple of pages. Everything stays on this device.
        </p>
      </main>
    </div>
  );
}
