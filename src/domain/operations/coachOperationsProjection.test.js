import { describe, expect, it } from 'vitest'
import { buildCoachOperationsDashboard, DEMO_COACH_ASSIGNMENTS, DEMO_OPERATION_EVENTS } from './coachOperationsProjection.js'

describe('buildCoachOperationsDashboard', () => {
  it('genera tareas y relevos solo para el entrenador asignado', () => {
    const dashboard = buildCoachOperationsDashboard({ coachId: 'coach-demo', events: DEMO_OPERATION_EVENTS, assignments: DEMO_COACH_ASSIGNMENTS })
    expect(dashboard.counts).toEqual({ tasks: 2, people: 2, alerts: 0 })
    expect(dashboard.tasks.map((task) => task.kind)).toContain('antes_de_clase')
    expect(dashboard.people.map((person) => person.reference)).toEqual(['Caso de prueba A', 'Caso de inicio B'])
  })

  it('no expone eventos de otro entrenador ni campos fuera del relevo mínimo', () => {
    const events = [...DEMO_OPERATION_EVENTS, {
      id: 'evt-other', type: 'trial.confirmed', occurredAt: '2026-09-08T12:00:00+02:00', coachId: 'otro-coach',
      person: { reference: 'No visible', phone: '600000000', price: '100', objective: 'No debe aparecer' },
    }]
    const dashboard = buildCoachOperationsDashboard({ coachId: 'coach-demo', events, assignments: DEMO_COACH_ASSIGNMENTS })
    const rendered = JSON.stringify(dashboard)
    expect(rendered).not.toContain('No visible')
    expect(rendered).not.toContain('600000000')
    expect(rendered).not.toContain('price')
  })

  it('retira una tarea solo cuando llega su evento de cierre', () => {
    const initial = buildCoachOperationsDashboard({ coachId: 'coach-demo', events: DEMO_OPERATION_EVENTS, assignments: DEMO_COACH_ASSIGNMENTS })
    const firstTask = initial.tasks[0]
    const completed = buildCoachOperationsDashboard({
      coachId: 'coach-demo',
      events: [...DEMO_OPERATION_EVENTS, { id: 'evt-done', type: 'task.completed', coachId: 'coach-demo', taskId: firstTask.id }], assignments: DEMO_COACH_ASSIGNMENTS,
    })
    expect(completed.tasks.map((task) => task.id)).not.toContain(firstTask.id)
  })

  it('muestra el relevo útil de otros coaches cuando la persona está asignada al coach actual', () => {
    const dashboard = buildCoachOperationsDashboard({ coachId: 'coach-demo', events: DEMO_OPERATION_EVENTS, assignments: DEMO_COACH_ASSIGNMENTS })
    const person = dashboard.people.find((item) => item.reference === 'Caso de inicio B')
    expect(person.timeline).toHaveLength(2)
    expect(person.timeline.map((item) => item.coach)).toEqual(['Dani', 'Javi'])
    expect(JSON.stringify(person)).not.toContain('tarifa')
  })
})
