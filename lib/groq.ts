/**
 * groq.ts
 * Groq + Llama 3.1 70B — ultra-fast responses for real-time feel
 * FREE TIER: 30 req/min · 14,400 req/day · No credit card needed
 * Get your key: https://console.groq.com
 *
 * Use Groq for: quick summaries, action item extraction, status checks,
 * short Q&A over documents — anything needing < 2 second response time.
 * Use Gemini for: deep analysis, long documents, BRD generation.
 */

import Groq from 'groq-sdk'
import { safeParseJson } from './parsers'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

// Llama 3.1 70B — best free model for instruction following
const MODEL = 'llama-3.1-70b-versatile'

// ── FAST OPERATIONS ──────────────────────────────────────────────────────────

/**
 * Generate a 3-bullet summary of a document section — < 1 second
 */
export async function quickSummary(text: string, maxWords = 100): Promise<string> {
  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: 'You are a concise summariser. Reply in plain text only, no markdown.',
      },
      {
        role: 'user',
        content: `Summarise this in ${maxWords} words or less, as 3 bullet points:\n\n${text}`,
      },
    ],
    model: MODEL,
    max_tokens: 256,
    temperature: 0.3,
  })
  return completion.choices[0]?.message?.content ?? ''
}

/**
 * Quick action item extraction from short text snippets — < 1 second
 */
export async function extractActionItems(
  text: string,
  projectCode: string,
  startingNumber: number
): Promise<Array<{ id: string; description: string; owner: string; dueDate: string }>> {
  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: 'You are a meeting analyst. Return ONLY valid JSON, no markdown.',
      },
      {
        role: 'user',
        content: `Extract action items from this text. Return JSON array:
[{"id": "${projectCode}-ACT-${String(startingNumber).padStart(3,'0')}", "description": "...", "owner": "...", "dueDate": "YYYY-MM-DD or TBD"}]

TEXT: ${text}`,
      },
    ],
    model: MODEL,
    max_tokens: 1024,
    temperature: 0.1,
  })
  const raw = completion.choices[0]?.message?.content ?? '[]'
  try { return safeParseJson(raw) } catch { return [] }
}

/**
 * Answer a quick question about a document — chatbot-style Q&A
 */
export async function askAboutDocument(
  question: string,
  documentContent: string
): Promise<string> {
  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: `You are an AI assistant with expertise in software product management.
Answer questions about the provided document concisely and accurately.
If the answer is not in the document, say so clearly.`,
      },
      {
        role: 'user',
        content: `DOCUMENT:\n${documentContent.slice(0, 4000)}\n\nQUESTION: ${question}`,
      },
    ],
    model: MODEL,
    max_tokens: 512,
    temperature: 0.3,
  })
  return completion.choices[0]?.message?.content ?? 'Unable to answer this question.'
}

/**
 * Classify a piece of text: is it a requirement, decision, risk, or action item?
 */
export async function classifyText(
  text: string
): Promise<{ type: 'requirement' | 'decision' | 'risk' | 'action_item' | 'other'; confidence: number }> {
  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: 'You are a requirements classifier. Return ONLY valid JSON, no markdown.',
      },
      {
        role: 'user',
        content: `Classify this text. Return: {"type": "requirement|decision|risk|action_item|other", "confidence": 0-100}
TEXT: ${text}`,
      },
    ],
    model: MODEL,
    max_tokens: 64,
    temperature: 0.1,
  })
  const raw = completion.choices[0]?.message?.content ?? '{}'
  try { return safeParseJson(raw) } catch { return { type: 'other', confidence: 0 } }
}

/**
 * Generate a notification message for a stakeholder
 */
export async function generateNotificationMessage(
  eventType: string,
  context: string
): Promise<string> {
  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: 'You write concise professional notifications for project management tools. Max 2 sentences.',
      },
      {
        role: 'user',
        content: `Write a notification for: ${eventType}\nContext: ${context}`,
      },
    ],
    model: MODEL,
    max_tokens: 128,
    temperature: 0.4,
  })
  return completion.choices[0]?.message?.content ?? ''
}

/**
 * Generate owner recommendations for work items based on team context
 */
export async function recommendOwner(
  taskDescription: string,
  teamMembers: string[]
): Promise<string> {
  if (teamMembers.length === 0) return 'TBD'
  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: 'You recommend task owners. Reply with just the name, no explanation.',
      },
      {
        role: 'user',
        content: `Team: ${teamMembers.join(', ')}\nTask: ${taskDescription}\nWho should own this?`,
      },
    ],
    model: MODEL,
    max_tokens: 32,
    temperature: 0.2,
  })
  return completion.choices[0]?.message?.content?.trim() ?? 'TBD'
}
