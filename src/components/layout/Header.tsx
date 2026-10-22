import React, { useState, useEffect } from 'react'
import { Bell, ShieldCheck, User, Moon, Sparkles, SunDim } from 'lucide-react'

interface HeaderProps {
  title?: string
  subtitle?: string
  children?: React.ReactNode
  rightActions?: React.ReactNode
  className?: string
}

type DarkTheme = 'obsidian' | 'charcoal' | 'midnight'

export const Header: React.FC<HeaderProps> = ({ title, subtitle, children, rightActions, className }) => {
  const [theme, setTheme] = useState<DarkTheme>(() => {
    return (localStorage.getItem('socialhub_theme') as DarkTheme) || 'obsidian'
  })
  const [showThemeMenu, setShowThemeMenu] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('socialhub_theme', theme)
  }, [theme])

  const themes: { id: DarkTheme; name: string; dot: string }[] = [
    { id: 'obsidian', name: 'OLED Black', dot: 'bg-neutral-900 border-neutral-700' },
    { id: 'charcoal', name: 'Charcoal Dark', dot: 'bg-zinc-800 border-zinc-600' },
    { id: 'midnight', name: 'Midnight Navy', dot: 'bg-slate-900 border-blue-900' },
  ]

  return (
    <header className={`h-14 px-6 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md flex items-center justify-between shrink-0 z-30 ${className || ''}`}>
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
        <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Cloud Connected</span>
        </div>

        {/* Dark Theme Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-850 border border-slate-800 transition"
            title="Change Dark Theme"
          >
            <Moon className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline capitalize">{theme}</span>
          </button>

          {showThemeMenu && (
            <div className="absolute right-0 mt-2 w-44 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50 space-y-0.5 animate-in fade-in">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Dark Mode Style
              </div>
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTheme(t.id)
                    setShowThemeMenu(false)
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                    theme === t.id
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full border ${t.dot}`} />
                    <span>{t.name}</span>
                  </div>
                  {theme === t.id && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <button
          className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-colors relative border border-transparent hover:border-slate-800"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="w-2 h-2 rounded-full bg-indigo-500 absolute top-1 right-1" />
        </button>

        {/* User Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800/80">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-slate-800 to-slate-900 border border-slate-700/60 flex items-center justify-center text-slate-300">
            <User className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-medium text-slate-200 hidden md:inline">Admin</span>
        </div>
      </div>
    </header>
  )
}
