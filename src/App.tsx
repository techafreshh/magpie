import { Route, Routes } from 'react-router';
import Home from './routes/home';
import Health from './routes/health';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/health" element={<Health />} />
    </Routes>
  );
}
