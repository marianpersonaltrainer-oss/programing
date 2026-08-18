import { describe, expect, it } from 'vitest'
import { isPreviewSupabaseTargetSafe } from './vercelSupabaseEnvironment.js'

describe('isPreviewSupabaseTargetSafe', () => {
  it('allows non-preview deployments without changing production behavior', () => {
    expect(isPreviewSupabaseTargetSafe({
      vercelEnvironment: 'production',
      supabaseUrl: 'https://some-production-project.supabase.co',
    })).toBe(true)
  })

  it('allows staging only in Vercel previews', () => {
    expect(isPreviewSupabaseTargetSafe({
      vercelEnvironment: 'preview',
      supabaseUrl: 'https://dgkvaorzuebdloegumai.supabase.co',
    })).toBe(true)
  })

  it('fails closed for a missing, malformed, or production Preview URL', () => {
    expect(isPreviewSupabaseTargetSafe({ vercelEnvironment: 'preview' })).toBe(false)
    expect(isPreviewSupabaseTargetSafe({
      vercelEnvironment: 'preview',
      supabaseUrl: 'https://some-production-project.supabase.co',
    })).toBe(false)
  })
})
