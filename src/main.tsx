import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import { GlassProvider } from './components/glassyui/glass-provider';
import { search, verdict } from './lib/search';
import './index.css';

// Machine-readable console handle over the check pipeline: the check page now
// imports `verdict` directly, but the issue-level acceptance still drives
// `verdict(randomVector)` from the console, so the handle stays a public debug
// surface.
Object.assign(globalThis, { magpieSearch: search, magpieVerdict: verdict });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* GlassyUI theme context (issue #17): outermost UI layer — it only sets a
        React context plus <html> attributes, and `defaultTheme="dark"` pins
        dark mode until the visitor explicitly toggles (system preference is
        ignored by design; the header toggle persists the choice). */}
    <GlassProvider defaultTheme="dark">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </GlassProvider>
  </StrictMode>,
);
