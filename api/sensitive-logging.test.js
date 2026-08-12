import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('sensitive logging guard', () => {
  it('does not log coach access secrets or weekly check-in payloads', () => {
    const server = readFileSync(join(root, 'api/coach-weekly-checkin.js'), 'utf8')
    const client = readFileSync(join(root, 'src/lib/supabase.js'), 'utf8')
    const coachView = readFileSync(join(root, 'src/components/CoachView/CoachView.jsx'), 'utf8')

    expect(server).not.toContain('process_env_COACH_ACCESS_CODE')
    expect(server).not.toContain('parsedBody: body')
    expect(client).not.toContain('accessCodeDesdeOptions')
    expect(client).not.toContain('evo_coach_auth_en_localStorage')
    expect(client).not.toContain("console.log('[weekly_checkins]")
    expect(coachView).not.toContain("console.log('[WeeklyCheckinModal]")
  })

  it('does not accept private server secrets from VITE-prefixed fallbacks', () => {
    const privateServerFiles = [
      'api/anthropic.js',
      'api/programming-week-briefing.js',
      'api/programming-generation-step.js',
      'api/programming-ai-check.js',
      'api/coach-weekly-checkin.js',
    ]

    for (const path of privateServerFiles) {
      const source = readFileSync(join(root, path), 'utf8')
      expect(source, path).not.toContain('process.env.VITE_ANTHROPIC_API_KEY')
      expect(source, path).not.toContain('process.env.VITE_COACH_ACCESS_CODE')
    }
  })

  it('does not log complete AI prompts or synthesized context', () => {
    const agent = readFileSync(join(root, 'src/hooks/useAgent.js'), 'utf8')
    const anthropic = readFileSync(join(root, 'api/anthropic.js'), 'utf8')
    const briefing = readFileSync(join(root, 'api/programming-week-briefing.js'), 'utf8')
    const excel = readFileSync(
      join(root, 'src/components/ExcelGeneratorModal/ExcelGeneratorModal.jsx'),
      'utf8',
    )

    expect(agent).not.toContain('System prompt completo')
    expect(agent).not.toContain('SÍNTESIS DE CONTEXTO')
    expect(anthropic).not.toContain("console.error('Anthropic no-JSON body:', rawText")
    expect(anthropic).not.toContain("console.error('Anthropic API Error:', response.status, data)")
    expect(anthropic).not.toContain("console.error('Serverless Function Error:', error)")
    expect(briefing).not.toContain('err.preview = rawText')
    expect(briefing).not.toContain("console.error('[programming-week-briefing]', e)")
    expect(excel).not.toContain('preview: jf.slice')
    expect(excel).not.toContain('console.error(err)')
  })
})
