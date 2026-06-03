/**
 * parsers.ts
 * Extract plain text from TXT, DOCX, and PDF files.
 * All free — no external service calls.
 */

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.txt') || name.endsWith('.srt')) {
    return await file.text()
  }

  if (name.endsWith('.docx')) {
    return await extractFromDocx(file)
  }

  if (name.endsWith('.pdf')) {
    return await extractFromPdf(file)
  }

  throw new Error(`Unsupported file type: ${file.name}. Please upload TXT, DOCX, or PDF.`)
}

async function extractFromDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const buffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  return result.value
}

async function extractFromPdf(file: File): Promise<string> {
  // For server-side PDF parsing — client sends file to /api/parse-file
  // This is called server-side from the API route
  const pdfParse = (await import('pdf-parse')).default
  const buffer = Buffer.from(await file.arrayBuffer())
  const data = await pdfParse(buffer)
  return data.text
}

// Chunk text into segments for processing (respects token limits)
export function chunkText(text: string, maxChars = 12000): string[] {
  if (text.length <= maxChars) return [text]
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    let end = start + maxChars
    // Try to break at a paragraph boundary
    const nearEnd = text.lastIndexOf('\n\n', end)
    if (nearEnd > start + maxChars * 0.5) end = nearEnd
    chunks.push(text.slice(start, end).trim())
    start = end
  }
  return chunks.filter(c => c.length > 0)
}

// Generate a sequential code like BR-001, US-007, TC-023
export function generateCode(prefix: string, existingCount: number): string {
  return `${prefix}-${String(existingCount + 1).padStart(3, '0')}`
}

// Safely parse JSON from AI response (handles markdown code fences)
export function safeParseJson<T>(text: string): T {
  const clean = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()
  const start = clean.indexOf('{') !== -1 ? clean.indexOf('{') : clean.indexOf('[')
  const end = clean.lastIndexOf('}') !== -1 ? clean.lastIndexOf('}') : clean.lastIndexOf(']')
  if (start === -1 || end === -1) throw new Error('No JSON found in AI response')
  return JSON.parse(clean.slice(start, end + 1)) as T
}
