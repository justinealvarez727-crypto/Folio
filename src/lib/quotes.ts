/** Public-domain reading quotes (authors who died long ago), one per day, a different one each day until the list cycles. */
export const QUOTES: { text: string; by: string }[] = [
  { text: 'Reading maketh a full man.', by: 'Francis Bacon' },
  { text: 'Some books are to be tasted, others to be swallowed, and some few to be chewed and digested.', by: 'Francis Bacon' },
  { text: 'Books are the quietest and most constant of friends.', by: 'Charles W. Eliot' },
  { text: 'Reading is to the mind what exercise is to the body.', by: 'Joseph Addison' },
  { text: 'A book must be the axe for the frozen sea within us.', by: 'Franz Kafka' },
  { text: 'Reading furnishes the mind only with materials of knowledge; it is thinking that makes what we read ours.', by: 'John Locke' },
  { text: 'The reading of all good books is like a conversation with the finest minds of past centuries.', by: 'René Descartes' },
  { text: 'Literature is the most agreeable way of ignoring life.', by: 'Fernando Pessoa' },
  { text: 'I cannot live without books.', by: 'Thomas Jefferson' },
  { text: 'Words are, of course, the most powerful drug used by mankind.', by: 'Rudyard Kipling' },
  { text: 'Today a reader, tomorrow a leader.', by: 'Margaret Fuller' },
  { text: 'There is no Frigate like a Book to take us Lands away.', by: 'Emily Dickinson' },
  { text: 'I declare after all there is no enjoyment like reading!', by: 'Jane Austen' },
  { text: 'No entertainment is so cheap as reading, nor any pleasure so lasting.', by: 'Lady Mary Wortley Montagu' },
  { text: 'Books must be read as deliberately and reservedly as they were written.', by: 'Henry David Thoreau' },
  { text: 'Books are the treasured wealth of the world and the fit inheritance of generations and nations.', by: 'Henry David Thoreau' },
  { text: 'How many a man has dated a new era in his life from the reading of a book.', by: 'Henry David Thoreau' },
  { text: 'What is the use of a book, without pictures or conversations?', by: 'Lewis Carroll' },
  { text: 'Let us read, and let us dance; these two amusements will never do any harm to the world.', by: 'Voltaire' },
  { text: 'Books are not absolutely dead things, but do contain a potency of life in them.', by: 'John Milton' },
  { text: 'The pleasure of all reading is doubled when one lives with another who shares the same books.', by: 'Katherine Mansfield' },
  { text: 'Books are the mirrors of the soul.', by: 'Virginia Woolf' },
];

export function quoteFor(date: Date, offset = 0) {
  const day = Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86_400_000);
  return QUOTES[(((day + offset) % QUOTES.length) + QUOTES.length) % QUOTES.length]!;
}
