import React from 'react'
import { Shield, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export const PrivacyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-12 px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to App
        </Link>

        <div className="border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Shield className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Privacy Policy</h1>
          </div>
          <p className="text-xs text-slate-400">Last updated: October 17, 2026</p>
        </div>

        <div className="prose prose-invert max-w-none space-y-6 text-sm leading-relaxed text-slate-300">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-white">1. Overview</h2>
            <p>
              SocialHub is a private, personal social media management application operated exclusively by the account holder. This Privacy Policy outlines how user data, authentication tokens, and published media are collected, stored, and utilized when connecting to third-party social media platforms, including YouTube (Google), Meta (Facebook & Instagram), TikTok, and LinkedIn.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-white">2. Information We Access and Collect</h2>
            <p>When you authenticate a social media account through OAuth 2.0:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li><strong>Basic Profile Data:</strong> Channel ID, Account name, username, and profile image to display within your dashboard.</li>
              <li><strong>OAuth Access & Refresh Tokens:</strong> Cryptographically stored using AES-256-GCM encryption in server-side vaults, strictly accessible only by Edge Functions for publishing and refreshing operations.</li>
              <li><strong>Media Content:</strong> Images and video files uploaded by you to Supabase private storage for distribution to designated channels.</li>
              <li><strong>Analytical Metrics:</strong> Public engagement figures (views, likes, shares, comments, followers) retrieved directly via official platform APIs.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-white">3. Third-Party API Usage & Disclosures</h2>
            <p>
              Our tool adheres strictly to the API terms of each supported platform:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li><strong>YouTube API Services:</strong> By using SocialHub to publish to YouTube, you agree to the Google Privacy Policy (<a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="text-indigo-400 underline">https://policies.google.com/privacy</a>).</li>
              <li><strong>Meta Platforms (Facebook & Instagram):</strong> We access pages and accounts you explicitly manage to publish posts and read engagement analytics.</li>
              <li><strong>TikTok API:</strong> Videos are published according to TikTok's content posting guidelines.</li>
              <li><strong>LinkedIn API:</strong> We only submit posts requested by you and refresh your tokens in accordance with LinkedIn developer policies.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-white">4. Data Storage & Security</h2>
            <p>
              All data is hosted in private Supabase Postgres databases protected by Row-Level Security (RLS). Secret credentials and platform tokens are never exposed to browser client code.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-white">5. Revocation & Data Deletion</h2>
            <p>
              You can disconnect any social account at any time from the Accounts screen, which immediately purges stored OAuth tokens from the database. You may also revoke access at any time via each provider's security settings.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
