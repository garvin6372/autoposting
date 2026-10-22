import React, { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import {
  Bot,
  Plus,
  CheckCircle2,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Play,
  RotateCcw,
  Trash2,
  Sparkles,
  Maximize2,
  Minimize2,
  AlertCircle,
  Film,
  Image as ImageIcon,
  ArrowRight,
  Terminal,
  ShieldCheck,
  Loader2,
  X
} from 'lucide-react'
import {
  YoutubeIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  TikTokIcon
} from '@/components/icons/PlatformIcons'
import { supabase } from '@/lib/supabase'

export interface AgentTask {
  id: string
  title: string
  platform: string
  status: 'todo' | 'in_progress' | 'done'
  target_date: string
  media_type: 'none' | 'image' | 'video'
  media_prompt: string | null
  media_tool_url: string | null
  post_content: string | null
  target_url: string | null
  instructions: string | null
  completed_at: string | null
  created_at: string
}

export const AgentTasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [isVisionMode, setIsVisionMode] = useState<boolean>(false)

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Form State
  const [formTitle, setFormTitle] = useState('')
  const [formPlatform, setFormPlatform] = useState('instagram')
  const [formTargetDate, setFormTargetDate] = useState(
    new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 16)
  )
  const [formMediaType, setFormMediaType] = useState<'none' | 'image' | 'video'>('image')
  const [formMediaPrompt, setFormMediaPrompt] = useState('')
  const [formMediaToolUrl, setFormMediaToolUrl] = useState('https://ideogram.ai')
  const [formPostContent, setFormPostContent] = useState('')
  const [formTargetUrl, setFormTargetUrl] = useState('https://www.instagram.com')
  const [formInstructions, setFormInstructions] = useState('')

  // Copied states
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Fetch tasks
  const fetchTasks = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('agent_tasks')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && data) {
        setTasks(data as AgentTask[])
      }
    } catch (err) {
      console.error('Error fetching agent tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  // Update Status
  const handleUpdateStatus = async (taskId: string, newStatus: 'todo' | 'in_progress' | 'done') => {
    try {
      const updates: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      }
      if (newStatus === 'done') {
        updates.completed_at = new Date().toISOString()
      } else {
        updates.completed_at = null
      }

      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
      )

      await supabase.from('agent_tasks').update(updates).eq('id', taskId)
    } catch (err) {
      console.error('Status update failed:', err)
      fetchTasks()
    }
  }

  // Delete Task
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this agent task?')) return
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    await supabase.from('agent_tasks').delete().eq('id', taskId)
  }

  // Create Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle.trim()) return

    setIsSaving(true)
    try {
      const newTask = {
        title: formTitle,
        platform: formPlatform,
        status: 'todo',
        target_date: formTargetDate ? new Date(formTargetDate).toISOString() : new Date().toISOString(),
        media_type: formMediaType,
        media_prompt: formMediaType !== 'none' ? formMediaPrompt : null,
        media_tool_url: formMediaType !== 'none' ? formMediaToolUrl : null,
        post_content: formPostContent,
        target_url: formTargetUrl,
        instructions: formInstructions,
      }

      const { data, error } = await supabase
        .from('agent_tasks')
        .insert(newTask)
        .select('*')
        .single()

      if (error) throw error

      if (data) {
        setTasks((prev) => [data as AgentTask, ...prev])
      }

      // Reset form
      setFormTitle('')
      setFormPostContent('')
      setFormMediaPrompt('')
      setFormInstructions('')
      setShowCreateModal(false)
    } catch (err: any) {
      alert(`Error creating task: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const getPlatformIcon = (plt: string) => {
    switch (plt.toLowerCase()) {
      case 'youtube':
        return <YoutubeIcon className="w-4 h-4 text-red-500" />
      case 'facebook':
        return <FacebookIcon className="w-4 h-4 text-blue-500" />
      case 'instagram':
        return <InstagramIcon className="w-4 h-4 text-pink-500" />
      case 'tiktok':
        return <TikTokIcon className="w-4 h-4 text-cyan-400" />
      case 'linkedin':
        return <LinkedinIcon className="w-4 h-4 text-blue-400" />
      default:
        return <Bot className="w-4 h-4 text-indigo-400" />
    }
  }

  const filteredTasks = tasks.filter((t) => {
    if (filterStatus === 'all') return true
    return t.status === filterStatus
  })

  const todoCount = tasks.filter((t) => t.status === 'todo').length
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length
  const doneCount = tasks.filter((t) => t.status === 'done').length

  return (
    <div className={isVisionMode ? 'bg-black text-white min-h-screen p-6' : ''}>
      {!isVisionMode && (
        <Header
          title="Agent Mission Control"
          subtitle="Screen-guided action blueprints for Claude, Codex, and Autonomous Browser Agents"
        />
      )}

      <div className={`max-w-7xl mx-auto space-y-6 ${!isVisionMode ? 'p-8' : ''}`}>
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          {/* Agent Status Filter Tabs */}
          <div className="flex flex-wrap gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterStatus === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Tasks ({tasks.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('todo')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterStatus === 'todo'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Pending ({todoCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('in_progress')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterStatus === 'in_progress'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              In Progress ({inProgressCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('done')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterStatus === 'done'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Completed ({doneCount})
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Vision Mode Toggle for Claude / Screen Agents */}
            <button
              type="button"
              onClick={() => setIsVisionMode(!isVisionMode)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isVisionMode
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
              title="Optimizes display for AI vision models & Claude screen reading"
            >
              {isVisionMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span>{isVisionMode ? 'Standard View' : 'Vision Screen Mode'}</span>
            </button>

            {/* Create Task Button */}
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Agent Task</span>
            </button>
          </div>
        </div>

        {/* AI Agent Direct Banner Protocol */}
        <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-900/50 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 shrink-0">
              <Bot className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="font-bold text-white uppercase tracking-wider block text-[11px]">
                Autonomous Screen Protocol:
              </span>
              <p className="text-slate-300 mt-0.5">
                AI agents reading this screen should pick the top <strong>PENDING</strong> task, follow the numbered action steps in order, and click the <strong>&quot;Mark as Done&quot;</strong> button upon verification.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-block font-mono text-[10px] text-indigo-400 px-2 py-1 rounded bg-indigo-900/40 border border-indigo-700/40 shrink-0">
            AGENT_ID: ACTIVE_PAIR
          </span>
        </div>

        {/* Tasks List */}
        {loading ? (
          <div className="p-16 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            <span className="text-xs">Loading agent task queue...</span>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-16 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center space-y-3">
            <Bot className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-white">No tasks found for this view</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Create an action blueprint with generation prompts and platform steps for your AI agent to execute.
            </p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Task</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredTasks.map((task, idx) => {
              const isDone = task.status === 'done'
              const isInProgress = task.status === 'in_progress'

              return (
                <div
                  key={task.id}
                  className={`rounded-2xl border transition-all overflow-hidden ${
                    isDone
                      ? 'bg-slate-950/40 border-slate-800/60 opacity-75'
                      : isInProgress
                      ? 'bg-slate-900/80 border-blue-500/50 shadow-lg shadow-blue-500/5'
                      : 'bg-slate-900/70 border-slate-800/90 hover:border-slate-700'
                  }`}
                >
                  {/* Task Header */}
                  <div className="p-5 border-b border-slate-800/70 flex flex-wrap items-center justify-between gap-4 bg-slate-900/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                        {getPlatformIcon(task.platform)}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3
                            className={`text-sm font-bold ${
                              isDone ? 'line-through text-slate-400' : 'text-white'
                            }`}
                          >
                            {idx + 1}. {task.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                          <span className="capitalize font-semibold text-slate-300">
                            {task.platform}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            {new Date(task.target_date).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Pill & Action Buttons */}
                    <div className="flex items-center gap-2">
                      {isDone ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>COMPLETED</span>
                        </span>
                      ) : isInProgress ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-semibold animate-pulse">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>AGENT IN PROGRESS</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                          <Clock className="w-3.5 h-3.5" />
                          <span>PENDING (TODO)</span>
                        </span>
                      )}

                      {/* State Toggles */}
                      {!isDone && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(task.id, 'done')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>MARK AS DONE</span>
                        </button>
                      )}

                      {!isDone && !isInProgress && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(task.id, 'in_progress')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 text-blue-400" />
                          <span>Start</span>
                        </button>
                      )}

                      {isDone && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(task.id, 'todo')}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs transition-colors"
                          title="Reopen task"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reopen</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Task Instructions Body (One Screen Directive) */}
                  <div className="p-6 space-y-5">
                    {/* Step 1: Open Target Website */}
                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 font-bold flex items-center justify-center text-xs shrink-0">
                          1
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white block">
                            OPEN TARGET WEBSITE / APPLICATION:
                          </span>
                          <span className="font-mono text-xs text-indigo-300">
                            {task.target_url || 'https://www.instagram.com'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copyText(task.target_url || '', `url-${task.id}`)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                        >
                          {copiedId === `url-${task.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedId === `url-${task.id}` ? 'Copied' : 'Copy URL'}</span>
                        </button>
                        <a
                          href={task.target_url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm"
                        >
                          <span>Open Website</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    {/* Step 2 (Optional): AI Media Generation Instruction */}
                    {task.media_type !== 'none' && (
                      <div className="p-4 rounded-xl bg-slate-950/70 border border-indigo-950/80 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-purple-600/20 text-purple-400 font-bold flex items-center justify-center text-xs shrink-0">
                              2
                            </div>
                            <div>
                              <span className="text-xs font-bold text-purple-300 block uppercase">
                                GENERATE {task.media_type.toUpperCase()} USING AI:
                              </span>
                              <span className="text-xs text-slate-400">
                                Generator Tool: <code className="text-purple-300">{task.media_tool_url}</code>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {task.media_tool_url && (
                              <a
                                href={task.media_tool_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 text-xs font-semibold"
                              >
                                <span>Open Generator</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Prompt Box */}
                        {task.media_prompt && (
                          <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-slate-400 uppercase font-semibold">
                              <span>Prompt for AI Generator:</span>
                              <button
                                type="button"
                                onClick={() => copyText(task.media_prompt || '', `prompt-${task.id}`)}
                                className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 font-semibold"
                              >
                                {copiedId === `prompt-${task.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                <span>{copiedId === `prompt-${task.id}` ? 'Prompt Copied' : 'Copy Prompt'}</span>
                              </button>
                            </div>
                            <p className="font-mono text-slate-100 select-all leading-relaxed">
                              {task.media_prompt}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Step 3: Content / Caption to Post */}
                    {task.post_content && (
                      <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-emerald-600/20 text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0">
                              3
                            </div>
                            <span className="text-xs font-bold text-white uppercase">
                              POST CAPTION & HASHTAGS (COPY & PASTE INTO POST):
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => copyText(task.post_content || '', `caption-${task.id}`)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 text-xs font-semibold"
                          >
                            {copiedId === `caption-${task.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedId === `caption-${task.id}` ? 'Caption Copied' : 'Copy Caption'}</span>
                          </button>
                        </div>

                        <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-sans text-slate-100 whitespace-pre-wrap leading-relaxed select-all">
                          {task.post_content}
                        </div>
                      </div>
                    )}

                    {/* Step 4: Step-by-Step Instructions & Completion Directive */}
                    <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs space-y-2">
                      <div className="flex items-center gap-2 text-indigo-400 font-bold uppercase text-[11px]">
                        <Terminal className="w-3.5 h-3.5" />
                        <span>AGENT DIRECTIVE & COMPLETION CHECKLIST:</span>
                      </div>
                      <div className="text-slate-300 whitespace-pre-wrap leading-relaxed pl-5 font-mono text-[11px]">
                        {task.instructions ||
                          `1. Click "Open Website" to access ${task.platform}.
2. Click Create / New Post button.
3. Attach generated media.
4. Paste the caption text.
5. Click Publish / Share.
6. Verify live post on screen, then return here and click [MARK AS DONE].`}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* CREATE NEW AGENT TASK MODAL                                         */}
      {/* ==================================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Create New Agent Task</h3>
                  <p className="text-xs text-slate-400">
                    Define an action blueprint with generation prompts for your AI agents
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Task Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Publish Daily AI Cyberpunk Reel on Instagram"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Platform</label>
                  <select
                    value={formPlatform}
                    onChange={(e) => {
                      setFormPlatform(e.target.value)
                      if (e.target.value === 'instagram') setFormTargetUrl('https://www.instagram.com')
                      else if (e.target.value === 'tiktok') setFormTargetUrl('https://www.tiktok.com/upload')
                      else if (e.target.value === 'facebook') setFormTargetUrl('https://www.facebook.com')
                      else if (e.target.value === 'youtube') setFormTargetUrl('https://studio.youtube.com')
                      else if (e.target.value === 'linkedin') setFormTargetUrl('https://www.linkedin.com/feed')
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 capitalize"
                  >
                    <option value="instagram">Instagram</option>
                    <option value="tiktok">TikTok</option>
                    <option value="facebook">Facebook</option>
                    <option value="youtube">YouTube</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="general">Custom Web App</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Target Date & Time</label>
                  <input
                    type="datetime-local"
                    value={formTargetDate}
                    onChange={(e) => setFormTargetDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Target Website / App URL</label>
                <input
                  type="url"
                  value={formTargetUrl}
                  onChange={(e) => setFormTargetUrl(e.target.value)}
                  placeholder="https://www.instagram.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Media Generation Requirements */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Media Generation Step</span>
                  <div className="flex rounded-lg bg-slate-900 p-1 border border-slate-800">
                    {(['none', 'image', 'video'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setFormMediaType(m)
                          if (m === 'image') setFormMediaToolUrl('https://ideogram.ai')
                          if (m === 'video') setFormMediaToolUrl('https://klingai.com')
                        }}
                        className={`px-3 py-1 rounded text-xs font-semibold capitalize transition-all ${
                          formMediaType === m ? 'bg-indigo-600 text-white' : 'text-slate-400'
                        }`}
                      >
                        {m === 'none' ? 'No Media' : m}
                      </button>
                    ))}
                  </div>
                </div>

                {formMediaType !== 'none' && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-slate-400 mb-1">AI Generator Tool URL</label>
                      <input
                        type="url"
                        value={formMediaToolUrl}
                        onChange={(e) => setFormMediaToolUrl(e.target.value)}
                        placeholder="https://ideogram.ai or https://midjourney.com"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Generation Prompt for AI</label>
                      <textarea
                        rows={3}
                        value={formMediaPrompt}
                        onChange={(e) => setFormMediaPrompt(e.target.value)}
                        placeholder="e.g. Futuristic holographic brain glowing with neon circuits, 8k cinematic..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-100 placeholder-slate-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Caption to Post */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Post Caption & Text</label>
                <textarea
                  rows={3}
                  value={formPostContent}
                  onChange={(e) => setFormPostContent(e.target.value)}
                  placeholder="Paste the caption and hashtags the agent will copy and paste into the post..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 placeholder-slate-500"
                />
              </div>

              {/* Custom Directives */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Custom Step-by-Step Directives (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formInstructions}
                  onChange={(e) => setFormInstructions(e.target.value)}
                  placeholder="e.g. Make sure to select Reel instead of Story, then click Share and return here."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 placeholder-slate-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-md flex items-center gap-2"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Task</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
