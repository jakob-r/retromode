import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
// Self-hosted fonts (bundled by Vite), so no requests go to Google.
import '@fontsource-variable/bricolage-grotesque/opsz.css'
import '@fontsource-variable/inter/wght.css'
import '@fontsource/noto-sans-egyptian-hieroglyphs/egyptian-hieroglyphs.css'
import '@fontsource/noto-sans-runic/runic.css'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
