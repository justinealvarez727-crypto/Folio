import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useFocusTrap } from '../lib/hooks';
import { IconClose } from './Icons';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /**
   * "bottom": a card docked to the bottom edge (Kindle's "Aa" popup).
   * "side": a full-height drawer (contents, highlights) — a bottom sheet on phones.
   */
  placement?: 'bottom' | 'side';
}

function Panel({ onClose, title, children, placement = 'side' }: Omit<Props, 'open'>) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, true, onClose);

  const isBottom = placement === 'bottom';
  return (
    <div className={`fixed inset-0 z-50 flex justify-center ${isBottom ? 'items-end' : 'items-end sm:items-stretch sm:justify-end'}`}>
      <motion.button
        aria-label="Close panel"
        tabIndex={-1}
        className="absolute inset-0 cursor-default bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        className={`relative flex w-full flex-col border border-line bg-surface shadow-pop outline-none ${
          isBottom
            ? 'max-h-[85dvh] max-w-lg rounded-t-2xl border-b-0'
            : 'max-h-[85dvh] rounded-t-2xl sm:max-h-none sm:w-[400px] sm:rounded-none sm:border-y-0 sm:border-r-0'
        }`}
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 id={titleId} className="text-[15px] font-semibold">
            {title}
          </h2>
          <button className="icon-btn -mr-2" onClick={onClose} aria-label={`Close ${title}`}>
            <IconClose />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </motion.div>
    </div>
  );
}

export function Sheet(props: Props) {
  return createPortal(<AnimatePresence>{props.open && <Panel key="panel" {...props} />}</AnimatePresence>, document.body);
}
