import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { LogOut, Home, AlertCircle, Ship, Waves, Bug } from 'lucide-react'

export const Header: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <header className="bg-slate-900 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition"
          onClick={() => navigate('/dashboard')}
        >
          <Waves className="w-8 h-8 text-blue-500" />
          <h1 className="text-2xl font-bold text-white">AquaShield</h1>
        </div>

        <nav className="hidden md:flex items-center gap-8">
          <a
            href="/dashboard"
            className={`flex items-center gap-2 transition ${
              isActive('/dashboard')
                ? 'text-blue-400 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Home className="w-4 h-4" />
            Dashboard
          </a>
          <a
            href="/farms"
            className={`transition ${
              isActive('/farms')
                ? 'text-blue-400 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Farms
          </a>
          <a
            href="/vessels"
            className={`flex items-center gap-2 transition ${
              isActive('/vessels')
                ? 'text-blue-400 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Ship className="w-4 h-4" />
            Vessels
          </a>
          <a
            href="/alerts"
            className={`flex items-center gap-2 transition ${
              isActive('/alerts')
                ? 'text-blue-400 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            Alerts
          </a>
          <a
            href="/disease-risk"
            className={`flex items-center gap-2 transition ${
              isActive('/disease-risk')
                ? 'text-blue-400 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bug className="w-4 h-4" />
            Disease Risk
          </a>
        </nav>

        <div className="flex items-center gap-4">
          {user && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-400">{user.username}</span>
              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
