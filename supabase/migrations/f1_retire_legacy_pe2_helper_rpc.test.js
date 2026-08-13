import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('./20260813150958_f1_retire_legacy_pe2_helper_rpc.sql', import.meta.url),
  'utf8',
).toLowerCase()

describe('F1 legacy PE2 helper RPC retirement', () => {
  it('retira EXECUTE externo de ambos helpers sin borrarlos', () => {
    for (const functionName of ['pe2_my_org', 'pe2_my_role']) {
      expect(migration).toContain(
        `revoke all on function public.${functionName}()`,
      )
      expect(migration).toContain('from public, anon, authenticated')
      expect(migration).toContain(
        `grant execute on function public.${functionName}()`,
      )
    }
    expect(migration).not.toContain('drop function')
    expect(migration).not.toMatch(/grant execute[\s\S]*?to authenticated;/)
  })
})
