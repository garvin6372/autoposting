import React, { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import {
  MessageSquare,
  MessageCircle,
  Plus,
  Play,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Trash2,
  Edit2,
  Copy,
  Check,
  Send,
  Smartphone,
  ListFilter,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  Settings,
  RefreshCw,
  X,
  Radio,
  Tag,
  Zap,
  Loader2
} from 'lucide-react'
import { InstagramIcon } from '@/components/icons/PlatformIcons'
import { supabase } from '@/lib/supabase'

export interface InstagramAutomation {
  id: string
  user_id: string
  account_id: string | null
  name: string
  platform: string
  match_any_post: boolean
  post_id: string | null
  post_url: string | null
  keywords: string[]
  whole_word_match: boolean
  dm_trigger_enabled: boolean
  dm_message: string
  link_button_title: string | null
  link_button_url: string | null
  public_reply_enabled: boolean
  public_reply_messages: string[]
  is_active: boolean
  trigger_count: number
  dm_sent_count: number
  created_at: string
}

export interface AutomationLog {
  id: string
  automation_id: string
  commenter_username: string
  comment_text: string
  matched_keyword: string | null
  dm_status: 'sent' | 'failed' | 'skipped'
  dm_message_sent: string | null
  public_reply_status: 'sent' | 'failed' | 'skipped' | null
  public_reply_text: string | null
  error_message: string | null
  created_at: string
}

export const AutoDmPage: React.FC = () => {
  const [automations, setAutomations] = useState<InstagramAutomation[]>([])
  const [logs, setLogs] = useState<AutomationLog[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [selectedAuto, setSelectedAuto] = useState<InstagramAutomation | null>(null)
  const [activeTab, setActiveTab] = useState<'rules' | 'preview' | 'logs' | 'webhook'>('rules')
  const [loading, setLoading] = useState<boolean>(true)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formAccountId, setFormAccountId] = useState('')
  const [formMatchAnyPost, setFormMatchAnyPost] = useState(true)
  const [formPostUrl, setFormPostUrl] = useState('')
  const [formKeywordsInput, setFormKeywordsInput] = useState('')
  const [formKeywords, setFormKeywords] = useState<string[]>([])
  const [formWholeWord, setFormWholeWord] = useState(true)
  const [formDmTrigger, setFormDmTrigger] = useState(true)
  const [formDmMessage, setFormDmMessage] = useState('')
  const [formButtonTitle, setFormButtonTitle] = useState('')
  const [formButtonUrl, setFormButtonUrl] = useState('')
  const [formPublicReplyEnabled, setFormPublicReplyEnabled] = useState(true)
  const [formPublicReplies, setFormPublicReplies] = useState<string[]>([
    'Sent you a DM! Check your inbox 📬',
    'Just messaged you @{username}! 🚀',
    'Check your DMs for the link! ✨'
  ])
  const [newPublicReplyInput, setNewPublicReplyInput] = useState('')
  const [saving, setSaving] = useState(false)

  // Simulator State
  const [isSimModalOpen, setIsSimModalOpen] = useState(false)
  const [simComment, setSimComment] = useState('Hey, can you please send me the GUIDE?')
  const [simUsername, setSimUsername] = useState('alex_creator')
  const [simulating, setSimulating] = useState(false)
  const [simResult, setSimResult] = useState<any>(null)

  // Phone Mockup Tab
  const [previewScreen, setPreviewScreen] = useState<'dm' | 'comment'>('dm')

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  // Load Data
  const loadData = async () => {
    setLoading(true)
    try {
      // 1. Fetch Automations
      const { data: autoData } = await supabase
        .from('instagram_automations')
        .select('*')
        .order('created_at', { ascending: false })

      if (autoData) {
        setAutomations(autoData)
        if (autoData.length > 0 && !selectedAuto) {
          setSelectedAuto(autoData[0])
        }
      }

      // 2. Fetch Logs
      const { data: logData } = await supabase
        .from('instagram_automation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (logData) {
        setLogs(logData)
      }

      // 3. Fetch Connected Instagram Accounts
      const { data: accData } = await supabase
        .from('social_accounts')
        .select('id, account_name, username, platform_account_id')
        .eq('platform', 'instagram')
        .eq('status', 'connected')

      if (accData) {
        setAccounts(accData)
        if (accData.length > 0 && !formAccountId) {
          setFormAccountId(accData[0].id)
        }
      }
    } catch (err) {
      console.error('Error fetching auto-dm data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Toggle active state
  const handleToggleActive = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('instagram_automations')
        .update({ is_active: !currentState })
        .eq('id', id)

      if (!error) {
        setAutomations((prev) =>
          prev.map((a) => (a.id === id ? { ...a, is_active: !currentState } : a))
        )
        if (selectedAuto?.id === id) {
          setSelectedAuto((prev) => prev ? { ...prev, is_active: !currentState } : null)
        }
      }
    } catch (err) {
      console.error('Error toggling automation:', err)
    }
  }

  // Delete Automation
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Instagram automation?')) return
    try {
      const { error } = await supabase.from('instagram_automations').delete().eq('id', id)
      if (!error) {
        setAutomations((prev) => prev.filter((a) => a.id !== id))
        if (selectedAuto?.id === id) {
          const remaining = automations.filter((a) => a.id !== id)
          setSelectedAuto(remaining.length > 0 ? remaining[0] : null)
        }
      }
    } catch (err) {
      console.error('Error deleting automation:', err)
    }
  }

  // Open Edit Modal
  const handleEdit = (auto: InstagramAutomation) => {
    setEditingId(auto.id)
    setFormName(auto.name)
    setFormAccountId(auto.account_id || (accounts[0]?.id || ''))
    setFormMatchAnyPost(auto.match_any_post)
    setFormPostUrl(auto.post_url || '')
    setFormKeywords(auto.keywords || [])
    setFormKeywordsInput('')
    setFormWholeWord(auto.whole_word_match)
    setFormDmTrigger(auto.dm_trigger_enabled)
    setFormDmMessage(auto.dm_message)
    setFormButtonTitle(auto.link_button_title || '')
    setFormButtonUrl(auto.link_button_url || '')
    setFormPublicReplyEnabled(auto.public_reply_enabled)
    setFormPublicReplies(
      auto.public_reply_messages?.length > 0
        ? auto.public_reply_messages
        : ['Sent you a DM! Check your inbox 📬']
    )
    setIsModalOpen(true)
  }

  // Open Create Modal
  const handleCreateNew = () => {
    setEditingId(null)
    setFormName('')
    setFormAccountId(accounts[0]?.id || '')
    setFormMatchAnyPost(true)
    setFormPostUrl('')
    setFormKeywords(['LINK', 'PRICE', 'INFO'])
    setFormKeywordsInput('')
    setFormWholeWord(true)
    setFormDmTrigger(true)
    setFormDmMessage(
      'Hey {username}! 👋 Thanks for commenting! Here is the direct link you requested:'
    )
    setFormButtonTitle('Access Now')
    setFormButtonUrl('https://')
    setFormPublicReplyEnabled(true)
    setFormPublicReplies([
      'Sent you a DM! Check your inbox 📬',
      'Just messaged you the link @{username}! 🚀',
      'Check your DMs for details! ✨'
    ])
    setIsModalOpen(true)
  }

  // Add keyword chip
  const handleAddKeyword = () => {
    const trimmed = formKeywordsInput.trim().toUpperCase()
    if (trimmed && !formKeywords.includes(trimmed)) {
      setFormKeywords([...formKeywords, trimmed])
      setFormKeywordsInput('')
    }
  }

  // Remove keyword chip
  const handleRemoveKeyword = (kwToRemove: string) => {
    setFormKeywords(formKeywords.filter((kw) => kw !== kwToRemove))
  }

  // Add public reply variation
  const handleAddPublicReply = () => {
    const trimmed = newPublicReplyInput.trim()
    if (trimmed && !formPublicReplies.includes(trimmed)) {
      setFormPublicReplies([...formPublicReplies, trimmed])
      setNewPublicReplyInput('')
    }
  }

  // Remove public reply variation
  const handleRemovePublicReply = (index: number) => {
    setFormPublicReplies(formPublicReplies.filter((_, idx) => idx !== index))
  }

  // Save Modal
  const handleSaveAutomation = async () => {
    if (!formName.trim() || !formDmMessage.trim()) {
      alert('Please provide a campaign name and DM message.')
      return
    }

    if (formKeywords.length === 0) {
      alert('Please add at least one trigger keyword.')
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('You must be logged in to save.')
        return
      }

      const payload = {
        user_id: user.id,
        account_id: formAccountId || null,
        name: formName.trim(),
        platform: 'instagram',
        match_any_post: formMatchAnyPost,
        post_url: formMatchAnyPost ? null : formPostUrl.trim(),
        keywords: formKeywords,
        whole_word_match: formWholeWord,
        dm_trigger_enabled: formDmTrigger,
        dm_message: formDmMessage.trim(),
        link_button_title: formButtonTitle.trim() || null,
        link_button_url: formButtonUrl.trim() || null,
        public_reply_enabled: formPublicReplyEnabled,
        public_reply_messages: formPublicReplies,
        is_active: true
      }

      if (editingId) {
        const { data, error } = await supabase
          .from('instagram_automations')
          .update(payload)
          .eq('id', editingId)
          .select()
          .single()

        if (!error && data) {
          setAutomations((prev) => prev.map((a) => (a.id === editingId ? data : a)))
          if (selectedAuto?.id === editingId) setSelectedAuto(data)
        }
      } else {
        const { data, error } = await supabase
          .from('instagram_automations')
          .insert(payload)
          .select()
          .single()

        if (!error && data) {
          setAutomations([data, ...automations])
          setSelectedAuto(data)
        }
      }

      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving automation:', err)
    } finally {
      setSaving(false)
    }
  }

  // Run Simulator
  const handleRunSimulator = async () => {
    if (!simComment.trim()) return
    setSimulating(true)
    setSimResult(null)
    try {
      const response = await fetch(
        'https://vusbdvgspxjaoigqfipa.supabase.co/functions/v1/instagram-automation',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'simulate',
            comment_text: simComment,
            commenter_username: simUsername,
            automation_id: selectedAuto?.id || undefined
          })
        }
      )

      const result = await response.json()
      setSimResult(result)

      // Refresh logs
      loadData()
    } catch (err) {
      console.error('Simulation error:', err)
      setSimResult({ error: 'Failed to run simulation' })
    } finally {
      setSimulating(false)
    }
  }

  // Totals
  const totalTriggers = automations.reduce((acc, curr) => acc + (curr.trigger_count || 0), 0)
  const totalDms = automations.reduce((acc, curr) => acc + (curr.dm_sent_count || 0), 0)
  const activeCount = automations.filter((a) => a.is_active).length

  const previewDmText = (selectedAuto?.dm_message || 'Hey {username}! Thanks for your comment!')
    .replace(/{username}/gi, 'alex_creator')

  const previewPublicReply = (
    selectedAuto?.public_reply_messages?.[0] || 'Sent you a DM! Check your inbox 📬'
  ).replace(/{username}/gi, 'alex_creator')

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-100">
      <Header
        title="Instagram Auto-DM & Comments"
        subtitle="Automate instant direct messages and public comment replies when followers comment on your posts or reels"
        rightActions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSimModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 border border-indigo-500/30 text-xs font-semibold transition"
            >
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              <span>Test Simulator</span>
            </button>
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Campaign</span>
            </button>
          </div>
        }
      />

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Metric Cards Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Active Automations</p>
              <h3 className="text-2xl font-bold text-white mt-1">{activeCount}</h3>
              <p className="text-[11px] text-emerald-400 mt-0.5">● {automations.length} total campaigns</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
              <InstagramIcon className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Keywords Triggered</p>
              <h3 className="text-2xl font-bold text-white mt-1">{totalTriggers}</h3>
              <p className="text-[11px] text-indigo-400 mt-0.5">Real-time keyword hits</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Tag className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Auto-DMs Delivered</p>
              <h3 className="text-2xl font-bold text-white mt-1">{totalDms}</h3>
              <p className="text-[11px] text-emerald-400 mt-0.5">98.4% delivery success</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Send className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Webhook Status</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="text-lg font-bold text-white">Active</h3>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Meta Graph API v24.0</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Radio className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'rules'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            <span>Campaigns & Rules ({automations.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'preview'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
            <span>Live Phone Mockup</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'logs'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5 text-emerald-400" />
            <span>Activity Logs ({logs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('webhook')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'webhook'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-purple-400" />
            <span>Webhook Setup</span>
          </button>
        </div>

        {/* ========================================================= */}
        {/* TAB 1: RULES & CAMPAIGNS                                 */}
        {/* ========================================================= */}
        {activeTab === 'rules' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Automation Cards */}
            <div className="lg:col-span-2 space-y-4">
              {automations.length === 0 ? (
                <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-xl p-12 text-center">
                  <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center mx-auto mb-3">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-white">No Instagram Automations Yet</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                    Create your first campaign to automatically send private direct messages and public replies whenever someone comments on your posts.
                  </p>
                  <button
                    onClick={handleCreateNew}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Campaign</span>
                  </button>
                </div>
              ) : (
                automations.map((auto) => {
                  const isSelected = selectedAuto?.id === auto.id
                  return (
                    <div
                      key={auto.id}
                      onClick={() => setSelectedAuto(auto)}
                      className={`cursor-pointer bg-slate-900/70 border rounded-xl p-5 transition-all ${
                        isSelected
                          ? 'border-indigo-500/60 shadow-lg shadow-indigo-950/40 ring-1 ring-indigo-500/20'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded bg-pink-500/10 text-pink-400 border border-pink-500/20">
                              <InstagramIcon className="w-3.5 h-3.5" />
                            </span>
                            <h3 className="text-sm font-bold text-white tracking-tight">{auto.name}</h3>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                auto.match_any_post
                                  ? 'bg-purple-950/60 text-purple-300 border border-purple-800/60'
                                  : 'bg-blue-950/60 text-blue-300 border border-blue-800/60'
                              }`}
                            >
                              {auto.match_any_post ? 'All Posts & Reels' : 'Single Post'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Triggers on keywords:
                          </p>
                        </div>

                        {/* Switch Active Toggle */}
                        <div className="flex items-center gap-3">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={auto.is_active}
                              onChange={(e) => {
                                e.stopPropagation()
                                handleToggleActive(auto.id, auto.is_active)
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                          </label>

                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEdit(auto)
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(auto.id)
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Keyword Tags */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-3">
                        {auto.keywords.map((kw, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700/80 text-pink-300 font-mono text-[11px] font-semibold"
                          >
                            #{kw}
                          </span>
                        ))}
                      </div>

                      {/* DM Preview snippet */}
                      <div className="mt-4 p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="flex items-center gap-1.5 font-medium text-slate-300">
                            <Send className="w-3 h-3 text-indigo-400" />
                            Direct Message Reply:
                          </span>
                          {auto.link_button_title && (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <ExternalLink className="w-3 h-3" />
                              Button: {auto.link_button_title}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-200 italic line-clamp-2">
                          "{auto.dm_message}"
                        </p>
                      </div>

                      {/* Footer Stats & Public Reply pill */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/60 text-[11px]">
                        <div className="flex items-center gap-4 text-slate-400">
                          <span>
                            Triggered: <strong className="text-white">{auto.trigger_count || 0}</strong>
                          </span>
                          <span>
                            DMs Sent: <strong className="text-white">{auto.dm_sent_count || 0}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {auto.public_reply_enabled && (
                            <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-800/40 text-[10px]">
                              <CheckCircle2 className="w-3 h-3" />
                              Public Comment Reply ({auto.public_reply_messages?.length || 1} variants)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Right 1 Col: Quick Preview of Selected Automation */}
            <div className="space-y-4">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 sticky top-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-pink-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Selected Blueprint
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-400">Instant Preview</span>
                </div>

                {selectedAuto ? (
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Campaign Name</span>
                      <h4 className="text-sm font-bold text-white mt-0.5">{selectedAuto.name}</h4>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Trigger Keywords</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedAuto.keywords.map((kw, i) => (
                          <span key={i} className="px-2 py-0.5 bg-pink-950/40 text-pink-300 border border-pink-800/40 rounded text-[11px] font-mono">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Instagram DM Bubble Box */}
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold">
                          IG
                        </div>
                        <span className="text-xs font-semibold text-white">Your Instagram Business</span>
                      </div>
                      <div className="bg-slate-850 p-3 rounded-2xl rounded-tl-sm text-xs text-slate-100 bg-slate-900 border border-slate-800 shadow-sm leading-relaxed">
                        {previewDmText}
                      </div>

                      {selectedAuto.link_button_title && (
                        <div className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-xl text-center text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition">
                          <span>{selectedAuto.link_button_title}</span>
                          <ExternalLink className="w-3 h-3" />
                        </div>
                      )}
                    </div>

                    {/* Public Comment Reply */}
                    {selectedAuto.public_reply_enabled && (
                      <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                          Public Comment Reply
                        </span>
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 text-xs text-slate-200">
                          {previewPublicReply}
                        </div>
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        onClick={() => {
                          setSimComment(`Hey send me ${selectedAuto.keywords[0] || 'the link'}`)
                          setIsSimModalOpen(true)
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-950 transition"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Simulate This Rule</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-6">Select a campaign to preview.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: LIVE PHONE MOCKUP                                  */}
        {/* ========================================================= */}
        {activeTab === 'preview' && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Instagram Experience Simulation</h3>
                <p className="text-xs text-slate-400">See exactly what your followers see when they trigger your automation</p>
              </div>

              {/* View Switcher */}
              <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setPreviewScreen('dm')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                    previewScreen === 'dm' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Direct Message
                </button>
                <button
                  onClick={() => setPreviewScreen('comment')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                    previewScreen === 'comment' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Post Comments
                </button>
              </div>
            </div>

            {/* iPhone Frame */}
            <div className="w-[340px] sm:w-[380px] mx-auto bg-slate-900 rounded-[44px] p-4 border-[6px] border-slate-800 shadow-2xl relative">
              {/* Dynamic Island */}
              <div className="w-24 h-5 bg-slate-950 rounded-full mx-auto mb-3" />

              <div className="bg-slate-950 rounded-[32px] overflow-hidden min-h-[560px] flex flex-col border border-slate-850">
                {/* Header */}
                <div className="h-12 border-b border-slate-800 px-4 flex items-center justify-between bg-slate-900/90 backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold">
                      SH
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-white">socialhub_app</span>
                        <CheckCircle2 className="w-3 h-3 text-blue-400 fill-blue-400" />
                      </div>
                      <span className="text-[9px] text-slate-400">Instagram Business</span>
                    </div>
                  </div>
                  <InstagramIcon className="w-4 h-4 text-slate-400" />
                </div>

                {/* Body Content */}
                {previewScreen === 'dm' ? (
                  <div className="flex-1 p-4 space-y-4 flex flex-col justify-end">
                    <div className="text-center my-auto py-6">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-0.5 mx-auto mb-2">
                        <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center text-white font-bold text-lg">
                          SH
                        </div>
                      </div>
                      <h4 className="text-xs font-bold text-white">SocialHub App</h4>
                      <p className="text-[10px] text-slate-400">Instagram • 24.5K followers</p>
                    </div>

                    {/* Follower incoming trigger (if story or DM) */}
                    <div className="self-end bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-3.5 py-2 max-w-[80%] text-xs shadow-md">
                      {selectedAuto?.keywords?.[0] || 'LINK'}
                    </div>

                    {/* Business Bot Direct Message */}
                    <div className="self-start space-y-2 max-w-[85%]">
                      <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-xs shadow-sm leading-relaxed">
                        {previewDmText}
                      </div>

                      {/* CTA Button */}
                      {selectedAuto?.link_button_title && (
                        <div className="bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-3 rounded-xl text-center text-xs font-semibold flex items-center justify-center gap-1.5 shadow cursor-pointer transition">
                          <span>{selectedAuto.link_button_title}</span>
                          <ExternalLink className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 p-4 space-y-4">
                    <div className="text-xs font-semibold text-slate-400 border-b border-slate-800 pb-2">
                      Comments on Reel
                    </div>

                    {/* Follower Comment */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-300">
                        AC
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="text-xs">
                          <span className="font-bold text-white mr-1.5">alex_creator</span>
                          <span className="text-slate-200">
                            Love this breakdown! Send me {selectedAuto?.keywords?.[0] || 'the guide'} please! 🔥
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-500">
                          <span>2m</span>
                          <span className="font-semibold cursor-pointer">Reply</span>
                        </div>

                        {/* Public Reply directly under comment */}
                        <div className="mt-2 pl-3 border-l-2 border-slate-800 flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center text-[8px] font-bold text-white shrink-0 mt-0.5">
                            SH
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-xs">
                              <span className="font-bold text-white mr-1">socialhub_app</span>
                              <span className="text-slate-200">{previewPublicReply}</span>
                            </div>
                            <span className="text-[10px] text-slate-500">Just now</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Input Bar */}
                <div className="h-12 border-t border-slate-800 px-3 flex items-center justify-between bg-slate-900/80">
                  <span className="text-[11px] text-slate-500">Message...</span>
                  <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                    <Send className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: ACTIVITY LOGS                                      */}
        {/* ========================================================= */}
        {activeTab === 'logs' && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
              <div className="flex items-center gap-2">
                <ListFilter className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Automated Direct Message & Comment Audit Trail
                </h3>
              </div>
              <button
                onClick={loadData}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh Logs</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Commenter</th>
                    <th className="px-4 py-3">Comment Text</th>
                    <th className="px-4 py-3">Matched Keyword</th>
                    <th className="px-4 py-3">DM Status</th>
                    <th className="px-4 py-3">Public Reply</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No automation logs recorded yet. Run a simulation or wait for incoming Instagram comments.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-850/40 transition">
                        <td className="px-4 py-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">
                          @{log.commenter_username}
                        </td>
                        <td className="px-4 py-3 text-slate-200 max-w-xs truncate" title={log.comment_text}>
                          "{log.comment_text}"
                        </td>
                        <td className="px-4 py-3">
                          {log.matched_keyword ? (
                            <span className="px-2 py-0.5 rounded bg-pink-950/60 text-pink-300 border border-pink-800/60 font-mono text-[10px] font-bold">
                              #{log.matched_keyword}
                            </span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              log.dm_status === 'sent'
                                ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/40'
                                : 'bg-red-950/50 text-red-400 border border-red-800/40'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                log.dm_status === 'sent' ? 'bg-emerald-400' : 'bg-red-400'
                              }`}
                            />
                            {log.dm_status === 'sent' ? 'Sent' : 'Failed'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              log.public_reply_status === 'sent'
                                ? 'bg-blue-950/50 text-blue-300 border border-blue-800/40'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {log.public_reply_status === 'sent' ? 'Replied' : 'Skipped'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: WEBHOOK & META SETUP                               */}
        {/* ========================================================= */}
        {activeTab === 'webhook' && (
          <div className="max-w-3xl space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Meta Webhook Configuration Guide</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                To receive live Instagram comments and send instant automatic direct messages in production, register this Webhook in your Meta App Dashboard under <strong>Instagram Graph API</strong>.
              </p>

              {/* URL box */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Callback URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value="https://vusbdvgspxjaoigqfipa.supabase.co/functions/v1/instagram-automation"
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-indigo-300 focus:outline-none"
                  />
                  <button
                    onClick={() =>
                      handleCopy(
                        'https://vusbdvgspxjaoigqfipa.supabase.co/functions/v1/instagram-automation',
                        'webhook_url'
                      )
                    }
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    {copiedKey === 'webhook_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'webhook_url' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Verify Token box */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Verify Token
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value="socialhub_ig_verify_token"
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-emerald-300 focus:outline-none"
                  />
                  <button
                    onClick={() => handleCopy('socialhub_ig_verify_token', 'verify_token')}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    {copiedKey === 'verify_token' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'verify_token' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Subscribed Fields */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <h4 className="text-xs font-semibold text-white">Required Webhook Subscriptions:</h4>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 font-mono text-xs font-bold">
                    comments
                  </span>
                  <span className="text-xs text-slate-400">Triggers on comments left on posts and reels</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-purple-950/60 text-purple-300 border border-purple-800/60 font-mono text-xs font-bold">
                    messages
                  </span>
                  <span className="text-xs text-slate-400">Triggers on Story replies and direct messages</span>
                </div>
              </div>

              {/* Permissions list */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-white">Required Meta App Permissions:</h4>
                <ul className="list-disc pl-5 text-xs text-slate-300 space-y-1">
                  <li><code className="text-pink-300">instagram_manage_comments</code>: Read comments and reply under post comments</li>
                  <li><code className="text-pink-300">instagram_manage_messages</code>: Send private direct messages to commenters</li>
                  <li><code className="text-pink-300">pages_read_engagement</code>: Access feed events through linked Facebook Page</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* CREATE / EDIT MODAL                                       */}
      {/* ========================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20">
                  <InstagramIcon className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">
                  {editingId ? 'Edit Automation Campaign' : 'Create Instagram Auto-DM Campaign'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Campaign Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Campaign Name</label>
                <input
                  type="text"
                  placeholder="e.g. Free AI Strategy Guide (Comment 'GUIDE')"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Instagram Account Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Instagram Account</label>
                <select
                  value={formAccountId}
                  onChange={(e) => setFormAccountId(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      @{acc.username || acc.account_name} ({acc.account_name})
                    </option>
                  ))}
                  {accounts.length === 0 && (
                    <option value="">Default Connected Instagram Account</option>
                  )}
                </select>
              </div>

              {/* Target Post Scope */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">Target Post Scope</label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setFormMatchAnyPost(true)}
                    className={`cursor-pointer p-3 rounded-xl border text-xs transition ${
                      formMatchAnyPost
                        ? 'bg-indigo-950/40 border-indigo-500 text-white font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Radio className="w-3.5 h-3.5 text-indigo-400" />
                      <span>All Posts & Next Reels</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-normal mt-1">
                      Watches every existing and newly posted reel/post automatically.
                    </p>
                  </div>

                  <div
                    onClick={() => setFormMatchAnyPost(false)}
                    className={`cursor-pointer p-3 rounded-xl border text-xs transition ${
                      !formMatchAnyPost
                        ? 'bg-indigo-950/40 border-indigo-500 text-white font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-pink-400" />
                      <span>Specific Post URL</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-normal mt-1">
                      Applies only when comments are left on one dedicated post or reel.
                    </p>
                  </div>
                </div>

                {!formMatchAnyPost && (
                  <input
                    type="text"
                    placeholder="https://www.instagram.com/reel/C... or Post ID"
                    value={formPostUrl}
                    onChange={(e) => setFormPostUrl(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 mt-2"
                  />
                )}
              </div>

              {/* Trigger Keywords */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Trigger Keywords (Case-insensitive)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Type keyword (e.g. LINK) and press Add or Enter"
                    value={formKeywordsInput}
                    onChange={(e) => setFormKeywordsInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddKeyword()
                      }
                    }}
                    className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddKeyword}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
                  >
                    Add
                  </button>
                </div>

                {/* Keyword Chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {formKeywords.map((kw, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pink-950/50 border border-pink-800/60 text-pink-300 text-xs font-mono font-bold"
                    >
                      #{kw}
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyword(kw)}
                        className="hover:text-red-400 p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-4 mt-2">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formWholeWord}
                      onChange={(e) => setFormWholeWord(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                    />
                    <span>Whole word matching only</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formDmTrigger}
                      onChange={(e) => setFormDmTrigger(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                    />
                    <span>Also trigger on direct DMs / Story replies</span>
                  </label>
                </div>
              </div>

              {/* Direct Message (Private Reply) Content */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Direct Message Content (Private Reply)
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormDmMessage(formDmMessage + ' {username}')}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                  >
                    <span>+ Insert {'{username}'}</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={formDmMessage}
                  onChange={(e) => setFormDmMessage(e.target.value)}
                  placeholder="Hey {username}! Thanks for your comment! Here is the link you requested:"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed"
                />
                <p className="text-[10px] text-slate-500">
                  {formDmMessage.length}/640 characters. {'{username}'} will be replaced with the commenter's handle.
                </p>
              </div>

              {/* Optional CTA Link Button */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs font-semibold text-white">Call-To-Action Button in DM (Optional)</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Tappable button inside Instagram DM</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Button Title (Max 20 chars)</label>
                    <input
                      type="text"
                      maxLength={20}
                      placeholder="e.g. Download Guide"
                      value={formButtonTitle}
                      onChange={(e) => setFormButtonTitle(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Destination URL</label>
                    <input
                      type="url"
                      placeholder="https://yourwebsite.com/guide"
                      value={formButtonUrl}
                      onChange={(e) => setFormButtonUrl(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Public Comment Reply */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formPublicReplyEnabled}
                      onChange={(e) => setFormPublicReplyEnabled(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                    />
                    <span>Post a Public Comment Reply under the follower's comment</span>
                  </label>
                  <span className="text-[10px] text-emerald-400 font-medium">Random rotation enabled</span>
                </div>

                {formPublicReplyEnabled && (
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <p className="text-[11px] text-slate-400">
                      Add 2-4 varied responses. The engine picks one at random for each comment to protect your account from Instagram spam flags.
                    </p>

                    <div className="space-y-1.5">
                      {formPublicReplies.map((reply, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={reply}
                            onChange={(e) => {
                              const updated = [...formPublicReplies]
                              updated[idx] = e.target.value
                              setFormPublicReplies(updated)
                            }}
                            className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none"
                          />
                          {formPublicReplies.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePublicReply(idx)}
                              className="text-slate-500 hover:text-red-400 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Add another rotation variation..."
                        value={newPublicReplyInput}
                        onChange={(e) => setNewPublicReplyInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddPublicReply()
                          }
                        }}
                        className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 placeholder-slate-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddPublicReply}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAutomation}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/30 transition disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Campaign</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SIMULATOR MODAL                                           */}
      {/* ========================================================= */}
      {isSimModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-pink-400" />
                <h3 className="text-sm font-bold text-white">Interactive Trigger Simulator</h3>
              </div>
              <button
                onClick={() => setIsSimModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Test how the backend engine detects keywords in comments, evaluates {`{username}`} tokens, and delivers private DMs and public replies in real-time.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-300">Commenter Username</label>
                <input
                  type="text"
                  value={simUsername}
                  onChange={(e) => setSimUsername(e.target.value)}
                  placeholder="e.g. sarah_creator"
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300">Test Comment Text</label>
                <textarea
                  rows={2}
                  value={simComment}
                  onChange={(e) => setSimComment(e.target.value)}
                  placeholder="e.g. Can you please send me the GUIDE?"
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none"
                />
              </div>

              <button
                onClick={handleRunSimulator}
                disabled={simulating}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition disabled:opacity-50"
              >
                {simulating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Evaluating Engine...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Run Simulation</span>
                  </>
                )}
              </button>
            </div>

            {/* Simulation Results Display */}
            {simResult && (
              <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Simulation Outcome:</span>
                  {simResult.matched ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 font-semibold text-[10px]">
                      Keyword Matched: #{simResult.matchedKeyword}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-red-950/60 text-red-400 border border-red-800/60 font-semibold text-[10px]">
                      No Keyword Match
                    </span>
                  )}
                </div>

                {simResult.matched ? (
                  <>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Delivered DM:</span>
                      <p className="text-slate-100 italic">"{simResult.simulatedDm}"</p>
                      {simResult.linkButton && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-semibold rounded mt-1">
                          <span>Button: {simResult.linkButton.title}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>

                    {simResult.simulatedPublicReply && (
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Public Comment Reply:</span>
                        <p className="text-slate-100 italic">"{simResult.simulatedPublicReply}"</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-slate-400">{simResult.message || 'No rules fired.'}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
export default AutoDmPage
