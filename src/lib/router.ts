import { useSyncExternalStore } from 'react';

/**
 * Tiny hash router (#/, #/read/<id>). Hash routing means the PWA works
 * on any static host with zero rewrite rules and the browser Back button works.
 */
export type Route = { name: 'library' } | { name: 'log' } | { name: 'read'; id: string };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'read' && parts[1]) return { name: 'read', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'log') return { name: 'log' };
  return { name: 'library' };
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

const getSnapshot = () => window.location.hash;

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getSnapshot, () => '');
  return parseHash(hash);
}

export const paths = {
  library: () => '#/',
  log: () => '#/log',
  read: (id: string) => `#/read/${encodeURIComponent(id)}`,
};

export function navigate(path: string): void {
  window.location.hash = path;
}
