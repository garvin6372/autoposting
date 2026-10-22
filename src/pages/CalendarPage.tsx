import React, { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

interface PostTargetWithAccount {
  id: string
  status: string
  social_accounts: {
    platform: string
    account_name: string
  } | null
}

interface PostWithTargets {
  id: string
  content: string
  scheduled_at: string | null
  status: string
  created_at: string
  post_targets: PostTargetWithAccount[]
}

const PLATFORM_SHORT_LABELS: Record<string, string> = {
  youtube: 'YT',
  facebook: 'FB',
  instagram: 'IG',
  tiktok: 'TT',
  linkedin: 'LI',
}

export const CalendarPage: React.FC = () => {
  const [view, setView] = useState<'month' | 'week'>('month')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [posts, setPosts] = useState<PostWithTargets[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Calculate start of month day of week and days count
  const firstDayIndex = new Date(year, month, 1).getDay()
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate()
  const prevMonthTotalDays = new Date(year, month, 0).getDate()

  const fetchMonthPosts = async () => {
    setLoading(true)
    try {
      const startIso = new Date(year, month, 1, 0, 0, 0).toISOString()
      const endIso = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          scheduled_at,
          status,
          created_at,
          post_targets (
            id,
            status,
            social_accounts (
              platform,
              account_name
            )
          )
        `)
        .not('scheduled_at', 'is', null)
        .gte('scheduled_at', startIso)
        .lte('scheduled_at', endIso)
        .order('scheduled_at', { ascending: true })

      if (error) {
        console.error('Error fetching calendar posts:', error)
      } else {
        setPosts((data as any) || [])
      }
    } catch (err) {
      console.error('Calendar posts fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMonthPosts()
  }, [year, month])

  const handlePrev = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const handleNext = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const getStatusChipClass = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
      case 'scheduled':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
      case 'publishing':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
      case 'failed':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30'
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700'
    }
  }

  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
  const todayDateNumber = today.getDate()

  // Generate calendar cells (padding + current month days)
  const calendarCells: { dayNumber: number; inCurrentMonth: boolean; dateObj: Date }[] = []

  // Preceding month filler days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = prevMonthTotalDays - i
    calendarCells.push({
      dayNumber: d,
      inCurrentMonth: false,
      dateObj: new Date(year, month - 1, d),
    })
  }

  // Current month days
  for (let d = 1; d <= totalDaysInMonth; d++) {
    calendarCells.push({
      dayNumber: d,
      inCurrentMonth: true,
      dateObj: new Date(year, month, d),
    })
  }

  // Trailing filler days to complete grid (multiples of 7)
  const remaining = (7 - (calendarCells.length % 7)) % 7
  for (let d = 1; d <= remaining; d++) {
    calendarCells.push({
      dayNumber: d,
      inCurrentMonth: false,
      dateObj: new Date(year, month + 1, d),
    })
  }

  return (
    <div>
      <Header title="Content Calendar" subtitle="Interactive scheduled posting view" />

      <div className="p-8 max-w-7xl mx-auto space-y-6">
        {/* Calendar Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-800 text-indigo-400">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                {monthName}
                {loading && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
              </h3>
              <p className="text-xs text-slate-400">Time zone: Local Browser Time</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setView('month')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  view === 'month' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => setView('week')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  view === 'week' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Week
              </button>
            </div>

            <button
              type="button"
              onClick={handleToday}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Today
            </button>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrev}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <Link
              to="/posts/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all ml-2"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule</span>
            </Link>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-sm">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-900/80">
            {daysOfWeek.map((d) => (
              <div key={d} className="p-3 text-center text-xs font-semibold uppercase text-slate-400">
                {d}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 auto-rows-[130px] divide-x divide-y divide-slate-800/80">
            {calendarCells.map((cell, idx) => {
              const isToday = isCurrentMonth && cell.inCurrentMonth && cell.dayNumber === todayDateNumber

              // Filter posts scheduled on this date
              const dayPosts = cell.inCurrentMonth
                ? posts.filter((p) => {
                    if (!p.scheduled_at) return false
                    const pDate = new Date(p.scheduled_at)
                    return (
                      pDate.getFullYear() === year &&
                      pDate.getMonth() === month &&
                      pDate.getDate() === cell.dayNumber
                    )
                  })
                : []

              return (
                <div
                  key={idx}
                  className={`p-2 relative flex flex-col justify-between transition-colors hover:bg-slate-800/20 ${
                    !cell.inCurrentMonth ? 'bg-slate-950/40 opacity-40' : ''
                  } ${isToday ? 'bg-indigo-950/25 ring-1 ring-inset ring-indigo-500/40' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-semibold ${
                        isToday
                          ? 'w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md'
                          : 'text-slate-400'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>
                    {cell.inCurrentMonth && dayPosts.length > 0 && (
                      <span className="text-[10px] text-slate-500 font-medium">
                        {dayPosts.length} post{dayPosts.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 overflow-y-auto max-h-[85px] pr-0.5 scrollbar-thin">
                    {dayPosts.map((post) => {
                      const timeStr = post.scheduled_at
                        ? new Date(post.scheduled_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''

                      const platforms = Array.from(
                        new Set(
                          post.post_targets
                            ?.map((t) => PLATFORM_SHORT_LABELS[t.social_accounts?.platform || ''] || '')
                            .filter(Boolean)
                        )
                      )

                      return (
                        <Link
                          key={post.id}
                          to={`/posts/${post.id}`}
                          className={`block p-1.5 rounded-lg border text-[11px] font-medium transition-all hover:scale-[1.01] ${getStatusChipClass(
                            post.status
                          )}`}
                          title={post.content}
                        >
                          <div className="truncate font-semibold text-slate-100">
                            {post.content || 'Untitled Post'}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] opacity-80 mt-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{timeStr}</span>
                            {platforms.length > 0 && (
                              <>
                                <span>•</span>
                                <span>{platforms.join(', ')}</span>
                              </>
                            )}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
