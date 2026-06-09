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
  model: 'gemini-2.0-flash'
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
