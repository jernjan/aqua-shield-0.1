import { useState, useEffect } from 'react'
import Login from './pages/Login'
import SelectSites from './pages/SelectSites'
import FarmerMVP from './pages/FarmerMVP'
import VesselMVP from './pages/VesselMVP'
import AdminMVP from './pages/AdminMVP'
import AnalyticsMVP from './pages/AnalyticsMVP'
import Toast from './components/Toast'

// MVP wrapper component for consistent styling
const MVPWrapper = ({ children, onLogout }) => (
  <div style={{ backgroundColor: 'var(--bg-dark)', minHeight: '100vh', paddingTop: 50, position: 'relative' }}>
    <button 
      onClick={onLogout} 
      style={{ position: 'fixed', top: 10, left: 10, padding: '10px 16px', background: 'var(--accent-gold)', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, zIndex: 1000, transition: 'all 0.2s ease' }} 
      onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'} 
      onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
    >
      ← Velg bruker
    </button>
    {children}
  </div>
)

// Page routing configuration
const PAGE_CONFIG = {
  'login': { component: Login, requiresAuth: false },
  'selectSites': { component: SelectSites, requiresAuth: true },
  'mvp-farmer': { component: FarmerMVP, requiresAuth: true, wrapper: true },
  'mvp-vessel': { component: VesselMVP, requiresAuth: true, wrapper: true },
  'mvp-admin': { component: AdminMVP, requiresAuth: true, wrapper: true },
  'mvp-analytics': { component: AnalyticsMVP, requiresAuth: true, wrapper: true },
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null)
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('login') // login, selectSites, dashboard, mvp-farmer, mvp-vessel, mvp-admin, mvp-analytics
  const [toast, setToast] = useState(null)

  useEffect(() => {
    // Check URL path for direct navigation
    const path = window.location.pathname
    if (path === '/admin' || path === '/admin/') {
      setToken('mvp-admin')
      localStorage.setItem('token', 'mvp-admin')
      setUser({ name: 'Admin', role: 'admin' })
      setPage('mvp-admin')
      return
    }
    if (path === '/farmer' || path === '/farmer/') {
      setToken('mvp-farmer')
      localStorage.setItem('token', 'mvp-farmer')
      setUser({ name: 'Farmer', role: 'farmer' })
      setPage('mvp-farmer')
      return
    }
    if (path === '/analytics' || path === '/analytics/') {
      setToken('mvp-analytics')
      localStorage.setItem('token', 'mvp-analytics')
      setUser({ name: 'Analyst', role: 'analyst' })
      setPage('mvp-analytics')
      return
    }

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

  const handleLogin = (userId, userData) => {
    // Store user in state and localStorage
    setUser(userData);
    localStorage.setItem('aquashield_user', JSON.stringify(userData));
    
    // Route based on role
    if (userData.role === 'farmer') {
      setPage('mvp-farmer');
    } else if (userData.role === 'vessel_operator') {
      setPage('mvp-vessel');
    } else if (userData.role === 'admin') {
      setPage('mvp-admin');
    } else {
      setPage('mvp-public');
    }
    showToast(`Velkommen, ${userData.name}!`);
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

  // Render current page
  const renderPage = () => {
    if (!PAGE_CONFIG[page]) return null
    
    const config = PAGE_CONFIG[page]
    const Component = config.component
    const commonProps = { token, user, onLogout: handleLogout, onToast: showToast }
    
    let element = null
    
    if (page === 'login') {
      element = <Component onLogin={handleLogin} onMVPLogin={handleMVPLogin} {...commonProps} />
    } else if (page === 'selectSites') {
      element = <Component onSitesSelected={handleSitesSelected} {...commonProps} />
    } else {
      element = <Component currentUser={user} {...commonProps} />
    }
    
    if (config.wrapper) {
      return <MVPWrapper onLogout={handleLogout}>{element}</MVPWrapper>
    }
    return element
  }

  return (
    <div className="app">
      {renderPage()}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  )
}

export default App
