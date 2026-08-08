import { describe, expect, it } from 'vitest'
import {
  CANONICAL_VERCEL_PROJECT_ID,
  deploymentTargetErrors,
  PRODUCTION_SUPABASE_REF,
  STAGING_SUPABASE_REF,
} from './validate-deployment-target.mjs'

const url = (ref) => `https://${ref}.supabase.co`
const publicKey = 'sb_publishable_test'

describe('validate deployment target', () => {
  it('permite desarrollo local sin exigir variables remotas', () => {
    expect(deploymentTargetErrors({})).toEqual([])
  })

  it('permite preview únicamente con staging', () => {
    expect(deploymentTargetErrors({
      VERCEL_ENV: 'preview',
      VITE_SUPABASE_URL: url(STAGING_SUPABASE_REF),
      VITE_SUPABASE_ANON_KEY: publicKey,
      SUPABASE_URL: url(STAGING_SUPABASE_REF),
    })).toEqual([])

    expect(deploymentTargetErrors({
      VERCEL_ENV: 'preview',
      VITE_SUPABASE_URL: url(PRODUCTION_SUPABASE_REF),
      VITE_SUPABASE_ANON_KEY: publicKey,
    }).join(' ')).toContain('Preview debe usar Supabase')
  })

  it('permite producción solo con la BD y el proyecto canónicos', () => {
    expect(deploymentTargetErrors({
      VERCEL_ENV: 'production',
      VERCEL_PROJECT_ID: CANONICAL_VERCEL_PROJECT_ID,
      VITE_SUPABASE_URL: url(PRODUCTION_SUPABASE_REF),
      VITE_SUPABASE_ANON_KEY: publicKey,
    })).toEqual([])

    expect(deploymentTargetErrors({
      VERCEL_ENV: 'production',
      VERCEL_PROJECT_ID: 'prj_duplicate',
      VITE_SUPABASE_URL: url(PRODUCTION_SUPABASE_REF),
      VITE_SUPABASE_ANON_KEY: publicKey,
    }).join(' ')).toContain('proyecto Vercel canónico')
  })

  it('rechaza secretos expuestos mediante VITE_', () => {
    const serviceRolePayload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')
    const errors = deploymentTargetErrors({
      VITE_ANTHROPIC_API_KEY: 'sk-ant-private',
      VITE_SUPABASE_ANON_KEY: `x.${serviceRolePayload}.x`,
    })
    expect(errors.join(' ')).toContain('VITE_ANTHROPIC_API_KEY')
    expect(errors.join(' ')).toContain('clave privada de Supabase')
  })
})
