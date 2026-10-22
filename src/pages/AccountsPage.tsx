import React, { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import {
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Plus,
  AlertCircle,
  Sparkles,
  Info
} from 'lucide-react'
import {
  YoutubeIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  TikTokIcon
} from '@/components/icons/PlatformIcons'
import { supabase } from '@/lib/supabase'

interface SocialAccount {
  id: string
  platform: 'youtube' | 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'test'
  platform_account_id: string
  account_name: string
  username: string | null
  profile_picture_url: string | null
  status: 'connected' | 'needs_reconnect' | 'error'
  access_expires_at: string | null
  last_error: string | null
  updated_at: string
}

export const AccountsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null)
  const [errorNotice, setErrorNotice] = useState<string | null>(null)

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('social_accounts')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching accounts:', error)
      } else {
        setAccounts(data || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connectedPlatform = params.get('connected')
    const errorParam = params.get('error')
    const codeParam = params.get('code')
    const stateParam = params.get('state')

    if (connectedPlatform) {
      setSuccessNotice(`Successfully connected your ${connectedPlatform.toUpperCase()} account!`)
      window.history.replaceState({}, '', window.location.pathname)
    }

    if (errorParam) {
      setErrorNotice(decodeURIComponent(errorParam))
      window.history.replaceState({}, '', window.location.pathname)
    }

    if (codeParam && stateParam) {
      window.history.replaceState({}, '', window.location.pathname)
      setConnectingPlatform('facebook')
      setSuccessNotice('Finalizing account connection with Meta...')

      supabase.functions
        .invoke('oauth-callback', {
          body: {
            code: codeParam,
            state: stateParam,
            redirectUri: window.location.origin + '/accounts',
          },
        })
        .then(({ data, error }) => {
          setConnectingPlatform(null)
          if (error || data?.error) {
            setErrorNotice(error?.message || data?.error || 'Failed to complete connection')
          } else {
            setSuccessNotice(`Successfully connected your ${(data?.platform || 'Meta').toUpperCase()} account!`)
            fetchAccounts()
          }
        })
        .catch((err) => {
          setConnectingPlatform(null)
          setErrorNotice(err?.message || 'Error completing OAuth connection')
        })
    }

    fetchAccounts()
  }, [])

  const platformDefinitions = [
    {
      id: 'youtube',
      name: 'YouTube',
      description: 'Upload standard videos and YouTube Shorts with automated tags & title.',
      icon: YoutubeIcon,
      color: 'text-red-500 bg-red-500/10 border-red-500/20',
      quota: '6 videos / day (Free tier)',
      requiredSecret: 'GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET',
    },
    {
      id: 'facebook',
      name: 'Facebook Pages',
      description: 'Publish updates, photos, and high-resolution videos to Facebook Pages.',
      icon: FacebookIcon,
      color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
      quota: 'Unlimited posts',
      requiredSecret: 'META_APP_ID & META_APP_SECRET',
    },
    {
      id: 'instagram',
      name: 'Instagram',
      description: 'Post Single Photos, Carousels (up to 10), and Instagram Reels.',
      icon: InstagramIcon,
      color: 'text-pink-500 bg-pink-500/10 border-pink-500/20',
      quota: 'Professional / Creator account',
      requiredSecret: 'INSTAGRAM_APP_ID & INSTAGRAM_APP_SECRET',
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      description: 'Direct Post short-form video content straight from cloud storage.',
      icon: TikTokIcon,
      color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
      quota: 'Videos only (Direct Post API)',
      requiredSecret: 'TIKTOK_CLIENT_KEY & TIKTOK_CLIENT_SECRET',
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      description: 'Share text and media updates to personal profiles & company pages.',
      icon: LinkedinIcon,
      color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
      quota: 'Personal & Company Pages',
      requiredSecret: 'LINKEDIN_CLIENT_ID & LINKEDIN_CLIENT_SECRET',
    },
  ]

  const handleConnect = async (platformId: string) => {
    setConnectingPlatform(platformId)
    setErrorNotice(null)

    try {
      const { data, error } = await supabase.functions.invoke('oauth-start', {
        body: {
          platform: platformId,
          returnUrl: window.location.origin + '/accounts',
        },
      })

      if (error || !data?.authUrl) {
        const msg = error?.message || data?.error || 'Could not initiate connection.'
        setErrorNotice(
          `${platformId.toUpperCase()}: ${msg} Make sure secrets are added to Supabase → Edge Functions → Secrets.`
        )
      } else {
        window.location.href = data.authUrl
      }
    } catch (err: any) {
      setErrorNotice(err?.message || 'Failed to start OAuth flow')
    } finally {
      setConnectingPlatform(null)
    }
  }

  // Pre-configured Test Channel for pipeline rehearsal (Task 8)
  const handleConnectTestChannel = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Please sign in first.')
        return
      }

      const { error } = await supabase.from('social_accounts').insert({
        user_id: user.id,
        platform: 'youtube', // using youtube as representative schema
        platform_account_id: 'test_channel_' + Date.now(),
        account_name: 'Test Channel (Rehearsal)',
        username: '@test_channel',
        profile_picture_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80',
        status: 'connected',
      })

      if (error) {
        alert(error.message)
      } else {
        fetchAccounts()
      }
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleDisconnect = async (id: string) => {
    if (!confirm('Are you sure you want to disconnect this account? Stored tokens will be permanently deleted.')) return

    try {
      const { error } = await supabase.from('social_accounts').delete().eq('id', id)
      if (error) throw error
      setAccounts(accounts.filter((a) => a.id !== id))
    } catch (err: any) {
      alert(`Error disconnecting: ${err.message}`)
    }
  }

  return (
    <div>
      <Header title="Social Accounts" subtitle="Manage connected channels, OAuth credentials, and test channels" />

      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        {errorNotice && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3.5 text-amber-200 text-xs">
            <AlertCircle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold text-amber-100">Setup Notice: </span>
              {errorNotice}
            </div>
            <button
              onClick={() => setErrorNotice(null)}
              className="text-amber-400 hover:text-amber-200"
            >
              ✕
            </button>
          </div>
        )}

        {successNotice && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3.5 text-emerald-200 text-xs">
            <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold text-emerald-100">Success: </span>
              {successNotice}
            </div>
            <button
              onClick={() => setSuccessNotice(null)}
              className="text-emerald-400 hover:text-emerald-200"
            >
              ✕
            </button>
          </div>
        )}


        {/* Active Connections */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white">Active Connections</h3>
              <p className="text-xs text-slate-400">Accounts ready for automated publishing</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleConnectTestChannel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Add Test Channel (Rehearsal)</span>
              </button>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300">
                {accounts.length} Connected
              </span>
            </div>
          </div>

          {loading ? (
            <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-400">
              Loading connected channels...
            </div>
          ) : accounts.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
              <p className="text-sm text-slate-400">No accounts connected yet. Connect a platform below or click &quot;Add Test Channel&quot; to rehearse posting.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((acc) => {
                const isConnected = acc.status === 'connected'
                return (
                  <div
                    key={acc.id}
                    className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src={acc.profile_picture_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                          alt={acc.account_name}
                          className="w-11 h-11 rounded-full object-cover border border-slate-700"
                        />
                        <div>
                          <h4 className="text-sm font-semibold text-white leading-tight">{acc.account_name}</h4>
                          <span className="text-xs text-slate-400">{acc.username || acc.platform}</span>
                        </div>
                      </div>

                      {isConnected ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <AlertTriangle className="w-3 h-3" />
                          Reconnect
                        </span>
                      )}
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-400 capitalize">{acc.platform}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDisconnect(acc.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Disconnect account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Supported Platforms Grid */}
        <div>
          <div className="mb-4">
            <h3 className="text-base font-semibold text-white">Available Platforms</h3>
            <p className="text-xs text-slate-400">Click connect to authorize your channels via OAuth 2.0</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {platformDefinitions.map((p) => {
              const Icon = p.icon
              const isConnecting = connectingPlatform === p.id
              return (
                <div
                  key={p.id}
                  className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between hover:border-slate-700/80 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className={`p-3 rounded-2xl border ${p.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-medium text-slate-400 bg-slate-800/60 px-2.5 py-1 rounded-full">
                        {p.quota}
                      </span>
                    </div>

                    <h4 className="text-base font-semibold text-white mt-4">{p.name}</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{p.description}</p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-2">
                    <button
                      onClick={() => handleConnect(p.id)}
                      disabled={isConnecting}
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isConnecting ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      <span>{isConnecting ? 'Opening...' : `Connect ${p.name}`}</span>
                    </button>
                    <div className="text-[10px] text-slate-500 text-center">
                      Requires: {p.requiredSecret}
                    </div>
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
