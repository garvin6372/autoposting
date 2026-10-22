import React, { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import {
  Upload,
  Calendar,
  Send,
  X,
  AlertCircle,
  Film,
  Loader2,
  Check,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Heart,
  Share2,
  Bookmark,
  MessageCircle,
  Hash
} from 'lucide-react'
import {
  YoutubeIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  TikTokIcon
} from '@/components/icons/PlatformIcons'
import { uploadMediaFile, type UploadedMediaRecord } from '@/lib/mediaUpload'
import { supabase } from '@/lib/supabase'
import { Link } from 'react-router-dom'

interface ConnectedAccount {
  id: string
  platform: 'youtube' | 'facebook' | 'instagram' | 'tiktok' | 'linkedin'
  platform_account_id: string
  account_name: string
  username: string | null
  profile_picture_url: string | null
  status: 'connected' | 'needs_reconnect' | 'error'
}

export const NewPostPage: React.FC = () => {
  const [content, setContent] = useState('')
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([])
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)

  const [scheduledDate, setScheduledDate] = useState('')
  const [mediaList, setMediaList] = useState<UploadedMediaRecord[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Active tab in platform settings panel
  const [activePlatformTab, setActivePlatformTab] = useState<string>('youtube')
  // Active preview tab in live preview panel
  const [previewPlatform, setPreviewPlatform] = useState<string>('youtube')

  // =========================================================================
  // PLATFORM-SPECIFIC SETTINGS STATES
  // =========================================================================

  // 1. YouTube
  const [ytTitle, setYtTitle] = useState('')
  const [ytPrivacy, setYtPrivacy] = useState<'public' | 'unlisted' | 'private'>('public')
  const [ytMadeForKids, setYtMadeForKids] = useState<'no' | 'yes'>('no')
  const [ytTags, setYtTags] = useState('')

  // 2. Facebook
  const [fbPostType, setFbPostType] = useState<'post' | 'story'>('post')
  const [fbVideoTitle, setFbVideoTitle] = useState('')
  const [fbUrl, setFbUrl] = useState('')
  const [fbFirstComment, setFbFirstComment] = useState('')

  // 3. Instagram
  const [igPostType, setIgPostType] = useState<'post' | 'story'>('post')
  const [igCollaborators, setIgCollaborators] = useState('')
  const [igIsTrialReel, setIgIsTrialReel] = useState(false)
  const [igGraduationStrategy, setIgGraduationStrategy] = useState<'MANUAL' | 'SS_PERFORMANCE'>('MANUAL')
  const [igFirstComment, setIgFirstComment] = useState('')

  // 4. TikTok
  const [ttTitle, setTtTitle] = useState('')
  const [ttPrivacy, setTtPrivacy] = useState('PUBLIC_TO_EVERYONE')
  const [ttPostingMethod, setTtPostingMethod] = useState<'DIRECT_POST' | 'UPLOAD'>('DIRECT_POST')
  const [ttAllowComments, setTtAllowComments] = useState(true)
  const [ttAllowDuet, setTtAllowDuet] = useState(false)
  const [ttAllowStitch, setTtAllowStitch] = useState(false)
  const [ttMadeWithAi, setTtMadeWithAi] = useState(false)
  const [ttDisclose, setTtDisclose] = useState(false)
  const [ttBrandOrganic, setTtBrandOrganic] = useState(false)
  const [ttBrandContent, setTtBrandContent] = useState(false)

  // 5. LinkedIn
  const [liPostAsCarousel, setLiPostAsCarousel] = useState(false)
  const [liCarouselName, setLiCarouselName] = useState('')
  const [liFirstComment, setLiFirstComment] = useState('')

  const platformLimits: Record<string, number> = {
    youtube: 5000,
    facebook: 63206,
    instagram: 2200,
    tiktok: 2200,
    linkedin: 3000,
  }

  // Fetch connected accounts
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const { data, error } = await supabase
          .from('social_accounts')
          .select('*')
          .order('created_at', { ascending: false })

        if (!error && data) {
          setConnectedAccounts(data)
          setSelectedAccountIds(data.map((a) => a.id))
          if (data.length > 0) {
            setActivePlatformTab(data[0].platform)
            setPreviewPlatform(data[0].platform)
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingAccounts(false)
      }
    }
    loadAccounts()
  }, [])

  const toggleAccount = (id: string) => {
    setSelectedAccountIds((prev) => {
      const exists = prev.includes(id)
      const next = exists ? prev.filter((accId) => accId !== id) : [...prev, id]
      const acc = connectedAccounts.find((a) => a.id === id)
      if (acc && !exists) {
        setActivePlatformTab(acc.platform)
        setPreviewPlatform(acc.platform)
      }
      return next
    })
  }

  const selectAllAccounts = () => {
    setSelectedAccountIds(connectedAccounts.map((a) => a.id))
  }

  const deselectAllAccounts = () => {
    setSelectedAccountIds([])
  }

  const selectedAccounts = connectedAccounts.filter((a) => selectedAccountIds.includes(a.id))
  const selectedPlatforms = Array.from(new Set(selectedAccounts.map((a) => a.platform)))

  // Auto-switch platform tab if current tab is not in selected platforms
  useEffect(() => {
    if (selectedPlatforms.length > 0 && !selectedPlatforms.includes(activePlatformTab as any)) {
      setActivePlatformTab(selectedPlatforms[0])
      setPreviewPlatform(selectedPlatforms[0])
    }
  }, [selectedPlatforms, activePlatformTab])

  const hasYouTubeSelected = selectedPlatforms.includes('youtube')
  const hasInstagramSelected = selectedPlatforms.includes('instagram')

  const hasVideoAttached = mediaList.some((m) => m.mimeType.startsWith('video/'))

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'youtube':
        return { icon: YoutubeIcon, color: 'text-red-500', name: 'YouTube', border: 'hover:border-red-500/50' }
      case 'facebook':
        return { icon: FacebookIcon, color: 'text-blue-500', name: 'Facebook', border: 'hover:border-blue-500/50' }
      case 'instagram':
        return { icon: InstagramIcon, color: 'text-pink-500', name: 'Instagram', border: 'hover:border-pink-500/50' }
      case 'tiktok':
        return { icon: TikTokIcon, color: 'text-cyan-400', name: 'TikTok', border: 'hover:border-cyan-500/50' }
      case 'linkedin':
        return { icon: LinkedinIcon, color: 'text-sky-400', name: 'LinkedIn', border: 'hover:border-sky-500/50' }
      default:
        return { icon: YoutubeIcon, color: 'text-slate-400', name: platform, border: 'hover:border-slate-500/50' }
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return

    const incomingFiles = Array.from(e.target.files)
    setUploading(true)
    setStatusMessage(null)

    for (let i = 0; i < incomingFiles.length; i++) {
      const file = incomingFiles[i]
      try {
        setUploadProgress(10)
        const record = await uploadMediaFile(file, (p) => setUploadProgress(p))
        setMediaList((prev) => [...prev, record])
      } catch (err: any) {
        setStatusMessage(err.message)
      }
    }

    setUploading(false)
    setUploadProgress(0)
  }

  const removeMedia = (idx: number) => {
    setMediaList((prev) => prev.filter((_, i) => i !== idx))
  }

  const addHashtag = (tag: string) => {
    setContent((prev) => {
      const trimmed = prev.trim()
      return trimmed ? `${trimmed} ${tag}` : tag
    })
  }

  const handlePublishOrSchedule = async () => {
    if (!content.trim() && mediaList.length === 0) {
      alert('Please enter post text or upload a media file.')
      return
    }

    if (selectedAccountIds.length === 0) {
      alert('Please select at least one channel to publish to.')
      return
    }

    if (hasInstagramSelected && mediaList.length === 0) {
      alert('Instagram requires at least one image or video attachment.')
      return
    }

    if (hasYouTubeSelected && !hasVideoAttached) {
      alert('YouTube requires a video attachment (MP4/MOV).')
      return
    }

    setIsSubmitting(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Please sign in first.')

      // 1. Create master post record
      const isScheduled = !!scheduledDate
      const { data: post, error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content,
          status: isScheduled ? 'scheduled' : 'publishing',
          scheduled_at: isScheduled ? new Date(scheduledDate).toISOString() : null,
        })
        .select('id')
        .single()

      if (postError) throw postError

      // 2. Attach media if any
      if (mediaList.length > 0) {
        const postMediaRows = mediaList.map((m, index) => ({
          post_id: post.id,
          media_id: m.id,
          position: index,
        }))
        await supabase.from('post_media').insert(postMediaRows)
      }

      // 3. Assemble full platform-specific options payload
      const fullPlatformOptions = {
        youtube: {
          title: ytTitle || content.slice(0, 70),
          privacy: ytPrivacy,
          madeForKids: ytMadeForKids,
          tags: ytTags.split(',').map((t) => t.trim()).filter(Boolean),
        },
        facebook: {
          postType: fbPostType,
          videoTitle: fbVideoTitle,
          url: fbUrl,
          firstComment: fbFirstComment,
        },
        instagram: {
          postType: igPostType,
          collaborators: igCollaborators.split(',').map((c) => c.trim()).filter(Boolean),
          isTrialReel: igIsTrialReel,
          graduationStrategy: igGraduationStrategy,
          firstComment: igFirstComment,
        },
        tiktok: {
          title: ttTitle || content.slice(0, 80),
          privacy: ttPrivacy,
          postingMethod: ttPostingMethod,
          allowComments: ttAllowComments,
          allowDuet: ttAllowDuet,
          allowStitch: ttAllowStitch,
          madeWithAi: ttMadeWithAi,
          disclose: ttDisclose,
          brandOrganic: ttBrandOrganic,
          brandContent: ttBrandContent,
        },
        linkedin: {
          postAsCarousel: liPostAsCarousel,
          carouselName: liCarouselName,
          firstComment: liFirstComment,
        },
      }

      // Create target row for EACH selected channel explicitly
      const targetRows = selectedAccountIds.map((accId) => ({
        post_id: post.id,
        account_id: accId,
        platform_options: fullPlatformOptions,
        status: isScheduled ? 'pending' : 'publishing',
      }))

      const { error: targetInsertErr } = await supabase.from('post_targets').insert(targetRows)
      if (targetInsertErr) throw targetInsertErr

      // 4. Trigger publish-now Edge Function if immediate
      if (!isScheduled) {
        await supabase.functions.invoke('publish-now', {
          body: { postId: post.id },
        })
      }

      alert(
        isScheduled
          ? 'Post successfully scheduled! You can view it in the Calendar.'
          : 'Post submitted for publishing! Check Post Details for live progress.'
      )
      window.location.href = `/posts/${post.id}`
    } catch (err: any) {
      alert(`Error submitting post: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Active account for preview
  const previewAccount =
    selectedAccounts.find((a) => a.platform === previewPlatform) ||
    connectedAccounts.find((a) => a.platform === previewPlatform) ||
    selectedAccounts[0] ||
    connectedAccounts[0]

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-950">
      {/* 1. TOP HEADER */}
      <Header
        title="New Post"
        subtitle="Single-screen composer with real-time multi-platform tuning"
        rightActions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePublishOrSchedule}
              disabled={isSubmitting || selectedAccountIds.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-md shadow-indigo-600/25 transition-all cursor-pointer disabled:opacity-40"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : scheduledDate ? (
                <>
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Schedule ({selectedAccountIds.length})</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Publish ({selectedAccountIds.length})</span>
                </>
              )}
            </button>
          </div>
        }
      />

      {/* 2. COMPACT HORIZONTAL CHANNEL SELECTOR STRIP */}
      <div className="h-12 bg-slate-900/80 border-b border-slate-800/80 px-4 py-1.5 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Channels:</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {selectedAccountIds.length}/{connectedAccounts.length}
            </span>
          </div>

          {connectedAccounts.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] ml-1">
              <button
                type="button"
                onClick={selectAllAccounts}
                className="text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
              >
                All
              </button>
              <span className="text-slate-600">•</span>
              <button
                type="button"
                onClick={deselectAllAccounts}
                className="text-slate-400 hover:text-slate-200 font-medium cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Channel Pills (Horizontal row) */}
        <div className="flex items-center gap-2 overflow-x-auto min-w-0 py-0.5">
          {loadingAccounts ? (
            <span className="text-xs text-slate-500">Loading accounts...</span>
          ) : connectedAccounts.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>No channels connected yet.</span>
              <Link to="/accounts" className="text-indigo-400 hover:underline font-semibold">
                + Connect in Accounts
              </Link>
            </div>
          ) : (
            connectedAccounts.map((account) => {
              const isSelected = selectedAccountIds.includes(account.id)
              const { icon: PlatformIcon, color } = getPlatformIcon(account.platform)
              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => toggleAccount(account.id)}
                  title={`Click to toggle ${account.account_name}`}
                  className={`px-2.5 py-1 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shrink-0 border ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500/80 text-white shadow-sm ring-1 ring-indigo-500/30'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="relative shrink-0">
                    <img
                      src={
                        account.profile_picture_url ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
                      }
                      alt={account.account_name}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                    <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-slate-900 border border-slate-800">
                      <PlatformIcon className={`w-2 h-2 ${color}`} />
                    </div>
                  </div>
                  <span className="font-medium text-xs truncate max-w-[120px]">{account.account_name}</span>
                  <div
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 text-[10px] ${
                      isSelected ? 'bg-indigo-600 text-white' : 'border border-slate-700 bg-slate-900 text-transparent'
                    }`}
                  >
                    <Check className="w-2.5 h-2.5" />
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Dismissible Error / Warning Banner */}
      {statusMessage && (
        <div className="mx-4 mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-amber-200 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="p-1 hover:text-white rounded-lg hover:bg-amber-500/20"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. MAIN WORKSPACE: 3 COLUMNS SIDE-BY-SIDE IN ONE SCREEN */}
      <div className="flex-1 min-h-0 p-3.5 grid grid-cols-1 lg:grid-cols-3 gap-3.5 overflow-hidden">
        {/* ========================================================================= */}
        {/* COLUMN 1: MASTER CAPTION & MEDIA ATTACHMENTS                                */}
        {/* ========================================================================= */}
        <div className="h-full flex flex-col gap-3 min-h-0 overflow-hidden">
          {/* Card 1A: Caption & Text */}
          <div className="flex-1 min-h-0 flex flex-col bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Post Caption & Text
              </label>

              {/* Character Limit Counters per Platform */}
              <div className="flex items-center gap-1.5 overflow-x-auto max-w-[200px] no-scrollbar">
                {selectedAccounts.map((acc) => {
                  const limit = platformLimits[acc.platform] || 2000
                  const isOver = content.length > limit
                  const { icon: Icon, color } = getPlatformIcon(acc.platform)
                  return (
                    <span
                      key={acc.id}
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0 ${
                        isOver ? 'bg-rose-500/20 text-rose-300 font-bold' : 'bg-slate-800/80 text-slate-400'
                      }`}
                      title={`${acc.account_name}: ${content.length}/${limit}`}
                    >
                      <Icon className={`w-2.5 h-2.5 ${color}`} />
                      <span>
                        {content.length}/{limit > 1000 ? `${Math.round(limit / 1000)}k` : limit}
                      </span>
                    </span>
                  )
                })}
              </div>
            </div>

            {/* Caption Textarea */}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What would you like to share today? Add your thoughts, hashtags, or links..."
              className="flex-1 min-h-[90px] w-full bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 resize-none focus:outline-none focus:border-indigo-500 transition-colors leading-relaxed"
            />

            {/* Quick Hashtags Footer */}
            <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-800/60 shrink-0">
              <div className="flex items-center gap-1.5 overflow-x-auto text-[10px]">
                <span className="text-slate-500 flex items-center gap-0.5">
                  <Hash className="w-3 h-3" /> Quick:
                </span>
                {['#tech', '#viral', '#updates', '#news', '#ai'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addHashtag(tag)}
                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {content && (
                <button
                  type="button"
                  onClick={() => setContent('')}
                  className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Card 1B: Media Attachments */}
          <div className="flex flex-col bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 shrink-0 max-h-[220px]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Media Attachments
                </span>
              </div>
              <span className="text-[10px] text-slate-500">Max 50MB (MP4, MOV, JPG, PNG)</span>
            </div>

            {/* Compact Dropzone Button */}
            <label className="border border-dashed border-slate-700 hover:border-indigo-500 hover:bg-slate-900/80 bg-slate-950/40 rounded-xl p-2.5 flex items-center justify-center gap-2 cursor-pointer transition-all relative">
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              ) : (
                <Upload className="w-4 h-4 text-indigo-400" />
              )}
              <span className="text-xs font-medium text-slate-300">
                {uploading ? `Uploading to storage (${uploadProgress}%)...` : 'Click to add images or video'}
              </span>
            </label>

            {/* Progress bar */}
            {uploading && (
              <div className="w-full bg-slate-800 rounded-full h-1 mt-2 overflow-hidden">
                <div
                  className="bg-indigo-500 h-1 transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            {/* Media list thumbnails */}
            {mediaList.length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-2 max-h-[110px] overflow-y-auto pr-1">
                {mediaList.map((media, idx) => {
                  const isVideo = media.mimeType.startsWith('video/')
                  return (
                    <div
                      key={media.id || idx}
                      className="p-1.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2 text-xs group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded bg-slate-900 border border-slate-700/60 overflow-hidden shrink-0 flex items-center justify-center relative">
                          {isVideo ? (
                            <>
                              <Film className="w-4 h-4 text-indigo-400" />
                              {media.durationSeconds && (
                                <span className="absolute bottom-0 right-0 px-0.5 rounded bg-black/90 text-[8px] text-slate-300 font-mono">
                                  {media.durationSeconds}s
                                </span>
                              )}
                            </>
                          ) : (
                            <img
                              src={media.previewUrl}
                              alt={media.fileName}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] text-slate-200 font-medium truncate">{media.fileName}</p>
                          <p className="text-[9px] text-slate-500">
                            {(media.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeMedia(idx)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                        title="Remove attachment"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Platform Requirement Notices */}
            {hasYouTubeSelected && !hasVideoAttached && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-amber-400 font-medium">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>YouTube requires an MP4/MOV video</span>
              </div>
            )}
            {hasInstagramSelected && mediaList.length === 0 && (
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-amber-400 font-medium">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>Instagram requires an image or video</span>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 2: PLATFORM-SPECIFIC SETTINGS                                      */}
        {/* ========================================================================= */}
        <div className="h-full flex flex-col bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 min-h-0 overflow-hidden">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80 shrink-0">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white">Platform Settings</h3>
            </div>
            <span className="text-[10px] text-slate-500">Fine-tune per destination</span>
          </div>

          {/* Platform Switcher Tabs */}
          <div className="flex items-center gap-1.5 py-2.5 overflow-x-auto shrink-0 border-b border-slate-800/50">
            {(selectedPlatforms.length > 0 ? selectedPlatforms : ['youtube', 'facebook', 'instagram', 'tiktok', 'linkedin']).map(
              (plt) => {
                const { icon: Icon, color, name } = getPlatformIcon(plt)
                const isActive = activePlatformTab === plt
                const isSelected = selectedPlatforms.includes(plt as any)
                return (
                  <button
                    key={plt}
                    type="button"
                    onClick={() => {
                      setActivePlatformTab(plt)
                      setPreviewPlatform(plt)
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-slate-800 text-white shadow-sm border-slate-700'
                        : isSelected
                        ? 'bg-slate-950/60 text-slate-300 hover:text-white hover:bg-slate-900 border-slate-800'
                        : 'bg-slate-950/30 text-slate-600 hover:text-slate-400 border-transparent opacity-60'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                    <span>{name}</span>
                  </button>
                )
              }
            )}
          </div>

          {/* Form Content: Scrollable inside Column 2 if needed */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 pt-3 space-y-3">
            {/* 1. YOUTUBE SETTINGS */}
            {activePlatformTab === 'youtube' && (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-red-400 text-xs font-semibold">
                  <YoutubeIcon className="w-4 h-4" />
                  <span>YouTube Video Options</span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-slate-300 font-medium">
                      Video Title <span className="text-red-400">*</span>
                    </label>
                    <span className="text-[10px] text-slate-500">{ytTitle.length}/100</span>
                  </div>
                  <input
                    type="text"
                    maxLength={100}
                    value={ytTitle}
                    onChange={(e) => setYtTitle(e.target.value)}
                    placeholder="Catchy YouTube Video Title"
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">Privacy</label>
                    <select
                      value={ytPrivacy}
                      onChange={(e) => setYtPrivacy(e.target.value as any)}
                      className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Private</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">Made for Kids</label>
                    <select
                      value={ytMadeForKids}
                      onChange={(e) => setYtMadeForKids(e.target.value as any)}
                      className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-medium mb-1">Tags (Comma-separated)</label>
                  <input
                    type="text"
                    value={ytTags}
                    onChange={(e) => setYtTags(e.target.value)}
                    placeholder="gaming, tutorial, review, updates"
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* 2. FACEBOOK SETTINGS */}
            {activePlatformTab === 'facebook' && (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-blue-400 text-xs font-semibold">
                  <FacebookIcon className="w-4 h-4" />
                  <span>Facebook Page Options</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">Post Type</label>
                    <select
                      value={fbPostType}
                      onChange={(e) => setFbPostType(e.target.value as any)}
                      className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="post">Feed Post</option>
                      <option value="story">Page Story</option>
                    </select>
                  </div>

                  {hasVideoAttached && (
                    <div>
                      <label className="block text-xs text-slate-300 font-medium mb-1">Video Title</label>
                      <input
                        type="text"
                        value={fbVideoTitle}
                        onChange={(e) => setFbVideoTitle(e.target.value)}
                        placeholder="Video heading"
                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}
                </div>

                {!hasVideoAttached && mediaList.length === 0 && (
                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">Link URL</label>
                    <input
                      type="url"
                      value={fbUrl}
                      onChange={(e) => setFbUrl(e.target.value)}
                      placeholder="https://example.com/article"
                      className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs text-slate-300 font-medium mb-1">First Comment (Optional)</label>
                  <input
                    type="text"
                    value={fbFirstComment}
                    onChange={(e) => setFbFirstComment(e.target.value)}
                    placeholder="Check out our website in the link below!"
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* 3. INSTAGRAM SETTINGS */}
            {activePlatformTab === 'instagram' && (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-pink-400 text-xs font-semibold">
                  <InstagramIcon className="w-4 h-4" />
                  <span>Instagram Options</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">Post Type</label>
                    <select
                      value={igPostType}
                      onChange={(e) => setIgPostType(e.target.value as any)}
                      className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="post">Feed / Reel</option>
                      <option value="story">Story</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">Collaborators</label>
                    <input
                      type="text"
                      value={igCollaborators}
                      onChange={(e) => setIgCollaborators(e.target.value)}
                      placeholder="user1, user2"
                      className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Trial Reel Mode */}
                {hasVideoAttached && igPostType === 'post' && (
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-200 block">Trial Reel Mode</span>
                        <p className="text-[10px] text-slate-400">Share to non-followers first</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={igIsTrialReel}
                        onChange={(e) => setIgIsTrialReel(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                      />
                    </div>

                    {igIsTrialReel && (
                      <div>
                        <label className="block text-[11px] text-slate-300 font-medium mb-1">
                          Graduation Strategy
                        </label>
                        <select
                          value={igGraduationStrategy}
                          onChange={(e) => setIgGraduationStrategy(e.target.value as any)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-slate-200"
                        >
                          <option value="MANUAL">Manual Graduation</option>
                          <option value="SS_PERFORMANCE">Auto Performance Graduation</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs text-slate-300 font-medium mb-1">First Comment (Hashtags)</label>
                  <input
                    type="text"
                    value={igFirstComment}
                    onChange={(e) => setIgFirstComment(e.target.value)}
                    placeholder="#reels #explore #viral #instagram"
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* 4. TIKTOK SETTINGS */}
            {activePlatformTab === 'tiktok' && (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-semibold">
                  <TikTokIcon className="w-4 h-4" />
                  <span>TikTok Video Options</span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-slate-300 font-medium">Video Title</label>
                    <span className="text-[10px] text-slate-500">{ttTitle.length}/89</span>
                  </div>
                  <input
                    type="text"
                    maxLength={89}
                    value={ttTitle}
                    onChange={(e) => setTtTitle(e.target.value)}
                    placeholder="Short catchy TikTok title"
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">Privacy</label>
                    <select
                      value={ttPrivacy}
                      onChange={(e) => setTtPrivacy(e.target.value)}
                      className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="PUBLIC_TO_EVERYONE">Public</option>
                      <option value="MUTUAL_FOLLOW_FRIENDS">Friends</option>
                      <option value="FOLLOWER_OF_CREATOR">Followers</option>
                      <option value="SELF_ONLY">Only Me</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">Posting Method</label>
                    <select
                      value={ttPostingMethod}
                      onChange={(e) => setTtPostingMethod(e.target.value as any)}
                      className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="DIRECT_POST">Direct Post</option>
                      <option value="UPLOAD">App Inbox</option>
                    </select>
                  </div>
                </div>

                {/* Feature Toggles */}
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <span className="text-[11px] font-semibold text-slate-300 block">Permissions & Badges</span>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ttAllowComments}
                        onChange={(e) => setTtAllowComments(e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span>Comments</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ttAllowDuet}
                        onChange={(e) => setTtAllowDuet(e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span>Duet</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ttAllowStitch}
                        onChange={(e) => setTtAllowStitch(e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span>Stitch</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ttMadeWithAi}
                        onChange={(e) => setTtMadeWithAi(e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span>AI Badge</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ttDisclose}
                        onChange={(e) => setTtDisclose(e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span>Promo</span>
                    </label>
                  </div>

                  {ttDisclose && (
                    <div className="pt-2 border-t border-slate-800/80 flex items-center gap-3 text-[11px] text-slate-300">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ttBrandOrganic}
                          onChange={(e) => setTtBrandOrganic(e.target.checked)}
                          className="rounded text-indigo-600"
                        />
                        <span>Brand Organic</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ttBrandContent}
                          onChange={(e) => setTtBrandContent(e.target.checked)}
                          className="rounded text-indigo-600"
                        />
                        <span>Brand Content</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 5. LINKEDIN SETTINGS */}
            {activePlatformTab === 'linkedin' && (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-sky-400 text-xs font-semibold">
                  <LinkedinIcon className="w-4 h-4" />
                  <span>LinkedIn Post Options</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-200 block">Post as Images Carousel</span>
                      <p className="text-[10px] text-slate-400">Presents images as swipeable document slides</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={liPostAsCarousel}
                      onChange={(e) => setLiPostAsCarousel(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                    />
                  </div>

                  {liPostAsCarousel && (
                    <div>
                      <label className="block text-[11px] text-slate-300 font-medium mb-1">Slide Title</label>
                      <input
                        type="text"
                        value={liCarouselName}
                        onChange={(e) => setLiCarouselName(e.target.value)}
                        placeholder="e.g. My Presentation Slides"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-slate-100"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-medium mb-1">First Comment (Optional)</label>
                  <input
                    type="text"
                    value={liFirstComment}
                    onChange={(e) => setLiFirstComment(e.target.value)}
                    placeholder="Drop your thoughts or links in the comments..."
                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 3: SCHEDULE & LIVE INTERACTIVE PREVIEW                             */}
        {/* ========================================================================= */}
        <div className="h-full flex flex-col gap-3 min-h-0 overflow-hidden">
          {/* Card 3A: Schedule Card */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-2.5 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-white">Publish Schedule</span>
              </div>
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  scheduledDate ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                {scheduledDate ? 'Scheduled' : 'Publish Immediately'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="flex-1 bg-slate-950/70 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              {scheduledDate && (
                <button
                  type="button"
                  onClick={() => setScheduledDate('')}
                  title="Clear schedule to publish now"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={handlePublishOrSchedule}
              disabled={isSubmitting || selectedAccountIds.length === 0}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Post...</span>
                </>
              ) : scheduledDate ? (
                <>
                  <Calendar className="w-4 h-4" />
                  <span>Schedule Post ({selectedAccountIds.length} Channels)</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Publish Now ({selectedAccountIds.length} Channels)</span>
                </>
              )}
            </button>
          </div>

          {/* Card 3B: Live Interactive Preview */}
          <div className="flex-1 min-h-0 flex flex-col bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 overflow-hidden">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 shrink-0">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-white">Live Preview</span>
              </div>

              {/* Preview Platform Tabs */}
              <div className="flex items-center gap-1">
                {(['youtube', 'instagram', 'facebook', 'tiktok', 'linkedin'] as const).map((plt) => {
                  const { icon: Icon, color } = getPlatformIcon(plt)
                  const isSelected = selectedPlatforms.includes(plt)
                  const isActive = previewPlatform === plt
                  return (
                    <button
                      key={plt}
                      type="button"
                      onClick={() => setPreviewPlatform(plt)}
                      title={`Preview as ${plt}`}
                      className={`p-1 rounded-lg transition-all cursor-pointer ${
                        isActive
                          ? 'bg-slate-800 ring-1 ring-slate-600'
                          : isSelected
                          ? 'hover:bg-slate-800/80 opacity-70'
                          : 'opacity-30 hover:opacity-50'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${color}`} />
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Realistic Preview Mockup Container */}
            <div className="flex-1 min-h-0 overflow-y-auto mt-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 p-3 space-y-2.5">
              {/* Profile Bar */}
              <div className="flex items-center gap-2.5">
                <img
                  src={
                    previewAccount?.profile_picture_url ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
                  }
                  alt={previewAccount?.account_name || 'Channel'}
                  className="w-7 h-7 rounded-full object-cover border border-slate-700"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-semibold text-white truncate">
                    {previewAccount?.account_name || 'Your Channel'}
                  </h4>
                  <p className="text-[10px] text-slate-400 truncate">
                    {previewAccount?.username ? `@${previewAccount.username}` : previewPlatform} • Just now
                  </p>
                </div>
              </div>

              {/* YouTube Specific Preview */}
              {previewPlatform === 'youtube' && (
                <div className="space-y-2">
                  <div className="aspect-video w-full rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden relative">
                    {mediaList.length > 0 && mediaList[0].mimeType.startsWith('image/') ? (
                      <img src={mediaList[0].previewUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                    ) : mediaList.length > 0 && mediaList[0].mimeType.startsWith('video/') ? (
                      <div className="flex flex-col items-center justify-center text-slate-300 gap-1.5">
                        <Film className="w-8 h-8 text-red-500" />
                        <span className="text-[10px] font-medium">{mediaList[0].fileName}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-500 gap-1">
                        <YoutubeIcon className="w-8 h-8 text-red-500" />
                        <span className="text-[10px]">Video player preview</span>
                      </div>
                    )}
                  </div>
                  <h3 className="text-xs font-bold text-white line-clamp-2">
                    {ytTitle || content.slice(0, 70) || 'Catchy YouTube Video Title'}
                  </h3>
                  <p className="text-[11px] text-slate-300 whitespace-pre-wrap line-clamp-3">
                    {content || 'Video description appears here...'}
                  </p>
                </div>
              )}

              {/* Instagram / Facebook / TikTok / LinkedIn General Preview */}
              {previewPlatform !== 'youtube' && (
                <div className="space-y-2">
                  {/* Caption */}
                  <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {content || 'Your post caption will appear here...'}
                  </p>

                  {/* Media Preview */}
                  {mediaList.length > 0 ? (
                    <div className="rounded-lg overflow-hidden border border-slate-800 bg-slate-900">
                      {mediaList[0].mimeType.startsWith('image/') ? (
                        <img
                          src={mediaList[0].previewUrl}
                          alt="Preview"
                          className="w-full max-h-44 object-cover"
                        />
                      ) : (
                        <div className="p-4 flex flex-col items-center justify-center text-slate-400 gap-1.5">
                          <Film className="w-6 h-6 text-indigo-400" />
                          <span className="text-[11px] text-slate-300 truncate max-w-full">
                            {mediaList[0].fileName}
                          </span>
                          {mediaList[0].durationSeconds && (
                            <span className="text-[9px] text-slate-500 font-mono">
                              {mediaList[0].durationSeconds} seconds
                            </span>
                          )}
                        </div>
                      )}
                      {mediaList.length > 1 && (
                        <div className="p-1 text-center bg-slate-950/80 text-[10px] text-slate-400">
                          +{mediaList.length - 1} more media item(s)
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* First Comment Preview if provided */}
                  {((previewPlatform === 'instagram' && igFirstComment) ||
                    (previewPlatform === 'facebook' && fbFirstComment) ||
                    (previewPlatform === 'linkedin' && liFirstComment)) && (
                    <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-[10px] space-y-1">
                      <span className="text-slate-500 font-semibold block">First Comment Preview:</span>
                      <p className="text-slate-300">
                        {previewPlatform === 'instagram'
                          ? igFirstComment
                          : previewPlatform === 'facebook'
                          ? fbFirstComment
                          : liFirstComment}
                      </p>
                    </div>
                  )}

                  {/* Mock Social Interactions Bar */}
                  <div className="flex items-center justify-between pt-1 text-slate-500 text-xs border-t border-slate-800/60">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 hover:text-rose-400 transition-colors">
                        <Heart className="w-3.5 h-3.5" /> 0
                      </span>
                      <span className="flex items-center gap-1 hover:text-indigo-400 transition-colors">
                        <MessageCircle className="w-3.5 h-3.5" /> 0
                      </span>
                      <span className="flex items-center gap-1 hover:text-emerald-400 transition-colors">
                        <Share2 className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <Bookmark className="w-3.5 h-3.5" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
