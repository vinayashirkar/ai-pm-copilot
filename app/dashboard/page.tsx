'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Project { id: string; name: string; code: string; description: string; status: string; created_at: string }
interface Notification { id: string; title: string; message: string; link: string; is_read: boolean; type: string; created_at: string }

export default function Dashboard() {
  const [user, setUser]             = useState<{ id: string; email?: string } | null>(null)
  const [projects, setProjects]     = useState<Project[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [pendingChanges, setPendingChanges] = useState(0)
  const [loading, setLoading]       = useState(true)
  const router  = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUser(user)

      const [{ data: proj }, { data: notifs }, { count }] = await Promise.all([
        supabase.from('projects').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
        supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('change_detections').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ])

      setProjects(proj ?? [])
      setNotifications(notifs ?? [])
      setPendingChanges(count ?? 0)
      setLoading(false)
    }
    load()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
        <p className="text-gray-500">Loading your workspace…</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🤖</span>
          <span className="font-bold text-brand-700 text-lg">AI-PM Copilot</span>
        </div>
        <div className="flex items-center gap-4">
          {pendingChanges > 0 && (
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"/>
              <span className="text-orange-700 text-sm font-semibold">{pendingChanges} changes pending review</span>
            </div>
          )}
          <span className="text-sm text-gray-500">{user?.email}</span>
          <button onClick={signOut} className="text-sm text-gray-400 hover:text-gray-600">Sign out</button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Projects',        value: projects.length,                  icon: '📁', color: 'bg-blue-50 text-blue-700' },
            { label: 'Pending Reviews', value: pendingChanges,                   icon: '⏳', color: 'bg-orange-50 text-orange-700' },
            { label: 'Notifications',   value: notifications.filter(n => !n.is_read).length, icon: '🔔', color: 'bg-purple-50 text-purple-700' },
            { label: 'AI Cost',         value: '$0',                             icon: '💰', color: 'bg-green-50 text-green-700' },
          ].map(s => (
            <div key={s.label} className={`${s.color} rounded-xl p-4 flex items-center gap-3`}>
              <span className="text-2xl">{s.icon}</span>
              <div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs font-medium opacity-80">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-8">
          {/* Projects */}
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">Your Projects</h2>
              <Link href="/projects/new"
                className="bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-500 transition-colors">
                + New Project
              </Link>
            </div>

            {projects.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
                <span className="text-5xl mb-3 block">📋</span>
                <h3 className="font-semibold text-gray-700 mb-2">No projects yet</h3>
                <p className="text-gray-400 text-sm mb-4">Create your first project to start uploading transcripts</p>
                <Link href="/projects/new" className="bg-brand-700 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-brand-500 transition-colors">
                  Create First Project
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map(p => (
                  <Link key={p.id} href={`/projects/${p.id}`}
                    className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between hover:border-brand-500 hover:shadow-sm transition-all group">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-brand-50 text-brand-700 text-xs font-bold px-2 py-0.5 rounded">{p.code}</span>
                        <h3 className="font-semibold text-gray-800 group-hover:text-brand-700">{p.name}</h3>
                      </div>
                      {p.description && <p className="text-gray-400 text-sm">{p.description}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.status}
                      </span>
                      <span className="text-gray-300 group-hover:text-brand-500">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Notifications */}
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-4">Recent Notifications</h2>
            {notifications.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
                No notifications yet
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map(n => (
                  <Link key={n.id} href={n.link || '#'}
                    className={`block bg-white rounded-lg border p-3 hover:border-brand-500 transition-colors ${!n.is_read ? 'border-blue-200 bg-blue-50' : 'border-gray-200'}`}>
                    <div className="flex items-start gap-2">
                      <span>{n.type === 'approval_needed' ? '⚡' : n.type === 'change_detected' ? '🔍' : '✅'}</span>
                      <div>
                        <p className="text-xs font-semibold text-gray-800">{n.title}</p>
                        {n.message && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
