import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ERROR_MESSAGE } from './constants/errorMessages'
import { formatMessage } from './domain/formatMessage'
import './index.css'
import App from './ui/App.tsx'

const ROOT_ID = 'root'
const root = document.getElementById(ROOT_ID)
if (!root) throw new Error(formatMessage(ERROR_MESSAGE.ROOT_NOT_FOUND, { id: ROOT_ID }))

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
