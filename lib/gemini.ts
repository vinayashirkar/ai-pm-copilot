/**
 * gemini.ts
 * Google Gemini 2.0 Flash — deep document analysis
 * FREE TIER: 1,500 req/day · 1M tokens/day · No credit card needed
 * Get your key: https://aistudio.google.com/app/apikey
 */




import { GoogleGenerativeAI } from '@google/generative-ai'
import { safeParseJson } from './parsers'




const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)




// Use Flash for speed + cost; switch to "gemini-2.0-flash-exp" for higher accuracy
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
})




// ── TYPE DEFINITIONS ─────────────────────────────────────────────────────────




export interface MOMResult {
  meetingTitle: string
  date: string
  attendees: string[]
    dependencies: string[]
    openIssues: string[]
}

export interface RequirementChange {
    type: 'new' | 'modified' | 'removed'
    requirement: string
    details: string
}

// ── MAIN FUNCTIONS ───────────────────────────────────────────────────────────

export async function processMeetingTranscript(
    transcript: string,
    projectContext: string
  ): Promise<MOMResult> {
    const prompt = `You are a senior product manager. Analyze this meeting transcript and extract a structured MOM.

    Project context: ${projectContext}

    Transcript:
    ${transcript}

    Return ONLY valid JSON matching this structure:
    {
      "meetingTitle": "string",
        "date": "string",
          "attendees": ["string"],
            "agenda": ["string"],
              "decisions": [{"id": "D-1", "description": "string", "owner": "string"}],
                "actionItems": [{"id": "AI-1", "description": "string", "owner": "string", "dueDate": "string"}],
                  "risks": [{"id": "R-1", "description": "string", "impact": "High|Medium|Low", "mitigation": "string"}],
                    "assumptions": ["string"],
                      "dependencies": ["string"],
                        "openIssues": ["string"]
                        }`

    const result = await model.generateContent(prompt)
    const text = result.response.text()
    return safeParseJson<MOMResult>(text, {
          meetingTitle: 'Untitled Meeting',
          date: new Date().toISOString().split('T')[0],
          attendees: [],
          agenda: [],
          decisions: [],
          actionItems: [],
          risks: [],
          assumptions: [],
          dependencies: [],
          openIssues: [],
    })
}

export async function detectRequirementChanges(
    transcript: string,
    existingRequirements: string[]
  ): Promise<RequirementChange[]> {
    if (existingRequirements.length === 0) return []

    const prompt = `Compare this meeting transcript against existing requirements and identify changes.

    Existing requirements:
    ${existingRequirements.join('\n')}

    Transcript:
    ${transcript}

    Return ONLY valid JSON array:
    [{"type": "new|modified|removed", "requirement": "string", "details": "string"}]`

    const result = await model.generateContent(prompt)
    const text = result.response.text()
    return safeParseJson<RequirementChange[]>(text, [])
}
  
