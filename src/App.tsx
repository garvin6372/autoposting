import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { AccountsPage } from '@/pages/AccountsPage'
import { NewPostPage } from '@/pages/NewPostPage'
import { PostDetailsPage } from '@/pages/PostDetailsPage'
import { CalendarPage } from '@/pages/CalendarPage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ApiGuidePage } from '@/pages/ApiGuidePage'
import { AgentTasksPage } from '@/pages/AgentTasksPage'
import { AutoDmPage } from '@/pages/AutoDmPage'
import { LoginPage } from '@/pages/LoginPage'
import { PrivacyPage } from '@/pages/PrivacyPage'
import { TermsPage } from '@/pages/TermsPage'
import { supabase } from '@/lib/supabase'

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session)
      setIsLoading(false)
    }).catch(() => {
      setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsAuthenticated(false)
    navigate('/login')
  }

  const handleLoginSuccess = () => {
    setIsAuthenticated(true)
    navigate('/')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium">Checking session...</span>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      {/* Public Pages */}
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            <LoginPage onLoginSuccess={handleLoginSuccess} />
          )
        }
      />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />

      {/* Protected App Routes */}
      <Route
        element={
          isAuthenticated ? <AppLayout onLogout={handleLogout} /> : <Navigate to="/login" replace />
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/agent-tasks" element={<AgentTasksPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/posts/new" element={<NewPostPage />} />
        <Route path="/auto-dm" element={<AutoDmPage />} />
        <Route path="/posts/:id" element={<PostDetailsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/api-docs" element={<ApiGuidePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
