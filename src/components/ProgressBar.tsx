import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  /** 0..1 */
  value: number;
  label: string;
  /** When provided the bar is an interactive, keyboard-accessible slider. */
  onSeek?: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Read-only: role="progressbar". Interactive: a real <input type="range"> layered
 * invisibly over the track, so touch, mouse, arrow keys, Home/End and screen
 * readers all work natively. The seek commits on release (not on every drag
 * tick) so we don't re-render the book dozens of times per second.
 */
export function ProgressBar({ value, label, onSeek, disabled, className = '' }: Props) {
  const [draft, setDraft] = useState<number | null>(null);
  useEffect(() => setDraft(null), [value]);
  const shown = Math.min(1, Math.max(0, draft ?? value));
  const pct = Math.round(shown * 100);

  const track = (
    <div className={`relative h-1.5 w-full overflow-hidden rounded-full bg-surface2 ${className}`}>
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full bg-accent"
        initial={false}
        animate={{ width: `${shown * 100}%` }}
        transition={{ type: 'spring', stiffness: 260, damping: 32 }}
      />
    </div>
  );

  if (!onSeek) {
    return (
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={`${pct}% read`}>
        {track}
      </div>
    );
  }

  const commit = () => {
    if (draft != null) onSeek(draft);
  };

  return (
    <div className="relative flex h-6 items-center">
      {track}
      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(shown * 1000)}
        disabled={disabled}
        aria-label={label}
        aria-valuetext={`${pct}% read`}
        onChange={(e) => setDraft(Number(e.target.value) / 1000)}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-surface shadow-card"
        initial={false}
        animate={{ left: `${shown * 100}%` }}
        transition={{ type: 'spring', stiffness: 260, damping: 32 }}
      />
    </div>
  );
}
