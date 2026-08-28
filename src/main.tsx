import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
/* Tokens first: `tokens.css` declares what the other two spend. */
import './rd/css/tokens.css';
import './rd/css/redesign.css';
import './rd/css/app.css';
import { AppRoot } from './AppRoot';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
);
