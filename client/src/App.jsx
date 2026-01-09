import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SelectSites from './pages/SelectSites'
import FarmerMVP from './pages/FarmerMVP'
import VesselMVP from './pages/VesselMVP'
import AdminMVP from './pages/AdminMVP'
import PublicMVP from './pages/PublicMVP'
import Toast from './components/Toast'

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null)
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('login') // login, selectSites, dashboard, mvp-farmer, mvp-vessel, mvp-admin, mvp-public
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (token) {
      // Demo token goes straight to dashboard; real tokens to selectSites
      if (token === 'demo') {
        setPage('dashboard')
      } else if (token.startsWith('mvp-')) {
        // MVP role-based routing
        const role = token.replace('mvp-', '')
        setPage(`mvp-${role}`)
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

  const handleMVPLogin = (role) => {
    const token = `mvp-${role}`
    setToken(token)
    localStorage.setItem('token', token)
    setUser({ name: `MVP ${role}` })
    setPage(`mvp-${role}`)
    showToast(`Testet ${role} rolle`)
  }

  return (
    <div className="app">
      {page === 'login' && <Login onLogin={handleLogin} onMVPLogin={handleMVPLogin} onToast={showToast} />}
      {page === 'selectSites' && <SelectSites token={token} user={user} onSitesSelected={handleSitesSelected} onToast={showToast} />}
      {page === 'dashboard' && <Dashboard token={token} user={user} onLogout={handleLogout} onToast={showToast} />}
      {page === 'mvp-farmer' && <div style={{ backgroundColor: '#fff' }}><button onClick={handleLogout} style={{ padding: '10px 20px', margin: '10px', backgroundColor: '#666', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>← Tilbake til login</button><FarmerMVP token={token} /></div>}
      {page === 'mvp-vessel' && <div style={{ backgroundColor: '#fff' }}><button onClick={handleLogout} style={{ padding: '10px 20px', margin: '10px', backgroundColor: '#666', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>← Tilbake til login</button><VesselMVP token={token} /></div>}
      {page === 'mvp-admin' && <div style={{ backgroundColor: '#fff' }}><button onClick={handleLogout} style={{ padding: '10px 20px', margin: '10px', backgroundColor: '#666', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>← Tilbake til login</button><AdminMVP token={token} /></div>}
      {page === 'mvp-public' && <div style={{ backgroundColor: '#fff' }}><button onClick={handleLogout} style={{ padding: '10px 20px', margin: '10px', backgroundColor: '#666', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>← Tilbake til login</button><PublicMVP token={token} /></div>}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  )
}

export default App
