import { useState, useEffect, useCallback, memo } from 'react'
import Login from './pages/Login'
import SelectSites from './pages/SelectSites'
import DashboardSelector from './pages/DashboardSelector'
import FarmerMVP from './pages/FarmerMVP'
import FarmerDashboard from './pages/FarmerDashboard'
import ValidationDashboard from './pages/ValidationDashboard'
import VesselDashboard from './pages/VesselDashboard'
import VesselMVP from './pages/VesselMVP'
import AdminMVP from './pages/AdminMVP'
import AdminPanel from './pages/AdminPanel'
import AnalyticsMVP from './pages/AnalyticsMVP'
import FisherDashboard from './pages/FisherDashboard'
import Toast from './components/Toast'

// MVP wrapper component for consistent styling - memoized
const MVPWrapper = memo(({ children, onLogout, onSwitchRole, currentRole }) => (
  <div style={{ backgroundColor: 'var(--bg-dark)', minHeight: '100vh', paddingTop: 50, position: 'relative' }}>
    <button 
      onClick={onLogout} 
      style={{ 
        position: 'fixed', 
        top: 10, 
        left: 10, 
        padding: '10px 16px', 
        background: 'var(--accent-gold)', 
        color: '#000', 
        border: 'none', 
        borderRadius: 4, 
        cursor: 'pointer', 
        fontWeight: 600, 
        fontSize: '14px',
        zIndex: 99999, 
        transition: 'transform 0.2s ease',
        pointerEvents: 'auto',
        visibility: 'visible',
        display: 'block',
        opacity: 1
      }} 
      onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'} 
      onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
    >
      ← Velg bruker
    </button>
    
    {/* Role Switcher - Demo roles */}
    <div style={{
      position: 'fixed',
      top: 12,
      right: 12,
      display: 'flex',
      gap: '6px',
      zIndex: 99998,
      background: 'rgba(20, 20, 30, 0.95)',
      padding: '10px',
      borderRadius: 6,
      border: '2px solid var(--accent-gold)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
    }}>
      {[
        { role: 'farmer', label: '🐟 Farmer', color: '#8B5CF6' },
        { role: 'brønnbåt', label: '⛵ Brønnbåt', color: '#06B6D4' },
        { role: 'admin', label: '⚙️ Admin', color: '#F59E0B' }
      ].map(({ role, label, color }) => (
        <button
          key={role}
          onClick={() => onSwitchRole(role)}
          title={`Bytt til ${label}`}
          style={{
            padding: '8px 14px',
            background: currentRole === role ? color : 'rgba(255,255,255,0.05)',
            color: currentRole === role ? '#000' : 'var(--text-primary)',
            border: `2px solid ${currentRole === role ? color : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: currentRole === role ? 700 : 500,
            fontSize: '13px',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => {
            if (currentRole !== role) {
              e.target.style.background = 'rgba(255,255,255,0.1)';
              e.target.style.transform = 'scale(1.05)';
            }
          }}
          onMouseLeave={(e) => {
            if (currentRole !== role) {
              e.target.style.background = 'rgba(255,255,255,0.05)';
              e.target.style.transform = 'scale(1)';
            }
          }}
        >
          {label}
        </button>
      ))}
    </div>
    
    {children}
  </div>
))

// Page routing configuration
const PAGE_CONFIG = {
  'login': { component: Login, requiresAuth: false },
  'selectSites': { component: SelectSites, requiresAuth: true },
  'dashboard': { component: DashboardSelector, requiresAuth: true, wrapper: true },
  'mvp-farmer': { component: FarmerMVP, requiresAuth: true, wrapper: true },
  'farmer-dashboard': { component: FarmerDashboard, requiresAuth: true, wrapper: true },
  'validation-dashboard': { component: ValidationDashboard, requiresAuth: true, wrapper: true },
  'vessel-dashboard': { component: VesselDashboard, requiresAuth: true, wrapper: true },
  'mvp-vessel': { component: VesselMVP, requiresAuth: true, wrapper: true },
  'mvp-admin': { component: AdminMVP, requiresAuth: true, wrapper: true },
  'admin-panel': { component: AdminPanel, requiresAuth: true, wrapper: true },
  'mvp-analytics': { component: AnalyticsMVP, requiresAuth: true, wrapper: true },
  'mvp-fisher': { component: FisherDashboard, requiresAuth: true, wrapper: true },
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null)
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('login') // login, selectSites, dashboard, mvp-farmer, mvp-vessel, mvp-admin, mvp-analytics
  const [toast, setToast] = useState(null)

  useEffect(() => {
    // Only do path-based auto-login if token is explicitly requested (not on logout)
    // Logout sets token to null, so we should not auto-login from path in that case
    const path = window.location.pathname
    
    // Skip auto-login from path if user just logged out (token is null but page might still show old path)
    // Instead, check if there's a saved token in localStorage
    const savedToken = localStorage.getItem('token')
    
    // Only auto-login from path if explicitly enabled (future feature)
    // For now, if token exists in localStorage, use it; otherwise go to login
    
    if (path === '/admin' || path === '/admin/') {
      setToken('mvp-admin')
      localStorage.setItem('token', 'mvp-admin')
      setUser({ name: 'Admin', role: 'admin' })
      setPage('mvp-admin')
      return
    }
    if (path === '/admin-panel' || path === '/admin-panel/') {
      setToken('mvp-admin')
      localStorage.setItem('token', 'mvp-admin')
      setUser({ name: 'Admin', role: 'admin' })
      setPage('admin-panel')
      return
    }
    if (path === '/farmer' || path === '/farmer/') {
      setToken('mvp-farmer')
      localStorage.setItem('token', 'mvp-farmer')
      setUser({ name: 'Farmer', role: 'farmer' })
      setPage('mvp-farmer')
      return
    }
    if (path === '/fisher' || path === '/fisher/') {
      setToken('mvp-fisher')
      localStorage.setItem('token', 'mvp-fisher')
      setUser({ name: 'Yrkesfisker', role: 'fisher' })
      setPage('mvp-fisher')
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
    } else {
      // No token, ensure we're on login page
      setPage('login')
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

  const handleSitesSelected = useCallback(() => {
    setPage('dashboard')
    showToast('Anlegg opprettet. Starter overvåking...')
  }, [])

  const handleSelectDashboard = useCallback((dashboardId) => {
    setPage(dashboardId)
    showToast('Åpner dashbord...')
  }, [])

  const handleLogout = useCallback(() => {
    console.log('✓ Logout button clicked!')
    setToken(null)
    localStorage.removeItem('token')
    localStorage.removeItem('aquashield_user')
    setUser(null)
    setPage('login')
    showToast('Logget ut')
    // Clear all state before redirect to prevent re-login
    setTimeout(() => {
      window.location.href = '/'
      window.location.reload()
    }, 300)
  }, [])

  const handleSwitchRole = useCallback((role) => {
    const pageMap = {
      'farmer': 'mvp-farmer',
      'brønnbåt': 'vessel-dashboard',
      'admin': 'admin-panel'
    }
    const targetPage = pageMap[role]
    if (targetPage) {
      setPage(targetPage)
      showToast(`Bytta til ${role} rolle`)
    }
  }, [])

  const handleMVPLogin = useCallback((role) => {
    const token = `mvp-${role}`
    setToken(token)
    localStorage.setItem('token', token)
    setUser({ name: `MVP ${role}`, role: role })
    
    // Route directly to role-specific dashboard
    let targetPage = 'dashboard'
    if (role === 'brønnbåt' || role === 'vessel') {
      targetPage = 'vessel-dashboard'
    } else if (role === 'anleggsseler' || role === 'farmer') {
      targetPage = 'farmer-dashboard'
    } else if (role === 'admin') {
      targetPage = 'mvp-admin'
    }
    
    setPage(targetPage)
    showToast(`Testet ${role} rolle`)
  }, [])

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
    } else if (page === 'dashboard') {
      element = <Component onSelectDashboard={handleSelectDashboard} user={user} {...commonProps} />
    } else {
      element = <Component currentUser={user} {...commonProps} />
    }
    
    if (config.wrapper) {
      return <MVPWrapper onLogout={handleLogout} onSwitchRole={handleSwitchRole} currentRole={user?.role}>{element}</MVPWrapper>
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
