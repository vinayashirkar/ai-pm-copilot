/**
 * POST /api/approve
 * PM approves, rejects, or modifies a pending change (MOM or change detection).
 * Every action is written to the immutable audit log.
 * This is the HUMAN APPROVAL GATE — nothing commits without this.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      entityType,   // 'mom' | 'change_detection'
      entityId,     // UUID of the entity
      action,       // 'approved' | 'rejected' | 'modified'
      userId,
      userEmail,
      reason,       // required for 'rejected'
      modifiedText, // for 'modified' — the PM's edited version
    } = body

    if (!entityType || !entityId || !action || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['approved', 'rejected', 'modified'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const now = new Date().toISOString()

    // ── Process the approval ──────────────────────────────────────────────────

    if (entityType === 'mom') {
      const updateData: Record<string, unknown> = {
        status:      action,
        approved_by: userId,
        approved_at: now,
      }
      if (action === 'modified' && modifiedText) {
        updateData.content = modifiedText
      }
      await supabase.from('moms').update(updateData).eq('id', entityId)

    } else if (entityType === 'change_detection') {
      const updateData: Record<string, unknown> = {
        status:      action,
        reviewed_by: userId,
        reviewed_at: now,
      }
      if (action === 'rejected') updateData.reject_reason = reason || 'No reason provided'
      if (action === 'modified' && modifiedText) updateData.proposed_text = modifiedText

      await supabase.from('change_detections').update(updateData).eq('id', entityId)

      // If approved, trigger document update
      if (action === 'approved') {
        const { data: change } = await supabase
          .from('change_detections')
          .select('*, meetings(project_id)')
          .eq('id', entityId)
          .single()

        if (change) {
          // For ADDITION — insert new requirement
          if (change.change_type === 'ADDITION') {
            const { count } = await supabase
              .from('requirements')
              .select('*', { count: 'exact', head: true })
              .eq('project_id', change.project_id)

            // Ensure BRD document exists
            let { data: doc } = await supabase
              .from('documents')
              .select('id')
              .eq('project_id', change.project_id)
              .eq('type', 'BRD')
              .order('created_at', { ascending: false })
              .limit(1)
              .single()

            if (!doc) {
              const { data: newDoc } = await supabase
                .from('documents')
                .insert({
                  project_id: change.project_id,
                  type:       'BRD',
                  title:      'Business Requirements Document',
                  status:     'approved',
                  created_by: userId,
                })
                .select()
                .single()
              doc = newDoc
            }

            if (doc) {
              await supabase.from('requirements').insert({
                document_id: doc.id,
                project_id:  change.project_id,
                code:        `BR-${String((count ?? 0) + 1).padStart(3, '0')}`,
                title:       change.proposed_text.slice(0, 80),
                description: change.proposed_text,
                status:      'active',
              })
            }
          }

          // For MODIFICATION — update the existing requirement
          if (change.change_type === 'MODIFICATION' && change.requirement_id) {
            await supabase
              .from('requirements')
              .update({ description: modifiedText || change.proposed_text, status: 'active' })
              .eq('id', change.requirement_id)
          }

          // For DELETION — deprecate the requirement
          if (change.change_type === 'DELETION' && change.requirement_id) {
            await supabase
              .from('requirements')
              .update({ status: 'deprecated' })
              .eq('id', change.requirement_id)
          }
        }
      }
    }

    // ── Write to audit log (immutable) ────────────────────────────────────────
    await supabase.from('audit_logs').insert({
      entity_type: entityType,
      entity_id:   entityId,
      action,
      actor_id:    userId,
      actor_email: userEmail,
      reason:      reason || null,
      metadata: {
        modifiedText: modifiedText || null,
        timestamp:    now,
      },
    })

    return NextResponse.json({ success: true, action, entityId })

  } catch (err: unknown) {
    console.error('[approve]', err)
    const message = err instanceof Error ? err.message : 'Approval failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
