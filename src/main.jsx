import React from 'react'
import ReactDOM from 'react-dom/client'
// Self-hosted variable fonts. Bundled rather than pulled from Google's CDN so
// there's no third-party request, no flash of fallback text, and no layout
// shift when the real face arrives.
import '@fontsource-variable/inter'
import '@fontsource-variable/lora'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
