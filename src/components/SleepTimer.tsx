import { useEffect, useState } from 'react';

const KEY = 'folio-sleep-min';
export const SLEEP_PRESETS = [15, 30, 45, 60, 90];
const DIM_LEAD_S = 60;

export function loadSleepMinutes(): number {
  try {
    const n = Number(localStorage.getItem(KEY));
    return n >= 5 && n <= 180 ? n : 30;
  } catch {
    return 30;
  }
}
const saveSleepMinutes = (n: number) => {
  try {
    localStorage.setItem(KEY, String(n));
  } catch {
    /* private mode */
  }
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Seconds left until `endAt` (null = no timer), re-rendered once a second while running. */
export function useRemaining(endAt: number | null): number | null {
  const [, tick] = useState(0);
  useEffect(() => {
    if (endAt == null) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [endAt]);
  return endAt == null ? null : Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
}

/** Panel: pick how long to read before the screen goes dark. */
export function SleepPanel({ endAt, onStart, onCancel }: { endAt: number | null; onStart: (minutes: number) => void; onCancel: () => void }) {
  const [minutes, setMinutes] = useState(loadSleepMinutes);
  const left = useRemaining(endAt);
  const running = left != null && left > 0;
  const set = (n: number) => {
    setMinutes(n);
    saveSleepMinutes(n);
  };
  return (
    <div className="space-y-4 p-1">
      {running && (
        <p className="rounded-lg bg-surface2 px-3 py-3 text-[14px]" role="status">
          Screen goes dark in <strong className="tabular-nums">{fmt(left)}</strong>
        </p>
      )}
      <div role="radiogroup" aria-label="Sleep timer length" className="flex flex-wrap gap-2">
        {SLEEP_PRESETS.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={minutes === m}
            onClick={() => set(m)}
            className={`btn flex-1 border ${minutes === m ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-surface'}`}
          >
            {m} min
          </button>
        ))}
      </div>
      <label className="block text-[14px]">
        <span id="sleep-min">Custom · {minutes} min</span>
        <input
          type="range"
          min={5}
          max={120}
          step={5}
          value={Math.min(minutes, 120)}
          onChange={(e) => set(Number(e.target.value))}
          aria-labelledby="sleep-min"
          className="mt-1 h-6 w-full"
        />
      </label>
      <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={() => onStart(minutes)}>
          {running ? 'Restart timer' : 'Start timer'}
        </button>
        {running && (
          <button className="btn-outline flex-1" onClick={onCancel}>
            Turn off
          </button>
        )}
      </div>
      <p className="text-[12px] text-muted">The screen dims during the last minute, then goes black. Tap it to keep reading.</p>
    </div>
  );
}

/** Full-screen dimmer: ramps up over the final minute, then waits for a tap. */
export function SleepOverlay({ endAt, onWake }: { endAt: number | null; onWake: () => void }) {
  const left = useRemaining(endAt);
  if (left == null || left > DIM_LEAD_S) return null;
  const done = left === 0;
  const alpha = done ? 1 : 0.65 * (1 - left / DIM_LEAD_S);
  return done ? (
    <button
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black pb-24 text-[14px] text-white/50 transition-opacity duration-[4000ms]"
      onClick={onWake}
      aria-label="Sleep timer ended. Tap to keep reading"
    >
      Sleep timer ended · tap to keep reading
    </button>
  ) : (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] bg-black" style={{ opacity: alpha, transition: 'opacity 1s linear' }} />
  );
}
