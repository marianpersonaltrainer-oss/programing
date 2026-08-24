import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
}))

vi.mock('./supabase.js', () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  },
}))

import { getPe2ActiveSlot, setPe2ActiveSlot } from './pe2Supabase.js'

const USER_ID = '018f1f4d-7b6c-7d8e-9f10-111213141516'
const ORG_ID = '018f1f4d-7b6c-7d8e-9f10-111213141517'

describe('PE2 state uses the capability organization context', () => {
  beforeEach(() => {
    mocks.getUser.mockReset()
    mocks.from.mockReset()
    mocks.getUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    })
  })

  it('fails closed before touching Supabase without an organization context', async () => {
    await expect(getPe2ActiveSlot(null)).rejects.toThrow(
      'No existe un contexto único con programming.manage.',
    )
    await expect(setPe2ActiveSlot({ mesociclo: 'fuerza', semana: 1 }, null))
      .rejects.toThrow('No existe un contexto único con programming.manage.')
    expect(mocks.getUser).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('scopes the active-state read by user and capability organization', async () => {
    const row = {
      mesociclo: 'autocarga',
      semana: 2,
      phase: null,
      org_id: ORG_ID,
    }
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
    }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    mocks.from.mockReturnValue(query)

    await expect(getPe2ActiveSlot(ORG_ID)).resolves.toEqual(row)

    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(mocks.from).toHaveBeenCalledWith('pe2_programmer_state')
    expect(query.eq).toHaveBeenNthCalledWith(1, 'user_id', USER_ID)
    expect(query.eq).toHaveBeenNthCalledWith(2, 'org_id', ORG_ID)
  })

  it('writes the organization selected by the capability context', async () => {
    const saved = {
      mesociclo: 'mixto',
      semana: 3,
      phase: null,
      org_id: ORG_ID,
    }
    const query = {
      upsert: vi.fn(),
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({ data: saved, error: null }),
    }
    query.upsert.mockReturnValue(query)
    query.select.mockReturnValue(query)
    mocks.from.mockReturnValue(query)

    await expect(setPe2ActiveSlot({
      mesociclo: 'mixto',
      semana: 3,
    }, ORG_ID)).resolves.toEqual(saved)

    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(mocks.from).toHaveBeenCalledWith('pe2_programmer_state')
    expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: USER_ID,
      org_id: ORG_ID,
      mesociclo: 'mixto',
      semana: 3,
    }), { onConflict: 'user_id' })
  })
})
