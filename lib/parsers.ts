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

// Safely parse JSON from AI response (handles markdown code fences and extra text)
export function safeParseJson<T>(text: string): T {
  // Strip markdown code fences
  let clean = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  // Find the outermost JSON object or array
  const objStart = clean.indexOf('{')
  const arrStart = clean.indexOf('[')
  let start = -1

  if (objStart === -1 && arrStart === -1) throw new Error('No JSON found in AI response')

  if (objStart === -1) start = arrStart
  else if (arrStart === -1) start = objStart
  else start = Math.min(objStart, arrStart)

  const isArray = start === arrStart && (objStart === -1 || arrStart < objStart)
  const end = isArray ? clean.lastIndexOf(']') : clean.lastIndexOf('}')

  if (end === -1 || end < start) throw new Error('Malformed JSON in AI response')

  return JSON.parse(clean.slice(start, end + 1)) as T
}
