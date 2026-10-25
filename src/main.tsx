import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import { search, verdict } from './lib/search';
import './index.css';

// Dev-console handle for the check pipeline's parts that have no UI yet: the
// issue-level acceptance drives `verdict(randomVector)` from the console. The
// kNN module is pure library code with no route importing it, so without this
// handle tree-shaking would drop it from the production bundle entirely.
Object.assign(globalThis, { magpieSearch: search, magpieVerdict: verdict });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
