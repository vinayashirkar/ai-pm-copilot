/**
 * POST /api/export-delivery
 * Generate Epics/Features/Stories/Tasks from approved docs.
 * Export as Jira CSV or Azure DevOps JSON.
 * Uses Gemini for work item generation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateWorkItems } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  try {
    const { projectId, userId, format, teamMembers } = await req.json()
    // format: 'jira_csv' | 'ado_json' | 'generate_only'

    if (!projectId || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    // Fetch approved user stories
    const { data: stories } = await supabase
      .from('user_stories')
      .select('*')
      .eq('project_id', projectId)
      .in('status', ['draft', 'approved'])
      .order('created_at', { ascending: true })

    if (!stories?.length) {
      return NextResponse.json({ error: 'No user stories found. Generate artifacts first.' }, { status: 400 })
    }

    // Generate work item hierarchy using Gemini
    const storyResults = stories.map(s => ({
      code: s.code, role: s.role, action: s.action, benefit: s.benefit, acceptanceCriteria: [],
    }))

    const workItems = await generateWorkItems(
      storyResults,
      project.name,
      teamMembers ?? []
    )

    // Persist to database
    const savedItems: unknown[] = []
    let itemCode = 1

    async function saveItem(item: typeof workItems[0], parentId: string | null) {
      const { data: saved } = await supabase
        .from('work_items')
        .insert({
          project_id:  projectId,
          parent_id:   parentId,
          item_type:   item.type,
          code:        `${project.code}-WI-${String(itemCode++).padStart(3, '0')}`,
          title:       item.title,
          description: item.description,
          assignee:    item.assignee,
          priority:    item.priority,
          status:      'backlog',
        })
        .select()
        .single()

      if (saved) {
        savedItems.push(saved)
        for (const child of item.children ?? []) {
          await saveItem(child, saved.id)
        }
      }
    }

    for (const item of workItems) await saveItem(item, null)

    // ── Export to requested format ─────────────────────────────────────────────

    if (format === 'jira_csv') {
      // Jira-compatible CSV
      const headers = ['Issue Type', 'Summary', 'Description', 'Assignee', 'Priority', 'Epic Link']
      const rows = (savedItems as Array<{ item_type: string; title: string; description: string; assignee: string; priority: string; code: string }>).map(i => [
        i.item_type === 'epic'    ? 'Epic'    :
        i.item_type === 'feature' ? 'Story'   :
        i.item_type === 'story'   ? 'Story'   : 'Sub-task',
        `"${(i.title ?? '').replace(/"/g, '""')}"`,
        `"${(i.description ?? '').replace(/"/g, '""')}"`,
        i.assignee ?? '',
        i.priority === 'critical' ? 'Highest' :
        i.priority === 'high'     ? 'High'    :
        i.priority === 'medium'   ? 'Medium'  : 'Low',
        i.item_type === 'story' ? project.code : '',
      ])

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${project.code}-jira-import.csv"`,
        },
      })
    }

    if (format === 'ado_json') {
      // Azure DevOps JSON format
      const adoItems = (savedItems as Array<{ item_type: string; title: string; description: string; assignee: string; priority: string }>).map(i => ({
        'System.WorkItemType':
          i.item_type === 'epic'    ? 'Epic'           :
          i.item_type === 'feature' ? 'Feature'        :
          i.item_type === 'story'   ? 'User Story'     : 'Task',
        'System.Title':       i.title,
        'System.Description': i.description,
        'System.AssignedTo':  i.assignee,
        'Microsoft.VSTS.Common.Priority':
          i.priority === 'critical' ? '1' :
          i.priority === 'high'     ? '2' :
          i.priority === 'medium'   ? '3' : '4',
      }))

      return new NextResponse(JSON.stringify(adoItems, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${project.code}-ado-import.json"`,
        },
      })
    }

    // Default: return JSON
    return NextResponse.json({ success: true, workItems: savedItems, total: savedItems.length })

  } catch (err: unknown) {
    console.error('[export-delivery]', err)
    const message = err instanceof Error ? err.message : 'Export failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
