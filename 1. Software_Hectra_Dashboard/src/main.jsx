import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Set dark mode as default BEFORE React renders (MP-3 §17.1)
const savedTheme = localStorage.getItem('herd-settings')
  ? JSON.parse(localStorage.getItem('herd-settings'))?.state?.theme
  : null;
document.documentElement.setAttribute('data-theme', savedTheme || 'dark');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
