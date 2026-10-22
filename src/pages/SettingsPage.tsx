import React, { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Globe, Lock, RefreshCw, KeyRound, Check, Database, Moon } from 'lucide-react'

export const SettingsPage: React.FC = () => {
  const [timeZone, setTimeZone] = useState('Asia/Kolkata')
  const [theme, setTheme] = useState(() => localStorage.getItem('socialhub_theme') || 'obsidian')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [savedSuccess, setSavedSuccess] = useState(false)

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('socialhub_theme', newTheme)
  }

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault()
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 2500)
  }

  return (
    <div>
      <Header title="Settings" subtitle="Account preferences, time zone, and system controls" />

      <div className="p-8 max-w-4xl mx-auto space-y-8">
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Dark Theme Selection Card */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-slate-800 text-indigo-400">
                <Moon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Appearance & Dark Theme</h3>
                <p className="text-xs text-slate-400">Select your preferred high-contrast dark aesthetic</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {[
                { id: 'obsidian', name: 'Obsidian OLED', desc: 'Pure pitch black #000000 for maximum contrast and OLED screens.' },
                { id: 'charcoal', name: 'Charcoal Dark', desc: 'Deep zinc #09090b modern dark aesthetic.' },
                { id: 'midnight', name: 'Midnight Navy', desc: 'Deep subtle indigo-navy tinted dark mode.' },
              ].map((t) => (
                <div
                  key={t.id}
                  onClick={() => handleThemeChange(t.id)}
                  className={`cursor-pointer p-4 rounded-xl border text-xs transition ${
                    theme === t.id
                      ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-lg shadow-indigo-950/30'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-white text-xs">{t.name}</span>
                    {theme === t.id && <span className="w-2 h-2 rounded-full bg-indigo-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Time Zone Card */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-slate-800 text-indigo-400">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Time Zone Configuration</h3>
                <p className="text-xs text-slate-400">All scheduled posts are calculated and rendered in this time zone</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Selected Time Zone</label>
              <select
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST - UTC+5:30)</option>
                <option value="UTC">UTC (Universal Time Coordinated)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
              </select>
            </div>
          </div>

          {/* Password Update Card */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-slate-800 text-indigo-400">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Security & Password</h3>
                <p className="text-xs text-slate-400">Update your Supabase Auth master account password</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Database & Cloud Info */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-slate-800 text-indigo-400">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Connected Cloud Infrastructure</h3>
                <p className="text-xs text-slate-400">Active Supabase Postgres and Edge Functions environment</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs font-mono text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Project Reference:</span>
                <span className="text-indigo-400 font-semibold">vusbdvgspxjaoigqfipa</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Endpoint:</span>
                <span className="text-slate-200">https://vusbdvgspxjaoigqfipa.supabase.co</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cron Scheduler:</span>
                <span className="text-emerald-400">pg_cron enabled (1-minute intervals)</span>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {savedSuccess && (
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <Check className="w-4 h-4" /> Preferences saved!
              </span>
            )}
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all"
            >
              Save Preferences
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
