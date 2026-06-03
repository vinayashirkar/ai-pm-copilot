/**
 * POST /api/generate-artifacts
 * From approved requirements → generate User Stories, ACs, Test Cases, and BRD content.
 * All using Gemini (free tier).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  generateUserStories,
  generateTestCases,
  generateBRDContent,
} from '@/lib/gemini'

export async function POST(req: NextRequest) {
  try {
    const { projectId, userId, generateFor } = await req.json()
    // generateFor: 'brd' | 'user_stories' | 'test_cases' | 'all'

    if (!projectId || !userId) {
      return NextResponse.json({ error: 'Missing projectId or userId' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    // Fetch approved requirements
    const { data: requirements } = await supabase
      .from('requirements')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })

    if (!requirements?.length) {
      return NextResponse.json({ error: 'No approved requirements found. Process and approve a transcript first.' }, { status: 400 })
    }

    const results: Record<string, unknown> = {}

    // ── Generate BRD ──────────────────────────────────────────────────────────
    if (generateFor === 'brd' || generateFor === 'all') {
      const brdContent = await generateBRDContent(
        requirements.map(r => ({ code: r.code, description: r.description, type: r.req_type })),
        project.name,
        project.description || ''
      )

      // Upsert BRD document
      const { data: existingBRD } = await supabase
        .from('documents')
        .select('id, version')
        .eq('project_id', projectId)
        .eq('type', 'BRD')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (existingBRD) {
        const [major, minor, patch] = (existingBRD.version || '1.0.0').split('.').map(Number)
        await supabase
          .from('documents')
          .update({ content: brdContent, version: `${major}.${minor + 1}.${patch}`, updated_at: new Date().toISOString() })
          .eq('id', existingBRD.id)
      } else {
        await supabase.from('documents').insert({
          project_id: projectId,
          type:       'BRD',
          title:      `${project.name} — Business Requirements Document`,
          content:    brdContent,
          version:    '1.0.0',
          status:     'draft',
          created_by: userId,
        })
      }

      results.brd = brdContent
    }

    // ── Generate User Stories + ACs ───────────────────────────────────────────
    if (generateFor === 'user_stories' || generateFor === 'all') {
      const { count: existingStoryCount } = await supabase
        .from('user_stories')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)

      let storyNumber = (existingStoryCount ?? 0) + 1
      const allStories: unknown[] = []

      for (const req of requirements.slice(0, 10)) { // limit to 10 reqs for free tier
        const stories = await generateUserStories(
          req.description,
          req.code,
          `${project.name}: ${project.description || ''}`,
          storyNumber
        )

        for (const story of stories) {
          const { data: savedStory } = await supabase
            .from('user_stories')
            .insert({
              requirement_id: req.id,
              project_id:     projectId,
              code:           story.code,
              role:           story.role,
              action:         story.action,
              benefit:        story.benefit,
              status:         'draft',
            })
            .select()
            .single()

          if (savedStory && story.acceptanceCriteria.length > 0) {
            await supabase.from('acceptance_criteria').insert(
              story.acceptanceCriteria.map(ac => ({
                story_id:   savedStory.id,
                given_step: ac.given,
                when_step:  ac.when,
                then_step:  ac.then,
              }))
            )
          }

          allStories.push({ ...savedStory, acceptanceCriteria: story.acceptanceCriteria })
          storyNumber++
        }
      }

      results.userStories = allStories
    }

    // ── Generate Test Cases ───────────────────────────────────────────────────
    if (generateFor === 'test_cases' || generateFor === 'all') {
      const { data: stories } = await supabase
        .from('user_stories')
        .select('*, acceptance_criteria(*)')
        .eq('project_id', projectId)
        .eq('status', 'draft')
        .order('created_at', { ascending: true })
        .limit(20) // free tier limit

      const { count: existingTCCount } = await supabase
        .from('test_cases')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)

      let tcNumber = (existingTCCount ?? 0) + 1
      const allTestCases: unknown[] = []

      for (const story of (stories ?? [])) {
        if (!story.acceptance_criteria?.length) continue

        const storyResult = {
          code:    story.code,
          role:    story.role,
          action:  story.action,
          benefit: story.benefit,
          acceptanceCriteria: story.acceptance_criteria.map((ac: { given_step: string; when_step: string; then_step: string }) => ({
            given: ac.given_step,
            when:  ac.when_step,
            then:  ac.then_step,
          })),
        }

        const testCases = await generateTestCases(storyResult, storyResult.acceptanceCriteria, tcNumber)

        for (const tc of testCases) {
          const { data: savedTC } = await supabase
            .from('test_cases')
            .insert({
              story_id:       story.id,
              project_id:     projectId,
              code:           tc.code,
              description:    tc.description,
              preconditions:  tc.preconditions,
              steps:          tc.steps,
              expected_result: tc.expectedResult,
              scenario_type:  tc.scenarioType,
              status:         'draft',
            })
            .select()
            .single()

          allTestCases.push(savedTC)
          tcNumber++
        }
      }

      results.testCases = allTestCases
    }

    // Notify PM
    await supabase.from('notifications').insert({
      user_id:    userId,
      project_id: projectId,
      type:       'doc_updated',
      title:      'Artifacts generated and ready for review',
      message:    `BRD, User Stories, and Test Cases have been generated for ${project.name}.`,
      link:       `/projects/${projectId}/documents`,
    })

    return NextResponse.json({ success: true, results })

  } catch (err: unknown) {
    console.error('[generate-artifacts]', err)
    const message = err instanceof Error ? err.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
