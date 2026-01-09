import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SelectSites from './pages/SelectSites'
import Toast from './components/Toast'

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null)
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('login') // login, selectSites, dashboard
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (token) {
      // Demo token goes straight to dashboard; real tokens to selectSites
      if (token === 'demo') {
        setPage('dashboard')
      } else {
        setPage('selectSites')
      }
      // Could verify token here
    }
  }, [token])

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleLogin = (token, userData) => {
    setToken(token)
    localStorage.setItem('token', token)
    setUser(userData)
    setPage('selectSites')
    showToast(`Velkommen, ${userData.name}!`)
  }

  const handleSitesSelected = () => {
    setPage('dashboard')
    showToast('Anlegg opprettet. Starter overvåking...')
  }

  const handleLogout = () => {
    setToken(null)
    localStorage.removeItem('token')
    setUser(null)
    setPage('login')
    showToast('Logget ut')
  }

  return (
    <div className="app">
      {page === 'login' && <Login onLogin={handleLogin} onToast={showToast} />}
      {page === 'selectSites' && <SelectSites token={token} user={user} onSitesSelected={handleSitesSelected} onToast={showToast} />}
      {page === 'dashboard' && <Dashboard token={token} user={user} onLogout={handleLogout} onToast={showToast} />}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  )
}

export default App
