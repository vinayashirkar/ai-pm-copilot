'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

type Stage = 'idle' | 'uploading' | 'parsing' | 'analysing' | 'detecting' | 'done' | 'error'

const STAGES: Record<Stage, string> = {
  idle:       '',
  uploading:  'Uploading transcript…',
  parsing:    'Extracting text from file…',
  analysing:  'Gemini AI analysing transcript…',
  detecting:  'Detecting requirement changes…',
  done:       'Processing complete!',
  error:      'An error occurred.',
}

export default function UploadPage() {
  const params  = useParams()
  const router  = useRouter()
  const supabase = createClient()
  const projectId = params.id as string

  const [file, setFile]       = useState<File | null>(null)
  const [stage, setStage]     = useState<Stage>('idle')
  const [result, setResult]   = useState<{ mom: Record<string, unknown>; changesCount: number; meetingId: string } | null>(null)
  const [error, setError]     = useState('')
  const [dragging, setDragging] = useState(false)

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }, [])

  async function handleProcess() {
    if (!file) return
    setStage('uploading'); setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      setStage('parsing')
      const formData = new FormData()
      formData.append('file', file)
      formData.append('projectId', projectId)
      formData.append('userId', user.id)

      setStage('analysing')
      const res = await fetch('/api/process-transcript', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Processing failed')

      setStage('done')
      setResult({ mom: data.mom, changesCount: data.changesCount, meetingId: data.meetingId })

    } catch (err: unknown) {
      setStage('error')
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex items-center gap-3">
        <Link href={`/projects/${projectId}`} className="text-brand-500 text-sm hover:underline">← Back to Project</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-semibold text-gray-700">Upload Transcript</span>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <span className="text-5xl mb-3 block">📋</span>
          <h1 className="text-2xl font-bold text-gray-800">Upload Meeting Transcript</h1>
          <p className="text-gray-400 mt-2">Supports TXT, DOCX, PDF, and SRT files. Processed by Gemini AI — free.</p>
        </div>

        {stage === 'idle' || stage === 'error' ? (
          <>
            {/* Drop zone */}
            <div
              onDrop={onDrop}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onClick={() => document.getElementById('file-input')?.click()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                dragging ? 'border-brand-500 bg-brand-50' : 'border-gray-300 hover:border-brand-500 hover:bg-brand-50'
              }`}
            >
              <input
                id="file-input" type="file" className="hidden"
                accept=".txt,.docx,.pdf,.srt"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div>
                  <span className="text-4xl mb-2 block">📄</span>
                  <p className="font-semibold text-gray-800">{file.name}</p>
                  <p className="text-gray-400 text-sm mt-1">{(file.size / 1024).toFixed(1)} KB — Click to change</p>
                </div>
              ) : (
                <div>
                  <span className="text-4xl mb-2 block">📁</span>
                  <p className="font-semibold text-gray-700">Drop transcript here or click to browse</p>
                  <p className="text-gray-400 text-sm mt-1">TXT · DOCX · PDF · SRT</p>
                </div>
              )}
            </div>

            {error && <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

            {/* Tips */}
            <div className="mt-6 bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
              <p className="font-semibold mb-2">💡 Tips for best results:</p>
              <ul className="space-y-1 text-blue-700">
                <li>• Export transcript from Teams/Zoom as TXT or DOCX</li>
                <li>• Include speaker labels for better action item attribution</li>
                <li>• Longer transcripts are auto-chunked — no size limit</li>
              </ul>
            </div>

            <button
              onClick={handleProcess} disabled={!file}
              className="w-full mt-6 bg-brand-700 text-white py-3 rounded-xl font-semibold hover:bg-brand-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {file ? '🚀 Process with Gemini AI' : 'Select a file to continue'}
            </button>
          </>
        ) : stage === 'done' && result ? (
          // Results
          <div className="fade-in space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
              <span className="text-3xl mb-2 block">✅</span>
              <h2 className="font-bold text-green-800 text-lg">Processing Complete!</h2>
              <p className="text-green-700 text-sm mt-1">
                MOM generated · {result.changesCount} requirement change(s) detected
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-3">📋 MOM Summary</h3>
              <p className="text-gray-600 text-sm mb-3">{(result.mom as { summary?: string }).summary}</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: 'Decisions',    value: ((result.mom as { decisions?: unknown[] }).decisions ?? []).length },
                  { label: 'Action Items', value: ((result.mom as { actionItems?: unknown[] }).actionItems ?? []).length },
                  { label: 'Risks',        value: ((result.mom as { risks?: unknown[] }).risks ?? []).length },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xl font-bold text-brand-700">{s.value}</div>
                    <div className="text-xs text-gray-500">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {result.changesCount > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
                <span className="text-2xl">⚡</span>
                <div>
                  <p className="font-semibold text-orange-800">{result.changesCount} Requirement Change(s) Need Review</p>
                  <p className="text-orange-600 text-sm">Go to Review Queue to approve or reject each change</p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Link href={`/projects/${projectId}/review`}
                className="flex-1 bg-brand-700 text-white py-2.5 rounded-xl font-semibold hover:bg-brand-500 transition-colors text-center">
                Go to Review Queue →
              </Link>
              <button onClick={() => { setStage('idle'); setFile(null); setResult(null) }}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition-colors">
                Upload Another
              </button>
            </div>
          </div>
        ) : (
          // Processing spinner
          <div className="text-center py-12 fade-in">
            <div className="relative inline-block mb-6">
              <div className="w-20 h-20 border-4 border-brand-100 border-t-brand-500 rounded-full animate-spin"/>
              <span className="absolute inset-0 flex items-center justify-center text-2xl">🤖</span>
            </div>
            <p className="font-semibold text-gray-800 text-lg">{STAGES[stage]}</p>
            <p className="text-gray-400 text-sm mt-2">This takes 20–60 seconds depending on transcript length</p>
            <div className="flex justify-center gap-2 mt-6">
              {(['uploading', 'parsing', 'analysing', 'detecting'] as Stage[]).map((s, i) => (
                <div key={s} className={`h-2 rounded-full transition-all ${
                  stage === s ? 'w-8 bg-brand-500' : i < ['uploading','parsing','analysing','detecting'].indexOf(stage) ? 'w-2 bg-brand-300' : 'w-2 bg-gray-200'
                }`}/>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
