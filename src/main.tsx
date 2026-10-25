import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import { search, verdict } from './lib/search';
import './index.css';

// Machine-readable console handle over the check pipeline: the check page now
// imports `verdict` directly, but the issue-level acceptance still drives
// `verdict(randomVector)` from the console, so the handle stays a public debug
// surface.
Object.assign(globalThis, { magpieSearch: search, magpieVerdict: verdict });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
