import React from 'react'
import { FileText, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export const TermsPage: React.FC = () => {
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
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <FileText className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Terms of Service</h1>
          </div>
          <p className="text-xs text-slate-400">Last updated: October 17, 2026</p>
        </div>

        <div className="prose prose-invert max-w-none space-y-6 text-sm leading-relaxed text-slate-300">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-white">1. Acceptance of Terms</h2>
            <p>
              By accessing and using SocialHub, you agree to comply with and be bound by these Terms of Service, as well as all applicable third-party API terms and community guidelines established by YouTube, Meta, TikTok, and LinkedIn.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-white">2. Permitted Use</h2>
            <p>
              SocialHub is configured for private multi-channel management. You agree not to use the application to distribute unsolicited spam, copyrighted material without authorization, malware, or any content violating platform guidelines.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-white">3. Third-Party Platform Terms</h2>
            <p>When publishing through SocialHub, you acknowledge adherence to:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>YouTube Terms of Service (<a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer" className="text-indigo-400 underline">https://www.youtube.com/t/terms</a>)</li>
              <li>Meta Platform Terms & Community Standards</li>
              <li>TikTok Terms of Service</li>
              <li>LinkedIn User Agreement</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-white">4. Disclaimer & Limitation of Liability</h2>
            <p>
              SocialHub is provided on an "as is" and "as available" basis without warranties of any kind. Automated posting schedules and API quotas depend on external platform availability and Supabase cloud infrastructure.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
