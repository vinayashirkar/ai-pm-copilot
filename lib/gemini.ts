/**
 * gemini.ts
 * Google Gemini 1.5 Flash — deep document analysis
 * FREE TIER: 1,500 req/day · 1M tokens/day · No credit card needed
 * Get your key: https://aistudio.google.com/app/apikey
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { safeParseJson } from './parsers'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Use Flash for speed + cost; switch to "gemini-1.5-pro" for higher accuracy
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
})

// ── TYPE DEFINITIONS ─────────────────────────────────────────────────────────

export interface MOMResult {
  meetingTitle: string
  date: string
  attendees: string[]
  agenda: string[]
  decisions: Array<{ id: string; description: string; owner: string }>
  actionItems: Array<{ id: string; description: string; owner: string; dueDate: string }>
  risks: Array<{ id: string; description: string; impact: string; mitigation: string }>
  assumptions: string[]
  dependencies: string[]
  openIssues: string[]
  requirements: Array<{ code: string; description: string; type: string }>
  summary: string
}

export interface ChangeDetection {
  changeType: 'ADDITION' | 'MODIFICATION' | 'DELETION' | 'CONFLICT'
  previousText: string | null
  proposedText: string
  sourceExcerpt: string
  rationale: string
  confidence: number
  impactedAreas: string[]
}

export interface UserStoryResult {
  code: string
  role: string
  action: string
  benefit: string
  acceptanceCriteria: Array<{ given: string; when: string; then: string }>
}

export interface TestCaseResult {
  code: string
  description: string
  preconditions: string
  steps: string
  expectedResult: string
  scenarioType: 'happy' | 'negative' | 'edge'
}

export interface WorkItemResult {
  type: 'epic' | 'feature' | 'story' | 'task'
  title: string
  description: string
  assignee: string
  priority: string
  children?: WorkItemResult[]
}

// ── CORE FUNCTIONS ────────────────────────────────────────────────────────────

/**
 * M1 — Process meeting transcript → structured MOM
 * Used for: deep transcript analysis (accuracy matters more than speed)
 */
export async function processMeetingTranscript(
  transcript: string,
  projectName: string,
  projectCode: string
): Promise<MOMResult> {
  const prompt = `You are a Senior Business Analyst specialising in software delivery projects.
Analyse this meeting transcript for the "${projectName}" project and extract all structured information.

TRANSCRIPT:
${transcript}

Return ONLY valid JSON (no markdown, no explanation) in exactly this format:
{
  "meetingTitle": "descriptive meeting title",
  "date": "extracted or estimated date (YYYY-MM-DD or 'Not specified')",
  "attendees": ["full name or role"],
  "agenda": ["agenda item 1"],
  "decisions": [{"id": "${projectCode}-DEC-001", "description": "clear decision made", "owner": "person responsible"}],
  "actionItems": [{"id": "${projectCode}-ACT-001", "description": "specific action", "owner": "assigned person", "dueDate": "YYYY-MM-DD or 'TBD'"}],
  "risks": [{"id": "${projectCode}-RSK-001", "description": "risk description", "impact": "High/Medium/Low", "mitigation": "mitigation strategy"}],
  "assumptions": ["assumption statement"],
  "dependencies": ["dependency statement"],
  "openIssues": ["unresolved issue"],
  "requirements": [{"code": "BR-001", "description": "specific business requirement extracted from discussion", "type": "functional"}],
  "summary": "2-3 sentence executive summary of the meeting"
}`

  const result = await model.generateContent(prompt)
  return safeParseJson<MOMResult>(result.response.text())
}

/**
 * M2 — Detect requirement changes vs existing BRD
 * Compares extracted requirements against the approved BRD baseline
 */
export async function detectRequirementChanges(
  newRequirements: string[],
  existingBRD: string,
  projectCode: string
): Promise<ChangeDetection[]> {
  if (!newRequirements.length) return []

  const prompt = `You are a Requirements Change Detection engine.
Compare these NEW requirements (from a recent meeting) against the EXISTING approved BRD.
Flag any additions, modifications, deletions, or conflicts.

EXISTING APPROVED BRD:
${existingBRD}

NEW REQUIREMENTS from recent meeting:
${newRequirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Return ONLY a JSON array of detected changes:
[
  {
    "changeType": "ADDITION|MODIFICATION|DELETION|CONFLICT",
    "previousText": "exact text from BRD (null for ADDITION)",
    "proposedText": "new requirement text",
    "sourceExcerpt": "exact quote from new requirements that triggered this",
    "rationale": "why this is classified as this change type",
    "confidence": 85,
    "impactedAreas": ["affected BRD section or user story codes"]
  }
]

Return [] if no changes are detected.`

  const result = await model.generateContent(prompt)
  return safeParseJson<ChangeDetection[]>(result.response.text())
}

/**
 * M2 — Generate User Stories + Acceptance Criteria from a BRD requirement
 */
