'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

type DocType = 'BRD' | 'USER_STORIES' | 'TEST_CASES' | 'AUDIT'

interface Requirement { id: string; code: string; title: string; description: string; req_type: string; priority: string; status: string }
interface UserStory { id: string; code: string; role: string; action: string; benefit: string; status: string; acceptance_criteria: Array<{ given_step: string; when_step: string; then_step: string }> }
interface TestCase { id: string; code: string; description: string; expected_result: string; scenario_type: string; status: string }
interface AuditEntry { id: string; entity_type: string; action: string; actor_email: string; reason: string; created_at: string }

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-yellow-100 text-yellow-700',
  low:      'bg-gray-100 text-gray-500',
}
const SCENARIO_ICONS: Record<string, string> = { happy: '✅', negative: '❌', edge: '⚠️' }

export default function DocumentsPage() {
  const params   = useParams()
  const router   = useRouter()
  const supabase  = createClient()
  const projectId = params.id as string

  const [activeTab, setActiveTab] = useState<DocType>('BRD')
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [userStories, setUserStories]   = useState<UserStory[]>([])
  const [testCases, setTestCases]       = useState<TestCase[]>([])
  const [auditLogs, setAuditLogs]       = useState<AuditEntry[]>([])
  const [project, setProject]           = useState<{ name: string; code: string } | null>(null)
  const [loading, setLoading]           = useState(true)
  const [expandedStory, setExpandedStory] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const [{ data: proj }, { data: reqs }, { data: stories }, { data: tcs }, { data: logs }] = await Promise.all([
        supabase.from('projects').select('name,code').eq('id', projectId).single(),
        supabase.from('requirements').select('*').eq('project_id', projectId).order('code'),
        supabase.from('user_stories').select('*, acceptance_criteria(*)').eq('project_id', projectId).order('code'),
        supabase.from('test_cases').select('*').eq('project_id', projectId).order('code'),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
      ])

      setProject(proj)
      setRequirements(reqs ?? [])
      setUserStories(stories ?? [])
      setTestCases(tcs ?? [])
      setAuditLogs(logs ?? [])
      setLoading(false)
    }
    load()
  }, [projectId])

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"/></div>

  const tabs: Array<{ key: DocType; label: string; count: number }> = [
    { key: 'BRD',          label: '📋 BRD / Requirements', count: requirements.length },
    { key: 'USER_STORIES', label: '📖 User Stories',        count: userStories.length },
    { key: 'TEST_CASES',   label: '🧪 Test Cases',           count: testCases.length },
    { key: 'AUDIT',        label: '🔍 Audit Log',            count: auditLogs.length },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link href={`/projects/${projectId}`} className="text-brand-500 text-sm hover:underline">← Back to Project</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-semibold text-gray-700">Documents</span>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Document Repository</h1>
            <p className="text-gray-400 text-sm">{project?.name} — {project?.code}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === t.key ? 'bg-brand-700 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-brand-500'}`}>
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === t.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* BRD — Requirements */}
        {activeTab === 'BRD' && (
          <div>
            {requirements.length === 0 ? (
              <EmptyState icon="📋" text="No requirements yet. Upload and process a transcript to extract requirements." />
            ) : (
              <div className="space-y-3">
                {requirements.map(r => (
                  <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">{r.code}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[r.priority] || 'bg-gray-100 text-gray-500'}`}>{r.priority}</span>
                          <span className="text-xs text-gray-400">{r.req_type}</span>
                        </div>
                        <p className="text-gray-800 text-sm font-medium">{r.title}</p>
                        <p className="text-gray-500 text-sm mt-1">{r.description}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${r.status === 'active' ? 'bg-green-100 text-green-700' : r.status === 'deprecated' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                        {r.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* User Stories */}
        {activeTab === 'USER_STORIES' && (
          <div>
            {userStories.length === 0 ? (
              <EmptyState icon="📖" text="No user stories yet. Click 'Generate' on the project page." />
            ) : (
              <div className="space-y-3">
                {userStories.map(s => (
                  <div key={s.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <button className="w-full text-left p-5 flex items-start justify-between"
                      onClick={() => setExpandedStory(expandedStory === s.id ? null : s.id)}>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">{s.code}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{s.status}</span>
                        </div>
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">As a</span> {s.role}, <span className="font-medium">I want to</span> {s.action}{' '}
                          <span className="font-medium">so that</span> {s.benefit}
                        </p>
                      </div>
                      <span className="text-gray-400 ml-4">{expandedStory === s.id ? '▲' : '▼'}</span>
                    </button>

                    {expandedStory === s.id && s.acceptance_criteria?.length > 0 && (
                      <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Acceptance Criteria (Gherkin)</p>
                        <div className="space-y-3">
                          {s.acceptance_criteria.map((ac, i) => (
                            <div key={i} className="bg-white rounded-lg p-3 border border-gray-200 text-sm">
                              <p><span className="font-semibold text-green-600">Given</span> {ac.given_step}</p>
                              <p className="mt-1"><span className="font-semibold text-blue-600">When</span> {ac.when_step}</p>
                              <p className="mt-1"><span className="font-semibold text-purple-600">Then</span> {ac.then_step}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Test Cases */}
        {activeTab === 'TEST_CASES' && (
          <div>
            {testCases.length === 0 ? (
              <EmptyState icon="🧪" text="No test cases yet. Click 'Generate' on the project page." />
            ) : (
              <div className="space-y-3">
                {testCases.map(tc => (
                  <div key={tc.id} className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-start gap-3">
                      <span className="text-xl">{SCENARIO_ICONS[tc.scenario_type] || '🧪'}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">{tc.code}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            tc.scenario_type === 'happy'    ? 'bg-green-100 text-green-700' :
                            tc.scenario_type === 'negative' ? 'bg-red-100 text-red-700'     :
                            'bg-yellow-100 text-yellow-700'
                          }`}>{tc.scenario_type}</span>
                        </div>
                        <p className="font-medium text-gray-800 text-sm">{tc.description}</p>
                        <p className="text-gray-500 text-sm mt-1">
                          <span className="font-medium text-gray-600">Expected:</span> {tc.expected_result}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Audit Log */}
        {activeTab === 'AUDIT' && (
          <div>
            {auditLogs.length === 0 ? (
              <EmptyState icon="🔍" text="No audit entries yet. Actions appear here after approvals." />
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Time', 'Entity', 'Action', 'Actor', 'Reason'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {auditLogs.map(l => (
                      <tr key={l.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{new Date(l.created_at).toLocaleString()}</td>
                        <td className="px-4 py-3 text-gray-500">{l.entity_type}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            l.action === 'approved' ? 'bg-green-100 text-green-700' :
                            l.action === 'rejected' ? 'bg-red-100 text-red-700'    :
                            'bg-blue-100 text-blue-700'
                          }`}>{l.action}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{l.actor_email || '—'}</td>
                        <td className="px-4 py-3 text-gray-400">{l.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-16 text-center">
      <span className="text-5xl mb-3 block">{icon}</span>
      <p className="text-gray-400 text-sm">{text}</p>
    </div>
  )
}
