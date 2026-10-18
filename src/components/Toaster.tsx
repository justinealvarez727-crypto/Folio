import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useToastStore, type Toast } from '../stores/toastStore';

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  useEffect(() => {
    if (!t.duration) return;
    const id = window.setTimeout(() => dismiss(t.id), t.duration);
    return () => window.clearTimeout(id);
  }, [t.id, t.duration, dismiss]);

  const dot = t.tone === 'error' ? 'bg-danger' : t.tone === 'success' ? 'bg-emerald-500' : 'bg-accent';
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      className="pointer-events-auto flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-[13px] shadow-pop"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
      <span className="min-w-0 flex-1">{t.message}</span>
      {t.action && (
        <button
          className="rounded-md px-2 py-1 text-[13px] font-medium text-accent hover:bg-accent/10"
          onClick={() => {
            t.action?.onClick();
            dismiss(t.id);
          }}
        >
          {t.action.label}
        </button>
      )}
      <button className="text-muted hover:text-fg" aria-label="Dismiss notification" onClick={() => dismiss(t.id)}>
        ×
      </button>
    </motion.div>
  );
}

/** Polite live region: screen readers announce toasts without stealing focus. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
