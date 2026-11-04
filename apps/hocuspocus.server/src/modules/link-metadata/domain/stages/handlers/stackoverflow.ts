import { plural } from '../../../../../lib/cardText'
import { safeFetch } from '../../ssrf'
import { type Fact, LINK_PREVIEW_USER_AGENT, type SpecialMiss, type StageResult } from '../../types'
import { readApiJson } from './readApiJson'

const QUESTION_PATH = /^\/questions\/(\d{1,12})(?:\/|$)/
// Stack Exchange's own error ids: throttle_violation, internal_error, temporarily_unavailable.
// The API sends every error, a throttle included, as HTTP 400 with one of them.
const THROTTLE_ERROR = 502
const SERVER_ERRORS = [500, 503]

export const matchesStackOverflow = (host: string, path: string): string | null => {
  if (host !== 'stackoverflow.com' && host !== 'www.stackoverflow.com') return null
  return QUESTION_PATH.exec(path)?.[1] ?? null
}

interface QuestionsJson {
  items?: Array<{
    title?: string
    answer_count?: number
    accepted_answer_id?: number
  }>
  error_id?: number
}

const questionFacts = (answers: unknown, accepted: unknown): Fact[] => {
  const facts: Fact[] = []
  if (typeof answers === 'number' && answers >= 0) {
    facts.push({ icon: 'answers', text: `${answers} ${plural(answers, 'answer', 'answers')}` })
  }
  if (typeof accepted === 'number') facts.push({ icon: 'accepted', text: 'Accepted answer' })
  return facts
}

/** The API sends titles HTML-encoded, so the title goes through `decodeHtml`. */
export const runStackOverflow = async (
  canonicalUrl: string,
  id: string,
  hop: AbortController,
  key: string | null,
  decodeHtml: (text: string) => string
): Promise<StageResult | SpecialMiss> => {
  const query = `site=stackoverflow${key ? `&key=${encodeURIComponent(key)}` : ''}`
  const response = await safeFetch(`https://api.stackexchange.com/2.3/questions/${id}?${query}`, {
    signal: hop.signal,
    headers: { Accept: 'application/json', 'User-Agent': LINK_PREVIEW_USER_AGENT }
  })
  if (response.status >= 500) return 'status:5xx'
  const data = await readApiJson<QuestionsJson>(response, hop)
  if (!data) return null
  if (data.error_id === THROTTLE_ERROR) return 'rate-limit'
  if (data.error_id !== undefined && SERVER_ERRORS.includes(data.error_id)) return 'status:5xx'
  const question = response.ok ? data.items?.[0] : undefined
  if (!question?.title) return null

  const facts = questionFacts(question.answer_count, question.accepted_answer_id)
  return {
    success: true,
    url: canonicalUrl,
    requested_url: canonicalUrl,
    title: decodeHtml(question.title),
    publisher: { name: 'Stack Overflow', url: 'https://stackoverflow.com' },
    facts: facts.length > 0 ? facts : undefined
  }
}
