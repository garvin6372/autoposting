import React, { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import {
  BarChart3,
  TrendingUp,
  RefreshCw,
  Users,
  Eye,
  Heart,
  MessageSquare,
  Share2,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Film,
  Image as ImageIcon,
  Play
} from 'lucide-react'
import {
  YoutubeIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  TikTokIcon
} from '@/components/icons/PlatformIcons'
import { supabase } from '@/lib/supabase'

interface AccountMetricDaily {
  id: string
  account_id: string
  recorded_date: string
  followers_count: number
  views_count: number
  likes_count: number
  comments_count: number
  shares_count: number
  extra_metrics: Record<string, any>
  social_accounts?: {
    id: string
    platform: string
    account_name: string
    username: string | null
    profile_picture_url: string | null
  }
}

export interface LivePlatformPost {
  id: string
  accountId: string
  accountName: string
  platform: 'youtube' | 'facebook' | 'instagram' | 'tiktok' | 'linkedin'
  title: string
  caption?: string
  thumbnailUrl: string
  liveUrl: string
  publishedAt: string
  views: number
  likes: number
  comments: number
  shares: number
  mediaType?: 'video' | 'image' | 'carousel' | 'text'
}

export const AnalyticsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all')
  const [timeframe, setTimeframe] = useState('30d')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [metricsList, setMetricsList] = useState<AccountMetricDaily[]>([])
  const [livePosts, setLivePosts] = useState<LivePlatformPost[]>([])
  const [warningsList, setWarningsList] = useState<Array<{ account: string; platform: string; message: string }>>([])
  const [loadingLivePosts, setLoadingLivePosts] = useState(false)
  const [bannerMessage, setBannerMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const tabs = [
    { id: 'all', name: 'All Accounts' },
    { id: 'youtube', name: 'YouTube' },
    { id: 'facebook', name: 'Facebook' },
    { id: 'instagram', name: 'Instagram' },
    { id: 'tiktok', name: 'TikTok' },
    { id: 'linkedin', name: 'LinkedIn' },
  ]

  // 1. Fetch daily metrics
  const fetchAnalyticsData = async () => {
    setLoading(true)
    try {
      const { data: metricsData, error: metricsErr } = await supabase
        .from('account_metrics_daily')
        .select(`
          id,
          account_id,
          recorded_date,
          followers_count,
          views_count,
          likes_count,
          comments_count,
          shares_count,
          extra_metrics,
          social_accounts (
            id,
            platform,
            account_name,
            username,
            profile_picture_url
          )
        `)
        .order('recorded_date', { ascending: false })

      if (!metricsErr && metricsData) {
        setMetricsList(metricsData as any)
      }
    } catch (err) {
      console.error('Failed to load metrics:', err)
    } finally {
      setLoading(false)
    }
  }

  // 2. Fetch live native posts direct from platform APIs (no database table required)
  const fetchLivePlatformPosts = async () => {
    setLoadingLivePosts(true)
    try {
      const { data, error } = await supabase.functions.invoke('fetch-platform-posts', {
        body: { platform: activeTab },
      })

      if (error) throw error

      if (data?.posts) {
        setLivePosts(data.posts)
      }
      if (data?.warnings) {
        setWarningsList(data.warnings)
      }
    } catch (err: any) {
      console.warn('Failed to fetch direct platform posts:', err.message)
    } finally {
      setLoadingLivePosts(false)
    }
  }

  useEffect(() => {
    fetchAnalyticsData()
    fetchLivePlatformPosts()
  }, [])

  const handleRefreshAll = async () => {
    setIsRefreshing(true)
    setBannerMessage(null)
    try {
      // Refresh metrics via sync-analytics
      const { data, error } = await supabase.functions.invoke('sync-analytics', {
        body: {},
      })

      if (error) throw error

      setBannerMessage({
        type: 'success',
        text: data?.message || 'Analytics synced successfully from connected social platforms!',
      })

      // Refetch both metrics & direct platform posts
      await Promise.all([fetchAnalyticsData(), fetchLivePlatformPosts()])
    } catch (err: any) {
      console.error('Sync failed:', err)
      setBannerMessage({
        type: 'error',
        text: `Sync error: ${err.message || 'Failed to reach sync-analytics service'}`,
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  // Filter metrics based on active platform tab
  const filteredMetrics = metricsList.filter((m) => {
    if (activeTab === 'all') return true
    return m.social_accounts?.platform === activeTab
  })

  // Get most recent metric row for each distinct account
  const latestAccountMetricsMap = new Map<string, AccountMetricDaily>()
  for (const item of filteredMetrics) {
    if (!latestAccountMetricsMap.has(item.account_id)) {
      latestAccountMetricsMap.set(item.account_id, item)
    }
  }
  const latestAccountMetrics = Array.from(latestAccountMetricsMap.values())

  // Aggregate numbers
  const totalFollowers = latestAccountMetrics.reduce(
    (acc, m) => acc + Number(m.followers_count || 0),
    0
  )
  const totalViews = latestAccountMetrics.reduce(
    (acc, m) => acc + Number(m.views_count || 0),
    0
  )
  const totalLikes = latestAccountMetrics.reduce(
    (acc, m) => acc + Number(m.likes_count || 0),
    0
  )

  // Filter live posts based on active tab
  const filteredLivePosts = livePosts.filter((p) => {
    if (activeTab === 'all') return true
    return p.platform === activeTab
  })

  // Filter warnings based on active tab
  const filteredWarnings = warningsList.filter((w) => {
    if (activeTab === 'all') return true
    return w.platform === activeTab
  })

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'youtube':
        return <YoutubeIcon className="w-4 h-4 text-red-500" />
      case 'facebook':
        return <FacebookIcon className="w-4 h-4 text-blue-500" />
      case 'instagram':
        return <InstagramIcon className="w-4 h-4 text-pink-500" />
      case 'tiktok':
        return <TikTokIcon className="w-4 h-4 text-black dark:text-white" />
      case 'linkedin':
        return <LinkedinIcon className="w-4 h-4 text-sky-500" />
      default:
        return null
    }
  }

  return (
    <div>
      <Header title="Analytics & Growth" subtitle="Track reach, impressions, and live posts feed direct from each platform API" />

      <div className="p-8 max-w-7xl mx-auto space-y-6">
        {/* Banner Notification */}
        {bannerMessage && (
          <div
            className={`p-4 rounded-2xl flex items-center gap-3 text-sm ${
              bannerMessage.type === 'success'
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-200'
                : 'bg-rose-500/15 border border-rose-500/30 text-rose-200'
            }`}
          >
            {bannerMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span className="flex-1">{bannerMessage.text}</span>
            <button
              onClick={() => setBannerMessage(null)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          {/* Platform Tabs */}
          <div className="flex flex-wrap gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* Refresh Button */}
            <button
              type="button"
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-md transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing Live APIs...' : 'Refresh All'}</span>
            </button>
          </div>
        </div>

        {/* Top Aggregate Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Total Followers</span>
              <div className="p-2 rounded-xl bg-slate-800/80 text-indigo-400">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="text-2xl font-bold text-white tracking-tight">
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-500" /> : totalFollowers.toLocaleString()}
              </div>
              <span className="text-xs font-semibold text-emerald-400">Direct API</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Total Views</span>
              <div className="p-2 rounded-xl bg-slate-800/80 text-sky-400">
                <Eye className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="text-2xl font-bold text-white tracking-tight">
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-500" /> : totalViews.toLocaleString()}
              </div>
              <span className="text-xs font-semibold text-sky-400">Cumulative</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Likes & Engagements</span>
              <div className="p-2 rounded-xl bg-slate-800/80 text-rose-400">
                <Heart className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="text-2xl font-bold text-white tracking-tight">
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-500" /> : totalLikes.toLocaleString()}
              </div>
              <span className="text-xs font-semibold text-rose-400">Reactions</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Live Posts Detected</span>
              <div className="p-2 rounded-xl bg-slate-800/80 text-emerald-400">
                <Share2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="text-2xl font-bold text-white tracking-tight">
                {loadingLivePosts ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                ) : (
                  filteredLivePosts.length
                )}
              </div>
              <span className="text-xs font-semibold text-emerald-400">Native Feed</span>
            </div>
          </div>
        </div>

        {/* Connected Channels Summary Cards */}
        {latestAccountMetrics.length > 0 && (
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">Connected Accounts Metrics</h3>
              </div>
              <span className="text-xs text-slate-400">Direct snapshots from social platform endpoints</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {latestAccountMetrics.map((item) => {
                const acc = item.social_accounts
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {acc?.profile_picture_url ? (
                        <img
                          src={acc.profile_picture_url}
                          alt={acc.account_name}
                          className="w-10 h-10 rounded-full object-cover border border-slate-700"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                          {acc?.platform ? getPlatformIcon(acc.platform) : null}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-white truncate">{acc?.account_name || 'Account'}</p>
                          {acc?.platform && getPlatformIcon(acc.platform)}
                        </div>
                        <p className="text-xs text-slate-400 truncate">{acc?.username || acc?.platform}</p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/60 grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Followers</span>
                        <span className="font-bold text-white text-sm">
                          {Number(item.followers_count || 0).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Views</span>
                        <span className="font-bold text-white text-sm">
                          {Number(item.views_count || 0).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Likes</span>
                        <span className="font-bold text-white text-sm">
                          {Number(item.likes_count || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* DIRECT API PLATFORM POSTS FEED & INDIVIDUAL POST ANALYTICS           */}
        {/* ==================================================================== */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <div>
                <h3 className="text-sm font-semibold text-white">Live Channel Posts Feed (Direct API)</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Shows all posts published directly from your social accounts (including posts published natively outside SocialHub)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchLivePlatformPosts}
              disabled={loadingLivePosts}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLivePosts ? 'animate-spin text-indigo-400' : ''}`} />
              <span>{loadingLivePosts ? 'Fetching Direct Feed...' : 'Reload Feed'}</span>
            </button>
          </div>

          {/* Platform Warning Alerts (e.g. YouTube token expired or LinkedIn permission info) */}
          {filteredWarnings.length > 0 && (
            <div className="space-y-2">
              {filteredWarnings.map((warn, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="truncate">
                      <strong>{warn.account} ({warn.platform}):</strong> {warn.message}
                    </span>
                  </div>
                  {warn.platform === 'youtube' && (
                    <a
                      href="/accounts"
                      className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 font-semibold text-[11px] shrink-0 transition-colors"
                    >
                      Reconnect Channel
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {loadingLivePosts ? (
            <div className="h-44 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <span className="text-xs">Querying YouTube, Facebook, Instagram, and TikTok APIs...</span>
            </div>
          ) : filteredLivePosts.length === 0 ? (
            <div className="h-36 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col items-center justify-center text-slate-500 text-xs text-center p-4">
              <p>No native posts detected for this channel yet.</p>
              <p className="text-[11px] text-slate-600 mt-1">
                Make sure your accounts are connected and click &quot;Reload Feed&quot; above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLivePosts.map((post) => (
                <div
                  key={post.id}
                  className="rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between overflow-hidden group shadow-sm"
                >
                  {/* Thumbnail / Media Header */}
                  <div className="relative h-44 bg-slate-900 overflow-hidden flex items-center justify-center">
                    {post.thumbnailUrl ? (
                      <img
                        src={post.thumbnailUrl}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-600 gap-1.5 p-4 text-center">
                        {post.platform && getPlatformIcon(post.platform)}
                        <span className="text-xs text-slate-400 font-medium">Text / Media Post</span>
                      </div>
                    )}

                    {/* Media Type Badge */}
                    {post.mediaType === 'video' && (
                      <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur text-[10px] text-white flex items-center gap-1 font-semibold">
                        <Play className="w-2.5 h-2.5 fill-white" />
                        <span>Video</span>
                      </div>
                    )}

                    {/* Platform Badge */}
                    <div className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/70 backdrop-blur border border-white/10">
                      {getPlatformIcon(post.platform)}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                        <span className="font-semibold text-slate-300 truncate max-w-[150px]">
                          {post.accountName}
                        </span>
                        <span>
                          {post.publishedAt
                            ? new Date(post.publishedAt).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : ''}
                        </span>
                      </div>

                      <p className="text-xs text-slate-100 font-medium line-clamp-2" title={post.title}>
                        {post.title || 'Untitled Post'}
                      </p>
                    </div>

                    {/* Post-Wise Engagement Numbers */}
                    <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-300">
                      <div className="flex items-center gap-3">
                        {post.views > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px]" title="Views">
                            <Eye className="w-3.5 h-3.5 text-sky-400" />
                            <span>{post.views.toLocaleString()}</span>
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[11px]" title="Likes / Reactions">
                          <Heart className="w-3.5 h-3.5 text-rose-400" />
                          <span>{post.likes.toLocaleString()}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px]" title="Comments">
                          <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{post.comments.toLocaleString()}</span>
                        </span>
                      </div>

                      <a
                        href={post.liveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-[11px] font-semibold transition-colors shrink-0"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
