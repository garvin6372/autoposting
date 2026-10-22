import React from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

interface AppLayoutProps {
  onLogout?: () => void
}

export const AppLayout: React.FC<AppLayoutProps> = ({ onLogout }) => {
  return (
    <div className="h-screen flex bg-slate-950 text-slate-100 overflow-hidden">
      <Sidebar onLogout={onLogout} />
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
