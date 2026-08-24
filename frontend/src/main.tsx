import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { GlobalAuthGate } from './components/GlobalAuthGate.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalAuthGate>{() => <App />}</GlobalAuthGate>
  </StrictMode>,
)
