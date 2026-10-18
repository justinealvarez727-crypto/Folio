import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useFocusTrap } from '../lib/hooks';

interface Props {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Modal alertdialog with focus trap; default focus lands on the safe (Cancel) action. */
export default function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true, onCancel);
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div className="absolute inset-0 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onCancel} />
      <motion.div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="card relative w-full max-w-sm p-5 shadow-pop outline-none"
      >
        <h2 id="confirm-title" className="text-base font-semibold">
          {title}
        </h2>
        <p id="confirm-body" className="mt-1.5 text-sm text-muted">
          {body}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn bg-danger text-white hover:opacity-90" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
