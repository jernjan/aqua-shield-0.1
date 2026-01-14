import { useState, useEffect, useCallback, memo } from 'react'
import Login from './pages/Login'
import SelectRole from './pages/SelectRole'
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
import FarmSelector from './pages/FarmSelector'
import VesselSelector from './pages/VesselSelector'
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
        { role: 'vessel', label: '⛵ Vessel', color: '#06B6D4' },
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
  'selectRole': { component: SelectRole, requiresAuth: true },
  'selectSites': { component: SelectSites, requiresAuth: true },
  'dashboard': { component: DashboardSelector, requiresAuth: true, wrapper: true },
  'mvp-farmer': { component: FarmerMVP, requiresAuth: true, wrapper: true },
  'farm-selector': { component: FarmSelector, requiresAuth: true, wrapper: true },
  'farmer-dashboard': { component: FarmerDashboard, requiresAuth: true, wrapper: true },
  'validation-dashboard': { component: ValidationDashboard, requiresAuth: true, wrapper: true },
  'vessel-dashboard': { component: VesselDashboard, requiresAuth: true, wrapper: true },
  'mvp-vessel': { component: VesselMVP, requiresAuth: true, wrapper: true },
  'vessel-selector': { component: VesselSelector, requiresAuth: true, wrapper: true },
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
    // Check if user is logged in via localStorage
    const savedUser = localStorage.getItem('aquashield_user')
    
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser)
        setUser(userData)
        setToken('authenticated')
        
        // Route based on user role
        const rolePageMap = {
          'farmer': 'mvp-farmer',
          'vessel': 'mvp-vessel',
          'admin': 'mvp-admin'
        }
        
        const targetPage = rolePageMap[userData.role] || 'login'
        setPage(targetPage)
      } catch (e) {
        console.error('Failed to load user:', e)
        setPage('login')
      }
    } else {
      // No user saved, go to login
      setPage('login')
    }
  }, [])

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
    localStorage.removeItem('aquashield_user')
    setUser(null)
    setToken(null)
    setPage('login')
    showToast('Logget ut')
    setTimeout(() => {
      window.location.href = '/'
      window.location.reload()
    }, 300)
  }, [])

  const handleRoleSelected = useCallback((role) => {
    // Update user role
    const updatedUser = { ...user, role: role }
    setUser(updatedUser)
    localStorage.setItem('aquashield_user', JSON.stringify(updatedUser))
    
    // Route to correct dashboard based on role
    const pageMap = {
      'farmer': 'mvp-farmer',
      'vessel': 'mvp-vessel',
      'admin': 'mvp-admin'
    }
    
    const targetPage = pageMap[role] || 'login'
    setPage(targetPage)
    showToast(`Bytta til ${role} rolle`)
  }, [user])
  const handleSwitchRole = useCallback((role) => {
    // Update user role
    const updatedUser = { ...user, role: role }
    setUser(updatedUser)
    localStorage.setItem('aquashield_user', JSON.stringify(updatedUser))
    
    const pageMap = {
      'farmer': 'mvp-farmer',
      'vessel': 'mvp-vessel',
      'admin': 'mvp-admin'
    }
    const targetPage = pageMap[role]
    if (targetPage) {
      setPage(targetPage)
      showToast(`Bytta til ${role} rolle`)
    }
  }, [user])


  // Render current page
  const renderPage = () => {
    if (!PAGE_CONFIG[page]) return null
    
    const config = PAGE_CONFIG[page]
    const Component = config.component
    const commonProps = { token, user, onLogout: handleLogout, onToast: showToast, onNavigate: setPage }
    
    let element = null
    
    if (page === 'login') {
      element = <Component onLogin={handleLogin} {...commonProps} />
    } else if (page === 'selectSites') {
      element = <Component onSitesSelected={handleSitesSelected} {...commonProps} />
    } else if (page === 'dashboard') {
      element = <Component onSelectDashboard={handleSelectDashboard} user={user} {...commonProps} />
    } else if (page === 'farm-selector') {
      element = <Component userId={user?.id} currentUser={user} onBack={() => setPage('mvp-farmer')} {...commonProps} />
    } else if (page === 'vessel-selector') {
      element = <Component userId={user?.id} currentUser={user} onBack={() => setPage('mvp-vessel')} {...commonProps} />
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
