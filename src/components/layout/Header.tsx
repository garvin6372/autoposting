import React from 'react'
import { Bell, ShieldCheck, User } from 'lucide-react'

interface HeaderProps {
  title?: string
  subtitle?: string
  children?: React.ReactNode
  rightActions?: React.ReactNode
  className?: string
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, children, rightActions, className }) => {
  return (
    <header className={`h-14 px-6 border-b border-slate-800 bg-slate-900/40 backdrop-blur-sm flex items-center justify-between shrink-0 z-30 ${className || ''}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div>
          <h2 className="text-base font-semibold text-white tracking-tight truncate">{title || 'Dashboard'}</h2>
          {subtitle && <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>}
        </div>
        {children}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {rightActions}

        {/* Cloud Connection Badge */}
        <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Cloud Connected</span>
        </div>

        {/* Notifications */}
        <button
          className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors relative"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="w-2 h-2 rounded-full bg-indigo-500 absolute top-1 right-1" />
        </button>

        {/* User Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-slate-700 to-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <User className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-medium text-slate-200 hidden md:inline">Admin</span>
        </div>
      </div>
    </header>
  )
}

