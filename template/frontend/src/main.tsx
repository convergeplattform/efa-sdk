import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
// Begleit-Styles für das SDK-ui-Kit (Badge/Skeleton-Klassen + Shimmer-Keyframes).
import '@efa-one/sdk/frontend/ui/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
