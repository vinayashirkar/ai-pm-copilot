import { GoogleGenerativeAI } from '@google/generative-ai'
import { safeParseJson } from './parsers'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
})

export interface Requirement {
  id: string
  description: string
  type: string
  priority: string
}

export interface MOMResult {
  meetingTitle: string
  date: string
  attendees: string[]
  agenda: string[]
  requirements: Requirement[]
  decisions: Array<{ id: string; description: string; owner: string }>
  actionItems: Array<{ id: string; description: string; owner: string; dueDate: string }>
  risks: Array<{ id: string; description: string; impact: string; mitigation: string }>
  assumptions: string[]
  dependencies: string[]
  openIssues: string[]
}

export interface RequirementChange {
  changeType: 'new' | 'modified' | 'removed'
  previousText: string
  proposedText: string
  sourceExcerpt: string
  impactedAreas: string[]
  rationale: string
  confidence: number
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
  steps: string[]
  expectedResult: string
  scenarioType: 'happy_path' | 'negative' | 'edge_case'
}

export interface WorkItem {
  type: 'epic' | 'feature' | 'story' | 'task'
  title: string
  description: string
  assignee: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  children?: WorkItem[]
}

export type UserStoryResultType = UserStoryResult

export async function processMeetingTranscript(transcript: string, projectContext: string, projectCode: string): Promise<MOMResult> {
  const prompt = `You are a senior PM. Analyze this transcript and extract a structured MOM.\n\nProject: ${projectCode} - ${projectContext}\n\nTranscript:\n${transcript}\n\nReturn ONLY valid JSON:\n{"meetingTitle":"string","date":"YYYY-MM-DD","attendees":[],"agenda":[],"requirements":[{"id":"REQ-001","description":"string","type":"functional","priority":"high"}],"decisions":[{"id":"D-1","description":"string","owner":"string"}],"actionItems":[{"id":"AI-1","description":"string","owner":"string","dueDate":"string"}],"risks":[{"id":"R-1","description":"string","impact":"High","mitigation":"string"}],"assumptions":[],"dependencies":[],"openIssues":[]}`
  const result = await model.generateContent(prompt)
  return safeParseJson<MOMResult>(result.response.text(), { meetingTitle: 'Untitled', date: new Date().toISOString().split('T')[0], attendees: [], agenda: [], requirements: [], decisions: [], actionItems: [], risks: [], assumptions: [], dependencies: [], openIssues: [] })
}

export async function detectRequirementChanges(newRequirements: string[], existingBRD: string, projectCode: string): Promise<RequirementChange[]> {
  if (!newRequirements.length) return []
  const prompt = `You are a BA. Compare new requirements against the existing BRD and identify changes.\n\nProject: ${projectCode}\n\nExisting BRD:\n${existingBRD}\n\nNew requirements:\n${newRequirements.join('\n')}\n\nReturn ONLY valid JSON array:\n[{"changeType":"new|modified|removed","previousText":"string","proposedText":"string","sourceExcerpt":"string","impactedAreas":["string"],"rationale":"string","confidence":0.9}]`
  const result = await model.generateContent(prompt)
  return safeParseJson<RequirementChange[]>(result.response.text(), [])
}

export async function generateUserStories(requirementDescription: string, requirementCode: string, projectContext: string, startNumber: number): Promise<UserStoryResult[]> {
  const prompt = `Generate 2-3 user stories for this requirement.\n\nProject: ${projectContext}\nRequirement ${requirementCode}: ${requirementDescription}\nStart numbering from US-${String(startNumber).padStart(3, '0')}\n\nReturn ONLY valid JSON array: [{"code":"US-001","role":"string","action":"string","benefit":"string","acceptanceCriteria":[{"given":"string","when":"string","then":"string"}]}]`
  const result = await model.generateContent(prompt)
  return safeParseJson<UserStoryResult[]>(result.response.text(), [])
}

export async function generateTestCases(story: UserStoryResult, acceptanceCriteria: Array<{ given: string; when: string; then: string }>, startNumber: number): Promise<TestCaseResult[]> {
  const prompt = `Generate test cases for this user story.\n\nStory ${story.code}: As a ${story.role}, I want to ${story.action} so that ${story.benefit}\nAC: ${JSON.stringify(acceptanceCriteria)}\nStart from TC-${String(startNumber).padStart(3, '0')}\n\nReturn ONLY valid JSON array: [{"code":"TC-001","description":"string","preconditions":"string","steps":["string"],"expectedResult":"string","scenarioType":"happy_path|negative|edge_case"}]`
  const result = await model.generateContent(prompt)
  return safeParseJson<TestCaseResult[]>(result.response.text(), [])
}

export async function generateBRDContent(requirements: Array<{ code: string; description: string; type: string }>, projectName: string, projectDescription: string): Promise<string> {
  const prompt = `Write a BRD for: ${projectName}\n${projectDescription}\n\nRequirements:\n${requirements.map(r => `${r.code} [${r.type}]: ${r.description}`).join('\n')}\n\nInclude: Executive Summary, Business Objectives, Scope, Functional Requirements, Non-Functional Requirements, Assumptions. Use markdown.`
  const result = await model.generateContent(prompt)
  return result.response.text()
}

export async function generateWorkItems(stories: UserStoryResult[], projectName: string, teamMembers: string[]): Promise<WorkItem[]> {
  const prompt = `Generate work item hierarchy (Epics > Features > Stories > Tasks) for these user stories.\n\nProject: ${projectName}\nTeam: ${teamMembers.join(', ') || 'Unassigned'}\nStories: ${JSON.stringify(stories.map(s => ({ code: s.code, role: s.role, action: s.action })))}\n\nReturn ONLY valid JSON array: [{"type":"epic","title":"string","description":"string","assignee":"string","priority":"high","children":[]}]`
  const result = await model.generateContent(prompt)
  return safeParseJson<WorkItem[]>(result.response.text(), [])
}
