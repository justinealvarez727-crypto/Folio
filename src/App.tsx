import { lazy, Suspense } from 'react';
import { MotionConfig } from 'framer-motion';
import { useRoute } from './lib/router';
import { useAllHydrated, useResolvedTheme } from './lib/hooks';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Library, LibrarySkeleton } from './components/Library';
import { Toaster } from './components/Toaster';

/**
 * Code splitting: the reader (epub.js + JSZip, ~107 kB gzip) is its own chunk,
 * fetched on first navigation and then cached by the service worker.
 */
const ReadingLog = lazy(() => import('./components/ReadingLog'));
const Reader = lazy(() => import('./components/Reader'));

function RouteFallback() {
  return (
    <div className="flex h-full items-center justify-center" role="status" aria-label="Loading">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden />
    </div>
  );
}

export default function App() {
  const route = useRoute();
  const hydrated = useAllHydrated();
  useResolvedTheme();

  const routeKey = route.name === 'read' ? `read:${route.id}` : route.name;

  return (
    // reducedMotion="user" makes every Framer animation honour prefers-reduced-motion.
    <MotionConfig reducedMotion="user">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <ErrorBoundary label="Folio hit a problem" resetKey={routeKey}>
        {!hydrated ? (
          <LibrarySkeleton />
        ) : (
          <Suspense fallback={<RouteFallback />}>
            {route.name === 'read' ? <Reader key={route.id} bookId={route.id} /> : route.name === 'log' ? <ReadingLog /> : <Library />}
          </Suspense>
        )}
      </ErrorBoundary>
      <Toaster />
    </MotionConfig>
  );
}
