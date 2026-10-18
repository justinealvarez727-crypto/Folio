import type { Book, Highlight } from '../types';

/** Readwise-style Markdown export of a book's highlights and notes. */
export function highlightsToMarkdown(book: Book, highlights: Highlight[]): string {
  const lines = [`# ${book.title}`, `*${book.author}*`, ''];
  let chapter = '';
  for (const h of highlights) {
    if (h.chapter && h.chapter !== chapter) {
      chapter = h.chapter;
      lines.push(`## ${chapter}`, '');
    }
    lines.push(`> ${h.text.replace(/\s+/g, ' ')}`);
    if (h.note) lines.push('', `**Note:** ${h.note}`);
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

export function downloadText(filename: string, text: string, mime = 'text/markdown'): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'book';
