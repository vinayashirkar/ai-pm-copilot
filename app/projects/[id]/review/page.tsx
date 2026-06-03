'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface Change {
  id: string
  change_type: 'ADDITION' | 'MODIFICATION' | 'DELETION' | 'CONFLICT'
  previous_text: string | null
  proposed_text: string
  source_excerpt: string
  impact: { impactedAreas: string[]; rationale: string }
  confidence: number
  status: string
  created_at: string
  meetings: { title: string } | null
}

interface MOM {
  id: string
  version: number
  content: {
    meetingTitle: string
    summary: string
    decisions: Array<{ id: string; description: string; owner: string }>
    actionItems: Array<{ id: string; description: string; owner: string; dueDate: string }>
    risks: Array<{ id: string; description: string; impact: string }>
    requirements: Array<{ code: string; description: string }>
  }
  status: string
  meetings: { title: string; created_at: string } | null
}

const CHANGE_COLORS = {
  ADDITION:     'bg-green-50 border-green-300 text-green-800',
  MODIFICATION: 'bg-orange-50 border-orange-300 text-orange-800',
  DELETION:     'bg-red-50 border-red-300 text-red-800',
  CONFLICT:     'bg-purple-50 border-purple-300 text-purple-800',
}
const CHANGE_ICONS = { ADDITION: '➕', MODIFICATION: '✏️', DELETION: '🗑️', CONFLICT: '⚡' }

