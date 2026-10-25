import { Route, Routes } from 'react-router';
import Home from './routes/home';
import Health from './routes/health';
import Check from './routes/check';
import Login from './routes/login';
import AuthCallback from './routes/auth-callback';
import { Header } from './components/header';
import Report from './routes/report';
import ReportSuccess from './routes/report-success';
import Browse from './routes/browse';

export default function App() {
  return (
    <>
      {/* Route-independent session bar: it never remounts on navigate, so the auth flow uses hard reloads to refresh it. */}
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/health" element={<Health />} />
        <Route path="/check" element={<Check />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/report" element={<Report />} />
        <Route path="/report/success" element={<ReportSuccess />} />
        <Route path="/browse" element={<Browse />} />
      </Routes>
    </>
  );
}
