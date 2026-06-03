'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface Project { id: string; name: string; code: string; description: string; status: string }
interface Stats { meetings: number; requirements: number; userStories: number; testCases: number; pendingChanges: number }

export default function ProjectPage() {
  const params   = useParams()
  const router   = useRouter()
  const supabase  = createClient()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [stats, setStats]     = useState<Stats>({ meetings: 0, requirements: 0, userStories: 0, testCases: 0, pendingChanges: 0 })
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genMsg, setGenMsg]   = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single()
      if (!proj) { router.push('/dashboard'); return }
      setProject(proj)

      const [m, r, us, tc, ch] = await Promise.all([
        supabase.from('meetings').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('requirements').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('user_stories').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('test_cases').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('change_detections').select('*', { count: 'exact', head: true }).eq('project_id', projectId).eq('status', 'pending'),
      ])

      setStats({
        meetings:      m.count ?? 0,
        requirements:  r.count ?? 0,
        userStories:   us.count ?? 0,
        testCases:     tc.count ?? 0,
        pendingChanges: ch.count ?? 0,
      })
      setLoading(false)
    }
    load()
  }, [projectId])

  async function generateAll() {
    setGenerating(true); setGenMsg('Generating artifacts with Gemini AI…')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const res = await fetch('/api/generate-artifacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, userId: user.id, generateFor: 'all' }),
    })
    const data = await res.json()
    setGenerating(false)
    setGenMsg(res.ok ? '✅ BRD, User Stories, and Test Cases generated!' : `❌ ${data.error}`)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"/></div>
  if (!project) return null

  const actions = [
    { icon: '📋', label: 'Upload Transcript', desc: 'Upload meeting notes to auto-generate MOM', href: `upload`, color: 'bg-brand-700 text-white hover:bg-brand-500' },
    { icon: '⚡', label: 'Review Queue', desc: `${stats.pendingChanges} item(s) pending approval`, href: `review`, color: stats.pendingChanges > 0 ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-white border border-gray-200 hover:border-brand-500' },
    { icon: '📄', label: 'Documents', desc: 'View BRD, PRD, User Stories, Test Cases', href: `documents`, color: 'bg-white border border-gray-200 hover:border-brand-500' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/dashboard" className="text-brand-500 text-sm hover:underline">← Dashboard</Link>
        <span className="text-gray-300">/</span>
        <span className="bg-brand-50 text-brand-700 text-xs font-bold px-2 py-0.5 rounded">{project.code}</span>
        <span className="text-sm font-semibold text-gray-700">{project.name}</span>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Project header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{project.name}</h1>
              {project.description && <p className="text-gray-400 mt-1">{project.description}</p>}
            </div>
            <span className="bg-green-100 text-green-700 text-sm font-semibold px-3 py-1 rounded-full">{project.status}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Meetings',     value: stats.meetings,       icon: '📹', color: 'text-blue-600' },
            { label: 'Requirements', value: stats.requirements,   icon: '📋', color: 'text-green-600' },
            { label: 'User Stories', value: stats.userStories,    icon: '📖', color: 'text-purple-600' },
            { label: 'Test Cases',   value: stats.testCases,      icon: '🧪', color: 'text-orange-600' },
            { label: 'Pending',      value: stats.pendingChanges, icon: '⚡', color: stats.pendingChanges > 0 ? 'text-red-600' : 'text-gray-400' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <span className="text-xl">{s.icon}</span>
              <div className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {actions.map(a => (
            <Link key={a.label} href={`/projects/${projectId}/${a.href}`}
              className={`${a.color} rounded-xl p-5 block transition-all hover:shadow-md`}>
              <span className="text-3xl mb-2 block">{a.icon}</span>
              <div className="font-semibold">{a.label}</div>
              <div className="text-sm opacity-75 mt-0.5">{a.desc}</div>
            </Link>
          ))}
        </div>

        {/* Generate Artifacts */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-800">🤖 Generate All Artifacts</h2>
              <p className="text-gray-400 text-sm mt-1">
                Auto-generate BRD, User Stories (US-XXX), Acceptance Criteria, and Test Cases (TC-XXX) from approved requirements.
              </p>
            </div>
            <button
              onClick={generateAll} disabled={generating || stats.requirements === 0}
              className="bg-brand-700 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand-500 transition-colors disabled:opacity-40 whitespace-nowrap ml-4"
            >
              {generating ? '⏳ Generating…' : '✨ Generate'}
            </button>
          </div>
          {genMsg && <div className={`mt-3 text-sm p-2 rounded ${genMsg.startsWith('✅') ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>{genMsg}</div>}
          {stats.requirements === 0 && (
            <div className="mt-3 text-xs text-gray-400">
              Upload and process a transcript first to extract requirements.
            </div>
          )}
        </div>

        {/* Export to Jira / ADO */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mt-4">
          <h2 className="font-bold text-gray-800 mb-1">🚀 Export to Delivery Tools</h2>
          <p className="text-gray-400 text-sm mb-4">Generate Epics, Features, Stories, and Tasks. Export to Jira or Azure DevOps.</p>
          <div className="flex gap-3">
            {[
              { label: '📊 Export Jira CSV',  format: 'jira_csv' },
              { label: '🔷 Export ADO JSON',  format: 'ado_json' },
              { label: '🌐 Generate Items',   format: 'generate_only' },
            ].map(btn => (
              <button key={btn.format}
                disabled={stats.userStories === 0}
                onClick={async () => {
                  const { data: { user } } = await supabase.auth.getUser()
                  if (!user) return
                  const res = await fetch('/api/export-delivery', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectId, userId: user.id, format: btn.format }),
                  })
                  if (btn.format !== 'generate_only') {
                    const blob = await res.blob()
                    const url  = URL.createObjectURL(blob)
                    const a    = document.createElement('a')
                    a.href = url; a.download = btn.format === 'jira_csv' ? `${project.code}-jira.csv` : `${project.code}-ado.json`
                    a.click(); URL.revokeObjectURL(url)
                  }
                }}
                className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:border-brand-500 hover:text-brand-700 transition-colors disabled:opacity-40">
                {btn.label}
              </button>
            ))}
          </div>
          {stats.userStories === 0 && <p className="text-xs text-gray-400 mt-2">Generate artifacts first to enable delivery export.</p>}
        </div>
      </div>
    </div>
  )
}
