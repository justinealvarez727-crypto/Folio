import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { animate } from 'framer-motion';
import { useLogStore } from '../stores/logStore';
import { bookState } from '../lib/status';
import { currentStreak, formatDuration } from '../lib/readingLog';
import { quoteFor } from '../lib/quotes';
import { navigate, paths } from '../lib/router';
import type { Book } from '../types';
import { IconBook, IconBookmark, IconCheck, IconClock } from './Icons';

/** A number that counts up to its value (instant under reduced motion). */
function CountUp({ value }: { value: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setN(value);
    const c = animate(0, value, { duration: 0.8, ease: 'easeOut', onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [value]);
  return <>{n}</>;
}

function Stat({ icon, tone, label, children }: { icon: ReactNode; tone: string; label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 flex-1 px-3 first:pl-0 last:pr-0">
      <div className="flex items-center gap-1.5">
        <span className={tone}>{icon}</span>
        <span className="truncate text-[17px] font-bold leading-none tabular-nums">{children}</span>
      </div>
      <div className="mt-1 truncate text-[11px] text-muted">{label}</div>
    </div>
  );
}

/** Quote of the day (changes daily; tap for another) + playful at-a-glance stats. */
export function LibraryOverview({ books }: { books: Book[] }) {
  const days = useLogStore((s) => s.days);
  const [offset, setOffset] = useState(0);
  const quote = quoteFor(new Date(), offset);

  const { seconds, reading, read, unread, streak } = useMemo(() => {
    let seconds = 0;
    for (const day of Object.values(days)) for (const e of Object.values(day)) seconds += e.seconds;
    const c = { reading: 0, read: 0, unread: 0 };
    for (const b of books) {
      const s = bookState(b);
      if (s === 'finished') c.read++;
      else c[s]++;
    }
    return { seconds, ...c, streak: currentStreak(days) };
  }, [days, books]);

  const total = Math.max(1, books.length);
  const pct = (n: number) => `${(n / total) * 100}%`;

  return (
    <section aria-label="Reading overview" className="mb-2 mt-0.5">
      <button
        type="button"
        onClick={() => setOffset((o) => o + 1)}
        className="block w-full rounded-md text-left"
        aria-label={`Quote of the day: ${quote.text} — ${quote.by}. Tap for another quote.`}
      >
        <q className="font-serif text-[14px] italic leading-snug text-fg/80 [quotes:'“''”']">{quote.text}</q>
        <span className="ml-1.5 whitespace-nowrap text-[12px] text-muted">— {quote.by}</span>
      </button>

      <button
        type="button"
        onClick={() => navigate(paths.log())}
        className="mt-2.5 block w-full text-left"
        aria-label={`Reading stats: ${formatDuration(seconds)} read, ${reading} reading, ${read} read, ${unread} unread. Open reading log`}
      >
        <div className="flex divide-x divide-line border-y border-line py-2">
          <Stat icon={<IconClock width={14} height={14} />} tone="text-accent" label={streak > 0 ? `Time read · 🔥 ${streak}d` : 'Time read'}>
            {formatDuration(seconds)}
          </Stat>
          <Stat icon={<IconBook width={14} height={14} />} tone="text-amber-600 dark:text-amber-400" label="Reading">
            <CountUp value={reading} />
          </Stat>
          <Stat icon={<IconCheck width={14} height={14} />} tone="text-emerald-600 dark:text-emerald-400" label="Read">
            <CountUp value={read} />
          </Stat>
          <Stat icon={<IconBookmark width={14} height={14} />} tone="text-fg/50" label="Unread">
            <CountUp value={unread} />
          </Stat>
        </div>
        <div className="flex h-[3px] overflow-hidden bg-fg/10" role="img" aria-label={`${read} read, ${reading} reading, ${unread} unread`}>
          <span className="bg-emerald-500 transition-[width] duration-700" style={{ width: pct(read) }} />
          <span className="bg-amber-500 transition-[width] duration-700" style={{ width: pct(reading) }} />
        </div>
      </button>
    </section>
  );
}
