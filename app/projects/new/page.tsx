'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewProject() {
  const [name, setName]           = useState('')
  const [code, setCode]           = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const router  = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const { data, error } = await supabase
      .from('projects')
      .insert({ name, code: code.toUpperCase(), description, owner_id: user.id })
      .select()
      .single()

    if (error) { setError(error.message); setLoading(false); return }
    router.push(`/projects/${data.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="mb-6">
          <Link href="/dashboard" className="text-brand-500 text-sm hover:underline">← Back to Dashboard</Link>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">📁</span>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Create New Project</h1>
              <p className="text-gray-400 text-sm">Set up a project to start uploading transcripts</p>
            </div>
          </div>

          {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
              <input
                required value={name} onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                placeholder="e.g. Investor Onboarding Platform"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Code * <span className="text-gray-400 font-normal">(2-5 letters, used in requirement IDs)</span></label>
              <input
                required value={code}
                onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm font-mono"
                placeholder="e.g. IOP"
                maxLength={5}
              />
              <p className="text-xs text-gray-400 mt-1">Requirements will be numbered: {code || 'IOP'}-BR-001, {code || 'IOP'}-US-001, etc.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description} onChange={e => setDescription(e.target.value)} rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm resize-none"
                placeholder="Brief description of this project (helps AI generate better context)"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full bg-brand-700 text-white py-2.5 rounded-lg font-semibold hover:bg-brand-500 transition-colors disabled:opacity-60"
            >
              {loading ? 'Creating…' : 'Create Project'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