export async function generateUserStories(
  requirement: string,
  requirementCode: string,
  projectContext: string,
  startingStoryNumber: number
): Promise<UserStoryResult[]> {
  const prompt = `You are a Senior Business Analyst writing Agile user stories.
Generate user stories with Gherkin acceptance criteria for this business requirement.

PROJECT CONTEXT: ${projectContext}
REQUIREMENT (${requirementCode}): ${requirement}

Generate 1-3 user stories (as many as logically needed). Return ONLY valid JSON:
[
  {
    "code": "US-${String(startingStoryNumber).padStart(3, '0')}",
    "role": "specific user role (e.g. Product Manager, Investor, AMC RM)",
    "action": "specific action they want to perform",
    "benefit": "specific business benefit",
    "acceptanceCriteria": [
      {
        "given": "system context / precondition",
        "when": "user action",
        "then": "expected system response / outcome"
      }
    ]
  }
]`

  const result = await model.generateContent(prompt)
  return safeParseJson<UserStoryResult[]>(result.response.text())
}

/**
 * M2 — Generate Test Cases from a User Story + Acceptance Criteria
 * Covers happy path, negative scenarios, and edge cases
 */
export async function generateTestCases(
  userStory: UserStoryResult,
  acceptanceCriteria: Array<{ given: string; when: string; then: string }>,
  startingTCNumber: number
): Promise<TestCaseResult[]> {
  const acText = acceptanceCriteria
    .map((ac, i) => `AC${i + 1}: Given ${ac.given} / When ${ac.when} / Then ${ac.then}`)
    .join('\n')

  const prompt = `You are a QA Lead. Generate comprehensive test cases for this user story.
Cover: happy path, negative scenarios (invalid input, unauthorized, missing data), and edge cases.

USER STORY: As a ${userStory.role}, I want to ${userStory.action} so that ${userStory.benefit}

ACCEPTANCE CRITERIA:
${acText}

Return ONLY valid JSON array (3-6 test cases):
[
  {
    "code": "TC-${String(startingTCNumber).padStart(3, '0')}",
    "description": "clear test description",
    "preconditions": "system state before test",
    "steps": "step 1; step 2; step 3",
    "expectedResult": "specific expected outcome",
    "scenarioType": "happy|negative|edge"
  }
]`

  const result = await model.generateContent(prompt)
  return safeParseJson<TestCaseResult[]>(result.response.text())
}

/**
 * M4 — Generate delivery work item hierarchy from approved user stories
 */
export async function generateWorkItems(
  userStories: UserStoryResult[],
  projectName: string,
  teamMembers: string[]
): Promise<WorkItemResult[]> {
  const storiesText = userStories
    .map(s => `${s.code}: As a ${s.role}, I want to ${s.action}`)
    .join('\n')

  const teamText = teamMembers.length > 0
    ? `Team: ${teamMembers.join(', ')}`
    : 'Team: (recommend generic roles)'

  const prompt = `You are a Project Manager creating a delivery work item hierarchy.
Group these user stories into Epics and Features, then recommend task owners.

PROJECT: ${projectName}
${teamText}

USER STORIES:
${storiesText}

Return ONLY valid JSON — an array of Epics, each with Features, each with Stories and Tasks:
[
  {
    "type": "epic",
    "title": "Epic name",
    "description": "Epic description",
    "assignee": "recommended owner",
    "priority": "high",
    "children": [
      {
        "type": "feature",
        "title": "Feature name",
        "description": "Feature description",
        "assignee": "recommended owner",
        "priority": "high",
        "children": [
          {
            "type": "story",
            "title": "Story title from US-XXX",
            "description": "As a...",
            "assignee": "recommended owner",
            "priority": "medium",
            "children": [
              {
                "type": "task",
                "title": "specific implementation task",
                "description": "what needs to be done",
                "assignee": "recommended owner or role",
                "priority": "medium"
              }
            ]
          }
        ]
      }
    ]
  }
]`

  const result = await model.generateContent(prompt)
  return safeParseJson<WorkItemResult[]>(result.response.text())
}

/**
 * Generate a BRD document structure from requirements extracted from meetings
 */
export async function generateBRDContent(
  requirements: Array<{ code: string; description: string; type: string }>,
  projectName: string,
  projectContext: string
): Promise<Record<string, unknown>> {
  const reqText = requirements
    .map(r => `${r.code} [${r.type}]: ${r.description}`)
    .join('\n')

  const prompt = `You are a Senior Business Analyst writing a Business Requirements Document.
Structure these requirements into a formal BRD for the ${projectName} project.

CONTEXT: ${projectContext}

REQUIREMENTS:
${reqText}

Return ONLY valid JSON:
{
  "overview": "project overview paragraph",
  "objectives": ["business objective 1"],
  "scope": {"inScope": ["item"], "outOfScope": ["item"]},
  "stakeholders": [{"role": "Product Manager", "responsibility": "..."}],
  "functionalRequirements": [{"code": "BR-001", "title": "...", "description": "...", "priority": "High"}],
  "nonFunctionalRequirements": [{"code": "BR-NFR-001", "category": "Performance", "requirement": "..."}],
  "constraints": ["constraint"],
  "assumptions": ["assumption"],
  "risks": [{"risk": "...", "impact": "High", "mitigation": "..."}],
  "approvalWorkflow": "description of approval process",
  "glossary": [{"term": "...", "definition": "..."}]
}`

  const result = await model.generateContent(prompt)
  return safeParseJson<Record<string, unknown>>(result.response.text())
}
