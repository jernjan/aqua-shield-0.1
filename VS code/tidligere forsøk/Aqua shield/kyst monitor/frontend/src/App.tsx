import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { FarmsPage } from '@/pages/FarmsPage'
import { VesselsPage } from '@/pages/VesselsPage'
import { AlertsPage } from '@/pages/AlertsPage'
import DiseaseRiskPage from '@/pages/DiseaseRiskPage'
import '@/index.css'

function App() {
  const { isAuthenticated, setDemoMode } = useAuthStore()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Always use demo mode for MVP - do this FIRST before rendering
    setDemoMode()
    setIsReady(true)
  }, [setDemoMode])

  if (!isReady) {
    return <div className="flex items-center justify-center h-screen w-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />}
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/farms"
          element={
            <ProtectedRoute>
              <FarmsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vessels"
          element={
            <ProtectedRoute>
              <VesselsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/alerts"
          element={
            <ProtectedRoute>
              <AlertsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/disease-risk"
          element={
            <ProtectedRoute>
              <DiseaseRiskPage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
