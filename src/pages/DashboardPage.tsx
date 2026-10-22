import React, { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import {
  Users,
  Eye,
  Heart,
  Share2,
  Plus,
  AlertCircle,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Loader2
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export const DashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [hasAccounts, setHasAccounts] = useState(false)
  const [totalFollowers, setTotalFollowers] = useState<number>(0)
  const [totalViews, setTotalViews] = useState<number>(0)
  const [totalLikes, setTotalLikes] = useState<number>(0)
  const [publishedCount, setPublishedCount] = useState<number>(0)
  const [upcomingPosts, setUpcomingPosts] = useState<any[]>([])
  const [recentPosts, setRecentPosts] = useState<any[]>([])

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true)
      try {
        // 1. Check connected accounts
        const { data: accounts } = await supabase
          .from('social_accounts')
          .select('id')
          .eq('status', 'connected')

        setHasAccounts(Boolean(accounts && accounts.length > 0))

        // 2. Fetch daily metrics
        const { data: metrics } = await supabase
          .from('account_metrics_daily')
          .select('*')
          .order('recorded_date', { ascending: false })

        if (metrics && metrics.length > 0) {
          // Keep only latest per account
          const latestMap = new Map<string, any>()
          for (const m of metrics) {
            if (!latestMap.has(m.account_id)) {
              latestMap.set(m.account_id, m)
            }
          }
          const latestList = Array.from(latestMap.values())
          setTotalFollowers(latestList.reduce((acc, m) => acc + Number(m.followers_count || 0), 0))
          setTotalViews(latestList.reduce((acc, m) => acc + Number(m.views_count || 0), 0))
          setTotalLikes(latestList.reduce((acc, m) => acc + Number(m.likes_count || 0), 0))
        }

        // 3. Fetch upcoming scheduled posts
        const { data: upcoming } = await supabase
          .from('posts')
          .select(`
            id,
            content,
            scheduled_at,
            status,
            post_targets (
              social_accounts (
                platform
              )
            )
          `)
          .eq('status', 'scheduled')
          .gte('scheduled_at', new Date().toISOString())
          .order('scheduled_at', { ascending: true })
          .limit(5)

        setUpcomingPosts(upcoming || [])

        // 4. Fetch recent published posts
        const { data: recent, count: pubCount } = await supabase
          .from('post_targets')
          .select(`
            id,
            status,
            live_url,
            published_at,
            posts (
              id,
              content
            ),
            social_accounts (
              platform,
              account_name
            )
          `, { count: 'exact' })
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .limit(5)

        setRecentPosts(recent || [])
        setPublishedCount(pubCount || (recent ? recent.length : 0))
      } catch (err) {
        console.error('Failed to load dashboard:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  const metrics = [
    {
      label: 'Total Followers',
      value: loading ? '...' : totalFollowers.toLocaleString(),
      change: 'Live API',
      icon: Users,
      color: 'text-blue-400',
    },
    {
      label: 'Total Views',
      value: loading ? '...' : totalViews.toLocaleString(),
      change: 'Sync',
      icon: Eye,
      color: 'text-indigo-400',
    },
    {
      label: 'Likes & Engagements',
      value: loading ? '...' : totalLikes.toLocaleString(),
      change: 'Active',
      icon: Heart,
      color: 'text-pink-400',
    },
    {
      label: 'Published Posts',
      value: loading ? '...' : publishedCount.toString(),
      change: 'Platform Targets',
      icon: Share2,
      color: 'text-emerald-400',
    },
  ]

  return (
    <div>
      <Header title="Dashboard" subtitle="Overview across all connected platforms" />

      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        {/* Warning Banner (Shown only if no accounts connected) */}
        {!hasAccounts && !loading && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3.5 text-amber-200">
            <AlertCircle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div className="flex-1 text-sm">
              <span className="font-semibold text-amber-100">Setup Mode Active:</span> Connect your YouTube, Meta (Facebook & Instagram), TikTok, and LinkedIn credentials in Accounts to start publishing live.
            </div>
            <Link
              to="/accounts"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 transition-colors"
            >
              Connect Accounts
            </Link>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {metrics.map((m) => {
            const Icon = m.icon
            return (
              <div
                key={m.label}
                className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-sm hover:border-slate-700/80 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">{m.label}</span>
                  <div className={`p-2 rounded-xl bg-slate-800/80 ${m.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <div className="text-2xl font-bold text-white tracking-tight">{m.value}</div>
                  <span className="text-xs font-semibold text-emerald-400 flex items-center">
                    {m.change}
                    <ArrowUpRight className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-900/60 border border-indigo-900/40">
          <div>
            <h3 className="text-base font-semibold text-white">Create & Schedule a New Post</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Draft once and publish across YouTube, Facebook, Instagram, TikTok, and LinkedIn.
            </p>
          </div>
          <Link
            to="/posts/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Post</span>
          </Link>
        </div>

        {/* Posts Sections: Upcoming & Recent */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">Upcoming Scheduled Posts</h3>
              </div>
              <Link to="/calendar" className="text-xs text-indigo-400 hover:text-indigo-300">
                View Calendar →
              </Link>
            </div>

            <div className="space-y-3">
              {upcomingPosts.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 rounded-xl bg-slate-950/40 border border-slate-800/60">
                  <p>No posts currently scheduled.</p>
                  <Link to="/posts/new" className="mt-2 inline-block text-indigo-400 hover:text-indigo-300 font-medium">
                    + Schedule your first post
                  </Link>
                </div>
              ) : (
                upcomingPosts.map((post) => {
                  const platforms = Array.from(
                    new Set(
                      post.post_targets
                        ?.map((t: any) => t.social_accounts?.platform)
                        .filter(Boolean)
                    )
                  )

                  return (
                    <Link
                      key={post.id}
                      to={`/posts/${post.id}`}
                      className="block p-4 rounded-xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition-all group"
                    >
                      <p className="text-sm text-slate-200 font-medium line-clamp-1 group-hover:text-indigo-300 transition-colors">
                        {post.content || 'Untitled Post'}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                        <span className="flex items-center gap-1.5 text-slate-300">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          {new Date(post.scheduled_at).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="capitalize text-slate-400">{platforms.join(', ')}</span>
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          </div>

          {/* Recent Published */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Recently Published</h3>
              </div>
              <Link to="/analytics" className="text-xs text-indigo-400 hover:text-indigo-300">
                Analytics Details →
              </Link>
            </div>

            <div className="space-y-3">
              {recentPosts.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 rounded-xl bg-slate-950/40 border border-slate-800/60">
                  <p>No posts published yet.</p>
                  <Link to="/posts/new" className="mt-2 inline-block text-indigo-400 hover:text-indigo-300 font-medium">
                    Publish your first post now →
                  </Link>
                </div>
              ) : (
                recentPosts.map((target) => (
                  <div
                    key={target.id}
                    className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-200 font-medium truncate">
                        {target.posts?.content || 'Media Post'}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                        <span className="capitalize text-indigo-300 font-medium">
                          {target.social_accounts?.platform}
                        </span>
                        <span>•</span>
                        <span>
                          {target.published_at
                            ? new Date(target.published_at).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Recent'}
                        </span>
                      </div>
                    </div>
                    {target.live_url && (
                      <a
                        href={target.live_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 text-xs font-semibold shrink-0"
                      >
                        Open
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
