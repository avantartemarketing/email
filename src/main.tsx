import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@shopify/polaris/build/esm/styles.css';
import './app.css';
import { AppRoot } from './AppRoot';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
);
