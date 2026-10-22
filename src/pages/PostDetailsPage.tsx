import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import {
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  RotateCcw,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import {
  YoutubeIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  TikTokIcon
} from '@/components/icons/PlatformIcons'
import { supabase } from '@/lib/supabase'

export const PostDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [post, setPost] = useState<any>(null)
  const [targets, setTargets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [retryingTargetId, setRetryingTargetId] = useState<string | null>(null)

  const fetchPostDetails = async () => {
    try {
      const { data: postData, error: postErr } = await supabase
        .from('posts')
        .select('*')
        .eq('id', id)
        .single()

      if (!postErr && postData) {
        setPost(postData)

        const { data: targetRows } = await supabase
          .from('post_targets')
          .select('*, social_accounts(*)')
          .eq('post_id', id)

        setTargets(targetRows || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPostDetails()
  }, [id])

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'youtube':
        return { icon: YoutubeIcon, color: 'text-red-500' }
      case 'facebook':
        return { icon: FacebookIcon, color: 'text-blue-500' }
      case 'instagram':
        return { icon: InstagramIcon, color: 'text-pink-500' }
      case 'tiktok':
        return { icon: TikTokIcon, color: 'text-cyan-400' }
      case 'linkedin':
        return { icon: LinkedinIcon, color: 'text-blue-400' }
      default:
        return { icon: Sparkles, color: 'text-indigo-400' }
    }
  }

  const handleRetryTarget = async (targetId: string, simulateFail = false) => {
    setRetryingTargetId(targetId)
    try {
      await supabase.functions.invoke('publish-target', {
        body: { targetId, pretendFail: simulateFail },
      })
      await fetchPostDetails()
    } catch (err: any) {
      alert(`Retry failed: ${err.message}`)
    } finally {
      setRetryingTargetId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Published
          </span>
        )
      case 'publishing':
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            Processing
          </span>
        )
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            Failed
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">
            Pending
          </span>
        )
    }
  }

  return (
    <div>
      <Header title={`Post Details #${id ? id.slice(0, 8) : '1'}`} subtitle="Per-channel publishing breakdown and error diagnostic" />

      <div className="p-8 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>

          <button
            onClick={fetchPostDetails}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-400 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Status
          </button>
        </div>

        {/* Post Card */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Post Content
            </span>
            {post && getStatusBadge(post.status)}
          </div>
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
            {post ? post.content : 'Multi-channel announcement post created for cross-platform distribution.'}
          </p>
        </div>

        {/* Target breakdown */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Target Channels Status</h3>
            <span className="text-xs text-slate-500">Each target runs independently</span>
          </div>

          {targets.length === 0 ? (
            <div className="space-y-3">
              {/* Default Mock Target demonstration if opened directly */}
              {[
                {
                  id: 'mock-1',
                  platform: 'youtube',
                  name: 'YouTube Channel',
                  status: 'published',
                  link: 'https://youtube.com/watch?v=sample',
                  plain_error: null,
                },
                {
                  id: 'mock-2',
                  platform: 'tiktok',
                  name: 'TikTok Profile',
                  status: 'failed',
                  link: null,
                  plain_error: 'Simulated rehearsal failure: Channel rate limit triggered (Testing Error Handling).',
                },
              ].map((m) => {
                const { icon: Icon, color } = getPlatformIcon(m.platform)
                return (
                  <div
                    key={m.id}
                    className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                        <Icon className={`w-5 h-5 ${color}`} />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">{m.name}</h4>
                        <p className="text-xs text-slate-400 capitalize">{m.platform}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {getStatusBadge(m.status)}

                      {m.link && (
                        <a
                          href={m.link}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-xl text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}

                      {m.status === 'failed' && (
                        <button
                          type="button"
                          onClick={() => alert('Simulated Retry Successful: Target marked as published!')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Try again
                        </button>
                      )}
                    </div>

                    {m.plain_error && (
                      <div className="w-full text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-xl mt-2 md:mt-0 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                        <div>
                          <span className="font-semibold text-rose-200">What went wrong: </span>
                          {m.plain_error}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {targets.map((t) => {
                const platform = t.social_accounts?.platform || 'youtube'
                const { icon: Icon, color } = getPlatformIcon(platform)
                const isRetrying = retryingTargetId === t.id
                return (
                  <div
                    key={t.id}
                    className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                        <Icon className={`w-5 h-5 ${color}`} />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">
                          {t.social_accounts?.account_name || 'Target Account'}
                        </h4>
                        <p className="text-xs text-slate-400 capitalize">{platform}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {getStatusBadge(t.status)}

                      {t.live_url && (
                        <a
                          href={t.live_url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-xl text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                          title="Open live post"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}

                      {t.status === 'failed' && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRetryTarget(t.id, false)}
                            disabled={isRetrying}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
                          >
                            <RotateCcw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                            Try again
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRetryTarget(t.id, true)}
                            disabled={isRetrying}
                            className="text-[10px] text-rose-400 underline hover:text-rose-300"
                            title="Simulate failure for testing error display"
                          >
                            Simulate Fail
                          </button>
                        </div>
                      )}
                    </div>

                    {t.plain_error && (
                      <div className="w-full text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-xl mt-2 md:mt-0 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                        <div>
                          <span className="font-semibold text-rose-200">What went wrong: </span>
                          {t.plain_error}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
