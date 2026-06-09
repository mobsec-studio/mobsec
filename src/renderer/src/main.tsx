import React from 'react'
import { createRoot } from 'react-dom/client'
import './lib/monaco-setup'
import { initThemeEarly } from './lib/theme'
import App from './App'
import './styles/globals.css'

// Apply the saved theme synchronously, before React paints, so there's no
// light/dark flash on launch.
initThemeEarly()

const container = document.getElementById('root')
if (!container) throw new Error('Root element missing — index.html is malformed')

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
