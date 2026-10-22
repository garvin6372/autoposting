import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Share2,
  PlusSquare,
  CalendarDays,
  BarChart3,
  Settings,
  Shield,
  FileText,
  LogOut,
  Radio,
  Code2,
  Bot,
  MessageSquareReply
} from 'lucide-react'

interface SidebarProps {
  onLogout?: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  const mainNav = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Agent Tasks', path: '/agent-tasks', icon: Bot },
    { name: 'New Post', path: '/posts/new', icon: PlusSquare },
    { name: 'Auto DM', path: '/auto-dm', icon: MessageSquareReply },
    { name: 'Calendar', path: '/calendar', icon: CalendarDays },
    { name: 'Accounts', path: '/accounts', icon: Share2 },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'Developer API', path: '/api-docs', icon: Code2 },
    { name: 'Settings', path: '/settings', icon: Settings },
  ]

  const legalNav = [
    { name: 'Privacy Policy', path: '/privacy', icon: Shield },
    { name: 'Terms of Service', path: '/terms', icon: FileText },
  ]

  return (
    <aside className="w-64 bg-slate-900/90 border-r border-slate-800 flex flex-col justify-between shrink-0 h-screen sticky top-0 backdrop-blur-md">
      <div>
        {/* Brand */}
        <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800/80">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white leading-none">SocialHub</h1>
            <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-ping" />
              Private Cloud
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 px-3 py-2">
            Main Menu
          </div>
          {mainNav.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            )
          })}
        </nav>
      </div>

      {/* Footer / Legal & Status */}
      <div className="p-4 border-t border-slate-800/80 space-y-3">
        <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 px-3">
          Public & Legal
        </div>
        <div className="space-y-1">
          {legalNav.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'text-indigo-400 bg-indigo-500/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`
                }
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            )
          })}
        </div>

        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-colors mt-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        )}
      </div>
    </aside>
  )
}
