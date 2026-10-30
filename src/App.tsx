import { Route, Routes } from 'react-router';
import Home from './routes/home';
import Health from './routes/health';
import Check from './routes/check';
import { Header } from './components/header';
import Report from './routes/report';
import ReportSuccess from './routes/report-success';
import Browse from './routes/browse';

export default function App() {
  return (
    <>
      {/* Route-independent header: it never remounts on navigate. */}
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/health" element={<Health />} />
        <Route path="/check" element={<Check />} />
        <Route path="/report" element={<Report />} />
        <Route path="/report/success" element={<ReportSuccess />} />
        <Route path="/browse" element={<Browse />} />
      </Routes>
    </>
  );
}
