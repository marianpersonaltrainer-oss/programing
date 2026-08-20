import { describe, expect, it } from 'vitest'
import { projectConfirmedSessionsForCoach } from './coachSessionProjection.js'

describe('coach session projection', () => {
  it('only exposes confirmed sessions and presents their blocks in order', () => {
    const sessions = projectConfirmedSessionsForCoach([
      { id: 'draft', status: 'ai_draft', weekday: 1 },
      {
        id: 'confirmed',
        status: 'confirmed',
        weekday: 3,
        class_type: { label: 'EvoFit' },
        title: 'Miércoles',
        blocks: [
          {
            sort_order: 2,
            title: 'B',
            items: [{ sort_order: 2, exercise_name: 'Row' }, { sort_order: 1, exercise_name: 'Bike' }],
          },
          { sort_order: 1, title: 'A', items: [] },
        ],
      },
    ])

    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({
      id: 'confirmed',
      classType: 'EvoFit',
      title: 'Miércoles',
    })
    expect(sessions[0].blocks.map((block) => block.title)).toEqual(['A', 'B'])
    expect(sessions[0].blocks[1].items.map((item) => item.exerciseName)).toEqual(['Bike', 'Row'])
  })
})
