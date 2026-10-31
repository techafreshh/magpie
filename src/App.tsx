import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import Home from './routes/home';
import { Header } from './components/header';
import { Loader } from './components/motion/loader';
import { NotFoundMagnetic } from './components/motion/not-found/magnetic';

// Every route except home is lazy: each page then evaluates only its own
// code (donut/swipeable/drawer stay out of the check page's main chunk, and
// vice versa). The constellation route (d3-force + pairwise math) is the
// heaviest split (issue #48).
const MapPage = lazy(() => import('./routes/map'));
const HealthPage = lazy(() => import('./routes/health'));
const CheckPage = lazy(() => import('./routes/check'));
const ReportPage = lazy(() => import('./routes/report'));
const ReportSuccessPage = lazy(() => import('./routes/report-success'));
const BrowsePage = lazy(() => import('./routes/browse'));

export default function App() {
  return (
    <>
      {/* Route-independent header: it never remounts on navigate. */}
      <Header />
      {/* Bottom breathing room for the fixed mobile dock (single instance —
          all routes share it, so the padding lives here, not in each page). */}
      <div className="pb-28 sm:pb-0">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/health" element={<Suspense fallback={<Loader variant="spinner" label="loading…" />}><HealthPage /></Suspense>} />
          <Route path="/check" element={<Suspense fallback={<Loader variant="spinner" label="loading…" />}><CheckPage /></Suspense>} />
          <Route path="/report" element={<Suspense fallback={<Loader variant="spinner" label="loading…" />}><ReportPage /></Suspense>} />
          <Route path="/report/success" element={<Suspense fallback={<Loader variant="spinner" label="loading…" />}><ReportSuccessPage /></Suspense>} />
          <Route path="/browse" element={<Suspense fallback={<Loader variant="spinner" label="loading…" />}><BrowsePage /></Suspense>} />
          <Route
            path="/map"
            element={
              <Suspense fallback={<Loader variant="spinner" label="loading the map…" />}>
                <MapPage />
              </Suspense>
            }
          />
          <Route
            path="*"
            element={
              <main data-testid="not-found" className="mx-auto w-full max-w-[40rem] px-6 py-16">
                <NotFoundMagnetic
                  homeHref="/"
                  homeLabel="Back to the check"
                  browseHref="/browse"
                  browseLabel="Browse the feed"
                />
              </main>
            }
          />
        </Routes>
      </div>
    </>
  );
}
