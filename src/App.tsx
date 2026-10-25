import { Route, Routes } from 'react-router';
import Home from './routes/home';
import Health from './routes/health';
import Check from './routes/check';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/health" element={<Health />} />
      <Route path="/check" element={<Check />} />
    </Routes>
  );
}
