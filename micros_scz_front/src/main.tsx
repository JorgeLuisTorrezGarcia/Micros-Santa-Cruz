import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Service Worker for offline route indexing and transit maps
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => console.log('ServiceWorker registrado para soporte offline:', reg.scope))
      .catch((err) => console.warn('Error al registrar ServiceWorker:', err));
  });
}

createRoot(document.getElementById('root')!).render(<App />);
