import { Route, Routes } from 'react-router';
import Home from './routes/home';
import Health from './routes/health';
import Check from './routes/check';
import { Header } from './components/header';
import Report from './routes/report';
import ReportSuccess from './routes/report-success';
import Browse from './routes/browse';
import MapPage from './routes/map';
import { NotFoundMagnetic } from './components/motion/not-found/magnetic';

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
          <Route path="/health" element={<Health />} />
          <Route path="/check" element={<Check />} />
          <Route path="/report" element={<Report />} />
          <Route path="/report/success" element={<ReportSuccess />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/map" element={<MapPage />} />
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
