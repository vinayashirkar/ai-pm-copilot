/**
 * POST /api/process-transcript
 * Accepts a transcript file + project context.
 * Returns: MOM, detected requirement changes, action items.
 * Uses Gemini (deep analysis) — free tier.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { processMeetingTranscript, detectRequirementChanges } from '@/lib/gemini'
import { chunkText, generateCode } from '@/lib/parsers'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file       = formData.get('file') as File
    const projectId  = formData.get('projectId') as string
    const userId     = formData.get('userId') as string

    if (!file || !projectId || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // ── 1. Fetch project context ──────────────────────────────────────────────
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // ── 2. Extract text from uploaded file ───────────────────────────────────
    let transcriptText = ''
    const fileName = file.name.toLowerCase()

    if (fileName.endsWith('.txt') || fileName.endsWith('.srt')) {
      transcriptText = await file.text()
    } else if (fileName.endsWith('.docx')) {
      const mammoth = await import('mammoth')
      const buffer  = await file.arrayBuffer()
      const result  = await mammoth.extractRawText({ arrayBuffer: buffer })
      transcriptText = result.value
    } else if (fileName.endsWith('.pdf')) {
      const pdfParse = (await import('pdf-parse')).default
      const buffer   = Buffer.from(await file.arrayBuffer())
      const data     = await pdfParse(buffer)
      transcriptText = data.text
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Upload TXT, DOCX, or PDF.' }, { status: 400 })
    }

    if (!transcriptText.trim()) {
      return NextResponse.json({ error: 'Could not extract text from file.' }, { status: 400 })
    }

    // ── 3. Upload to Supabase Storage ────────────────────────────────────────
    const storageKey = `${userId}/${projectId}/${Date.now()}-${file.name}`
    const fileBuffer = await file.arrayBuffer()
    await supabase.storage.from('transcripts').upload(storageKey, fileBuffer, {
      contentType: file.type || 'application/octet-stream',
    })

    // ── 4. Create meeting record ─────────────────────────────────────────────
    const { data: meeting } = await supabase
      .from('meetings')
      .insert({
        project_id:      projectId,
        title:           `Processing: ${file.name}`,
        transcript_text: transcriptText.slice(0, 50000), // store first 50k chars
        transcript_url:  storageKey,
        file_name:       file.name,
        status:          'processing',
        created_by:      userId,
      })
      .select()
      .single()

    if (!meeting) {
      return NextResponse.json({ error: 'Failed to create meeting record' }, { status: 500 })
    }

    // ── 5. Process with Gemini (chunked if large) ────────────────────────────
    const chunks = chunkText(transcriptText)
    let momResult: Awaited<ReturnType<typeof processMeetingTranscript>>

    if (chunks.length === 1) {
      momResult = await processMeetingTranscript(transcriptText, project.name, project.code)
    } else {
      // For long transcripts: process first chunk for structure, append others for requirements
      momResult = await processMeetingTranscript(chunks[0], project.name, project.code)
      // Process remaining chunks for additional requirements
      for (let i = 1; i < Math.min(chunks.length, 3); i++) {
        const extra = await processMeetingTranscript(chunks[i], project.name, project.code)
        momResult.requirements.push(...extra.requirements)
        momResult.actionItems.push(...extra.actionItems)
        momResult.decisions.push(...extra.decisions)
      }
    }

    // Update meeting title from extracted data
    await supabase
      .from('meetings')
      .update({ title: momResult.meetingTitle || file.name, meeting_date: momResult.date || null })
      .eq('id', meeting.id)

    // ── 6. Save MOM ───────────────────────────────────────────────────────────
    const { data: mom } = await supabase
      .from('moms')
      .insert({ meeting_id: meeting.id, content: momResult, status: 'pending' })
      .select()
      .single()

    // ── 7. Change detection against existing BRD ─────────────────────────────
    const { data: existingDoc } = await supabase
      .from('documents')
      .select('content')
      .eq('project_id', projectId)
      .eq('type', 'BRD')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    let changes: Awaited<ReturnType<typeof detectRequirementChanges>> = []
    let savedChanges: unknown[] = []

    if (existingDoc?.content && momResult.requirements.length > 0) {
      const brdText = JSON.stringify(existingDoc.content, null, 2).slice(0, 8000)
      const newReqs = momResult.requirements.map(r => r.description)
      changes = await detectRequirementChanges(newReqs, brdText, project.code)

      // Save each detected change
      if (changes.length > 0) {
        const changeRecords = changes.map(c => ({
          meeting_id:      meeting.id,
          project_id:      projectId,
          change_type:     c.changeType,
          previous_text:   c.previousText,
          proposed_text:   c.proposedText,
          source_excerpt:  c.sourceExcerpt,
          impact:          { impactedAreas: c.impactedAreas, rationale: c.rationale },
          confidence:      c.confidence,
          status:          'pending',
        }))

        const { data: saved } = await supabase
          .from('change_detections')
          .insert(changeRecords)
          .select()
        savedChanges = saved ?? []
      }
    }

    // ── 8. Create notification ────────────────────────────────────────────────
    await supabase.from('notifications').insert({
      user_id:    userId,
      project_id: projectId,
      type:       'approval_needed',
      title:      `MOM ready for review — ${momResult.meetingTitle}`,
      message:    `${changes.length} requirement change(s) detected. ${momResult.actionItems.length} action item(s) extracted.`,
      link:       `/projects/${projectId}/review`,
    })

    // ── 9. Mark meeting as processed ─────────────────────────────────────────
    await supabase.from('meetings').update({ status: 'reviewed' }).eq('id', meeting.id)

    return NextResponse.json({
      success:    true,
      meetingId:  meeting.id,
      momId:      mom?.id,
      mom:        momResult,
      changes:    savedChanges,
      changesCount: changes.length,
    })

  } catch (err: unknown) {
    console.error('[process-transcript]', err)
    const message = err instanceof Error ? err.message : 'Processing failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