export default function ReviewPage() {
  const params   = useParams()
  const router   = useRouter()
  const supabase  = createClient()
  const projectId = params.id as string

  const [user, setUser]       = useState<{ id: string; email?: string } | null>(null)
  const [changes, setChanges] = useState<Change[]>([])
  const [moms, setMoms]       = useState<MOM[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editText, setEditText]     = useState('')
  const [activeTab, setActiveTab]   = useState<'changes' | 'moms'>('changes')
  const [rejectReason, setRejectReason] = useState('')
  const [rejectingId, setRejectingId]   = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUser(user)

      const [{ data: ch }, { data: mm }] = await Promise.all([
        supabase.from('change_detections').select('*, meetings(title)').eq('project_id', projectId).eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('moms').select('*, meetings(title, created_at)').eq('status', 'pending')
          .in('meeting_id', (await supabase.from('meetings').select('id').eq('project_id', projectId)).data?.map((m: { id: string }) => m.id) ?? [])
          .order('created_at', { ascending: false }),
      ])

      setChanges(ch ?? [])
      setMoms(mm ?? [])
      setLoading(false)
    }
    load()
  }, [projectId])

  async function handleAction(entityType: 'mom' | 'change_detection', entityId: string, action: 'approved' | 'rejected' | 'modified') {
    if (!user) return
    setProcessing(entityId)

    await fetch('/api/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType, entityId, action,
        userId:      user.id,
        userEmail:   user.email,
        reason:      action === 'rejected' ? rejectReason : undefined,
        modifiedText: action === 'modified' ? editText : undefined,
      }),
    })

    // Remove from list
    if (entityType === 'change_detection') setChanges(prev => prev.filter(c => c.id !== entityId))
    if (entityType === 'mom') setMoms(prev => prev.filter(m => m.id !== entityId))

    setProcessing(null); setEditingId(null); setRejectingId(null); setRejectReason('')
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"/></div>

  const pendingTotal = changes.length + moms.length

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link href={`/projects/${projectId}`} className="text-brand-500 text-sm hover:underline">← Back to Project</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-semibold text-gray-700">Review Queue</span>
        {pendingTotal > 0 && <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingTotal}</span>}
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">PM Approval Queue</h1>
            <p className="text-gray-400 text-sm mt-1">Nothing is committed to your documents until you approve it.</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-center">
            <div className="text-2xl font-bold text-brand-700">{pendingTotal}</div>
            <div className="text-xs text-blue-500">pending</div>
          </div>
        </div>

        {pendingTotal === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-16 text-center">
            <span className="text-5xl mb-3 block">✅</span>
            <h2 className="font-bold text-gray-700 text-lg">All clear!</h2>
            <p className="text-gray-400 text-sm mt-2">No pending reviews. Upload a transcript to get started.</p>
            <Link href={`/projects/${projectId}/upload`}
              className="inline-block mt-4 bg-brand-700 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-brand-500 transition-colors text-sm">
              Upload Transcript
            </Link>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              {(['changes', 'moms'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === tab ? 'bg-brand-700 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
                  {tab === 'changes' ? `⚡ Requirement Changes (${changes.length})` : `📋 MOMs (${moms.length})`}
                </button>
              ))}
            </div>

            {/* Requirement Changes */}
            {activeTab === 'changes' && (
              <div className="space-y-4">
                {changes.length === 0 ? <div className="text-center text-gray-400 py-8">No pending requirement changes.</div> : changes.map(c => (
                  <div key={c.id} className={`bg-white rounded-xl border-2 ${CHANGE_COLORS[c.change_type].split(' ')[1]} shadow-sm overflow-hidden`}>
                    {/* Header */}
                    <div className={`${CHANGE_COLORS[c.change_type]} px-5 py-3 flex items-center justify-between`}>
                      <div className="flex items-center gap-2">
                        <span>{CHANGE_ICONS[c.change_type]}</span>
                        <span className="font-bold text-sm">REQUIREMENT CHANGE DETECTED — {c.change_type}</span>
                        <span className="bg-white/50 text-xs px-2 py-0.5 rounded-full font-medium">{c.confidence}% confidence</span>
                      </div>
                      <span className="text-xs opacity-70">{c.meetings?.title || 'Unknown meeting'}</span>
                    </div>

                    <div className="p-5 space-y-4">
                      {/* Diff */}
                      <div>
                        {c.previous_text && (
                          <div className="mb-2">
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Previous Requirement</span>
                            <div className="diff-removed mt-1 text-sm rounded">{c.previous_text}</div>
                          </div>
                        )}
                        <div>
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                            {c.change_type === 'ADDITION' ? 'New Requirement' : 'Proposed Change'}
                          </span>
                          {editingId === c.id ? (
                            <textarea
                              value={editText} onChange={e => setEditText(e.target.value)} rows={3}
                              className="w-full mt-1 p-2 border border-brand-500 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                          ) : (
                            <div className="diff-added mt-1 text-sm rounded">{c.proposed_text}</div>
                          )}
                        </div>
                      </div>

                      {/* Source & Impact */}
                      {c.source_excerpt && (
                        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 italic">
                          <span className="font-semibold not-italic text-gray-600">Source: </span>{c.source_excerpt}
                        </div>
                      )}
                      {c.impact?.impactedAreas?.length > 0 && (
                        <div>
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Impact</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {c.impact.impactedAreas.map((a: string) => (
                              <span key={a} className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">{a}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Reject reason input */}
                      {rejectingId === c.id && (
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Reason for rejection</label>
                          <input value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                            placeholder="e.g. Discussed further — original requirement stands"
                          />
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        <button disabled={!!processing}
                          onClick={() => handleAction('change_detection', c.id, 'approved')}
                          className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-60">
                          {processing === c.id ? '…' : '✅ Approve'}
                        </button>

                        {editingId === c.id ? (
                          <button disabled={!!processing}
                            onClick={() => handleAction('change_detection', c.id, 'modified')}
                            className="flex-1 bg-brand-700 text-white py-2 rounded-lg text-sm font-semibold hover:bg-brand-500 transition-colors disabled:opacity-60">
                            💾 Save Modified
                          </button>
                        ) : (
                          <button onClick={() => { setEditingId(c.id); setEditText(c.proposed_text) }}
                            className="flex-1 border border-brand-500 text-brand-700 py-2 rounded-lg text-sm font-semibold hover:bg-brand-50 transition-colors">
                            ✏️ Modify
                          </button>
                        )}

                        {rejectingId === c.id ? (
                          <button disabled={!!processing}
                            onClick={() => handleAction('change_detection', c.id, 'rejected')}
                            className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60">
                            Confirm Reject
                          </button>
                        ) : (
                          <button onClick={() => setRejectingId(c.id)}
                            className="flex-1 border border-red-300 text-red-600 py-2 rounded-lg text-sm font-semibold hover:bg-red-50 transition-colors">
                            ❌ Reject
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* MOMs */}
            {activeTab === 'moms' && (
              <div className="space-y-4">
                {moms.length === 0 ? <div className="text-center text-gray-400 py-8">No pending MOMs.</div> : moms.map(m => (
                  <div key={m.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="bg-brand-50 px-5 py-3 flex items-center justify-between border-b border-brand-100">
                      <div>
                        <span className="font-bold text-brand-700">📋 {m.content.meetingTitle}</span>
                        <span className="text-xs text-gray-400 ml-2">v{m.version}</span>
                      </div>
                      <span className="text-xs text-gray-400">{m.meetings?.title}</span>
                    </div>
                    <div className="p-5 space-y-4">
                      <p className="text-gray-600 text-sm">{m.content.summary}</p>

                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Decisions',    items: m.content.decisions ?? [],    icon: '⚖️' },
                          { label: 'Action Items', items: m.content.actionItems ?? [],  icon: '📌' },
                          { label: 'Risks',        items: m.content.risks ?? [],        icon: '⚠️' },
                        ].map(s => (
                          <div key={s.label} className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs font-semibold text-gray-500 mb-2">{s.icon} {s.label} ({s.items.length})</div>
                            {s.items.slice(0, 2).map((item: { id?: string; description: string }, i: number) => (
                              <p key={i} className="text-xs text-gray-600 mb-1 line-clamp-2">{item.description}</p>
                            ))}
                            {s.items.length > 2 && <p className="text-xs text-gray-400">+{s.items.length - 2} more</p>}
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <button disabled={!!processing}
                          onClick={() => handleAction('mom', m.id, 'approved')}
                          className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-60">
                          {processing === m.id ? '…' : '✅ Approve MOM'}
                        </button>
                        <button disabled={!!processing}
                          onClick={() => { setRejectingId(m.id); handleAction('mom', m.id, 'rejected') }}
                          className="px-4 border border-red-300 text-red-600 py-2 rounded-lg text-sm font-semibold hover:bg-red-50 transition-colors">
                          ❌ Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
