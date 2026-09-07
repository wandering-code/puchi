import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { AuthProvider } from './platform/auth'

// basename: la app vive bajo /next/ mientras conviva con la Puchi actual.
// Sin esto el router creería que la ruta es "/next/algo" y no encontraría
// ninguna de sus rutas. Se quita el día de la unificación, con el base de
// vite.config.js y el scope del manifest.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename="/next">
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
