import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { HIGHLIGHT_COLORS } from '../lib/themes';
import type { Highlight, HighlightColor } from '../types';
import { IconClose, IconNote, IconTrash } from './Icons';

export type SelectionState =
  | { kind: 'new'; cfiRange: string; text: string }
  | { kind: 'existing'; id: string };

interface Props {
  selection: SelectionState;
  /** Present when kind === 'existing'. */
  highlight?: Highlight;
  activeColor?: HighlightColor;
  onHighlight: (color: HighlightColor) => void;
  onDelete: () => void;
  onSaveNote: (note: string) => void;
  onClose: () => void;
}

/**
 * Bottom-docked toolbar rather than a floating bubble: it never collides with the
 * OS selection handles/menu on phones, and it's reachable by keyboard and
 * screen-reader users (a floating popover inside an iframe is neither).
 */
export function SelectionToolbar({
  selection,
  highlight,
  activeColor,
  onHighlight,
  onDelete,
  onSaveNote,
  onClose,
}: Props) {
  const text = selection.kind === 'new' ? selection.text : (highlight?.text ?? '');
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(highlight?.note ?? '');

  useEffect(() => {
    setNote(highlight?.note ?? '');
    setNoteOpen(false);
  }, [selection.kind === 'existing' ? selection.id : (selection as { cfiRange: string }).cfiRange, highlight?.note]);

  if (!text) return null;

  return (
    <motion.section
      role="region"
      aria-label="Selection actions"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      className="fixed inset-x-3 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-xl rounded-2xl border border-line bg-surface p-3 shadow-pop"
    >
      <div className="mb-2.5 flex items-start gap-2">
        <p className="min-w-0 flex-1 text-[13px] italic text-muted line-clamp-2">“{text}”</p>
        <button className="icon-btn -mr-1.5 -mt-1.5 h-8 w-8" onClick={onClose} aria-label="Dismiss">
          <IconClose width={16} height={16} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex items-center gap-1" role="group" aria-label="Highlight colour">
          {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map((c) => (
            <button
              key={c}
              onClick={() => onHighlight(c)}
              aria-label={`${selection.kind === 'new' ? 'Highlight' : 'Change to'} ${HIGHLIGHT_COLORS[c].label.toLowerCase()}`}
              aria-pressed={activeColor === c}
              className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                activeColor === c ? 'border-fg' : 'border-transparent'
              }`}
              style={{ background: HIGHLIGHT_COLORS[c].fill }}
            />
          ))}
        </div>

        {selection.kind === 'existing' && <span className="mx-1 h-5 w-px bg-line" aria-hidden />}
        {selection.kind === 'existing' && (
          <>
            <button className="btn-ghost px-2" onClick={() => setNoteOpen((o) => !o)} aria-expanded={noteOpen}>
              <IconNote width={16} height={16} />
              <span>Note</span>
            </button>
            <button className="btn-ghost px-2 text-danger" onClick={onDelete} aria-label="Delete highlight">
              <IconTrash width={16} height={16} />
            </button>
          </>
        )}
      </div>

      {noteOpen && selection.kind === 'existing' && (
        <div className="mt-2.5 flex gap-2">
          <label className="sr-only" htmlFor="hl-note">
            Note for this highlight
          </label>
          <textarea
            id="hl-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Add a note…"
            className="w-full resize-none rounded-lg border border-line bg-bg p-2 text-[13px]"
          />
          <button
            className="btn-primary self-end"
            onClick={() => {
              onSaveNote(note.trim());
              setNoteOpen(false);
            }}
          >
            Save
          </button>
        </div>
      )}
    </motion.section>
  );
}
