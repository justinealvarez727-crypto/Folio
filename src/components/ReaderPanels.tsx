import { useMemo } from 'react';
import { EpubCFI } from 'epubjs';
import { HIGHLIGHT_COLORS } from '../lib/themes';
import { downloadText, highlightsToMarkdown, slugify } from '../lib/export';
import { useAnnotationStore } from '../stores/annotationStore';
import type { Book, Highlight, TocEntry } from '../types';
import { IconDownload, IconTrash } from './Icons';

/* ------------------------------------------------------------------ Contents */

export function TocPanel({
  entries,
  activeId,
  onGoto,
}: {
  entries: TocEntry[];
  activeId: string | null;
  onGoto: (href: string) => void;
}) {
  if (entries.length === 0) return <p className="text-sm text-muted">This book has no table of contents.</p>;
  return (
    <nav aria-label="Table of contents">
      <ul className="-mx-2 space-y-0.5">
        {entries.map((e) => (
          <li key={e.id}>
            <button
              onClick={() => onGoto(e.href)}
              aria-current={activeId === e.id ? 'location' : undefined}
              style={{ paddingLeft: `${0.5 + e.depth * 0.9}rem` }}
              className={`w-full rounded-lg py-2 pr-2 text-left text-[13px] transition-colors hover:bg-surface2 ${
                activeId === e.id ? 'bg-accent/10 font-medium text-accent' : ''
              }`}
            >
              {e.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ---------------------------------------------------------------- Highlights */

function sortByPosition(list: Highlight[]): Highlight[] {
  const cfi = new EpubCFI();
  return [...list].sort((a, b) => {
    try {
      return cfi.compare(a.cfiRange, b.cfiRange);
    } catch {
      return a.createdAt - b.createdAt;
    }
  });
}

export function HighlightsPanel({ book, highlights, onGoto }: { book: Book; highlights: Highlight[]; onGoto: (cfiRange: string) => void }) {
  const remove = useAnnotationStore((s) => s.removeHighlight);
  const sorted = useMemo(() => sortByPosition(highlights), [highlights]);

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted">
        No highlights yet. Select any text in the book and pick a colour to save it here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <button
        className="btn-outline w-full"
        onClick={() => downloadText(`${slugify(book.title)}-highlights.md`, highlightsToMarkdown(book, sorted))}
      >
        <IconDownload width={16} height={16} /> Export as Markdown
      </button>
      <ul className="space-y-3">
        {sorted.map((h) => (
          <li key={h.id} className="card group p-3">
            <button className="block w-full text-left" onClick={() => onGoto(h.cfiRange)} aria-label={`Go to highlight: ${h.text.slice(0, 60)}`}>
              <div className="flex gap-2.5">
                <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: HIGHLIGHT_COLORS[h.color].fill }} aria-hidden />
                <div className="min-w-0">
                  <p className="font-serif text-[14px] leading-relaxed line-clamp-5">{h.text}</p>
                  {h.note && <p className="mt-1.5 rounded-md bg-surface2 px-2 py-1 text-xs text-muted">{h.note}</p>}
                  {h.chapter && <p className="mt-1.5 text-[11px] text-muted">{h.chapter}</p>}
                </div>
              </div>
            </button>
            <div className="mt-1 flex justify-end">
              <button className="icon-btn h-8 w-8 text-muted hover:text-danger" onClick={() => remove(h.id)} aria-label="Delete highlight">
                <IconTrash width={15} height={15} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
