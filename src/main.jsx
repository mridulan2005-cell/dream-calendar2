import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AppProvider } from './store/AppContext.jsx'
import { RoleProvider } from './store/RoleContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <RoleProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </RoleProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
