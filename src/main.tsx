import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { STATIC_HOST } from './lib/host'
import { initInstall } from './lib/install'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// the hosted site saves itself for offline use (server/offlineSw.ts); the Mac's own server doesn't need it
if (STATIC_HOST && import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => undefined)
}
if (STATIC_HOST) initInstall()
