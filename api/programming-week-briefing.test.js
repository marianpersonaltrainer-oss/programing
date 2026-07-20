import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  isLegacyMethodRulesReadEnabled,
  loadLegacyMethodRulesForBriefing,
} from './lib/legacyMethodRulesBriefing.js'

describe('briefing — cuarentena method_rules legacy', () => {
  /** @type {string|undefined} */
  let prevReadFlag

  beforeEach(() => {
    prevReadFlag = process.env.METHOD_RULE_LEGACY_READ_ENABLED
    delete process.env.METHOD_RULE_LEGACY_READ_ENABLED
  })

  afterEach(() => {
    if (prevReadFlag === undefined) {
      delete process.env.METHOD_RULE_LEGACY_READ_ENABLED
    } else {
      process.env.METHOD_RULE_LEGACY_READ_ENABLED = prevReadFlag
    }
  })

  it('lectura legacy deshabilitada por defecto', () => {
    expect(isLegacyMethodRulesReadEnabled()).toBe(false)
  })

  it('no consulta Supabase cuando la lectura legacy está desactivada', async () => {
    const from = vi.fn()
    const supabase = { from }

    const result = await loadLegacyMethodRulesForBriefing(supabase)

    expect(result).toBe(null)
    expect(from).not.toHaveBeenCalled()
  })

  it('consulta method_rules solo con METHOD_RULE_LEGACY_READ_ENABLED=true', async () => {
    process.env.METHOD_RULE_LEGACY_READ_ENABLED = 'true'

    const eq = vi.fn().mockReturnThis()
    const order = vi.fn().mockReturnThis()
    const limit = vi.fn().mockResolvedValue({ data: [{ rule_text: 'Regla test' }], error: null })
    const select = vi.fn().mockReturnValue({ eq, order, limit })
    const from = vi.fn().mockReturnValue({ select })
    const supabase = { from }

    const result = await loadLegacyMethodRulesForBriefing(supabase)

    expect(from).toHaveBeenCalledWith('method_rules')
    expect(eq).toHaveBeenCalledWith('active', true)
    expect(result).toEqual([{ rule_text: 'Regla test' }])
  })
})

describe('programming-week-briefing.js — sin bloque legacy por defecto', () => {
  it('usa loadLegacyMethodRulesForBriefing en lugar de consulta directa', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const { dirname, join } = await import('node:path')
    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    const src = readFileSync(join(root, 'api/programming-week-briefing.js'), 'utf8')
    expect(src).toContain('loadLegacyMethodRulesForBriefing')
    expect(src).not.toMatch(/await supabase\s*\n\s*\.from\(['"]method_rules['"]\)/)
  })
})
