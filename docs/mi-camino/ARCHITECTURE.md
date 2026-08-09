# Mi Camino EVO V1 — Technical Architecture

Status: **foundation + evidence gates**
Target: web, mobile-first, externally hosted
Repository: `marianpersonaltrainer-oss/programing`

## 1. Architecture decision

Reuse the existing Programming EVO repository, Supabase organization and Vercel deployment path.

```text
WodBuster
  │ verified API / RestHooks / reconciliation only
  ▼
Server-side WodBuster adapter
  ▼
Supabase / Nucleus EVO (`mc_*`)
  ├─ journeys + check-ins + Plan B
  ├─ milestones + challenges
  ├─ resources + settings
  ├─ coach tasks + observations
  └─ mirrors + sync state + audit
       │
       ├────────► Mi Camino EVO · customer web
       ├────────► EVO Coach · existing trainer surface
       └────────► Admin EVO

GitHub → PR/CI → Vercel Preview/Staging → Production after launch gate
```

## 2. Core rule after external audit

The product is not being redesigned. The execution sequence changes:

- **Data truth gate:** no critical automation may rely on a WodBuster field/event until verified for the EVO account.
- **Human truth gate:** no expansion beyond the first R01 slice until a 5–8 person concierge test proves comprehension and coach workload.
- `31→180`, Story of Evolution, EVO del Mes and expanded gamification remain designed but frozen.

## 3. Hosting and environments

**Vercel** remains the web host.

- Preview: every PR, external URL.
- Staging: must use `programing-evo-staging` Supabase.
- Production: separate Supabase/secret set only after launch gate.

One canonical Vercel project must be chosen before production. No local-only production path.

## 4. Frontend surfaces

Customer:
```text
/mi-camino/hoy
/mi-camino/camino
/mi-camino/evolucion
/mi-camino/perfil
```

Coach:
```text
/coach
```

Admin:
```text
/admin/mi-camino
```

Customer Home stays intentionally sparse: one primary action + weekly state + next milestone.

## 5. Customer state model

Support two entry modes:

### New customer
- day 0 journey;
- intake/barrier hypothesis;
- first-class flow;
- R01 0→30 pilot path.

### Veteran customer
- historical identity and attendance imported where source data permits;
- no fake day-0 journey;
- no burst of retroactive public milestones;
- compute next relevant future milestone.

Veteran UX can ship after the first new-customer slice, but schema and routing must support it now.

## 6. Data freshness and stale state

Customer-facing decisions based on WodBuster-derived data must expose freshness metadata when relevant.

If synchronization is delayed:
- do not accuse the customer of missing training;
- show neutral stale-data copy such as `Datos actualizados hace X`;
- suppress automated negative actions when source freshness is below the configured trust threshold;
- raise admin integration-health warning instead.

## 7. EVO Coach integration

`mc_coach_tasks` is the work queue. Coach UI must not reconstruct history manually.

Every task has:
- owner;
- due time;
- priority;
- briefing;
- exact goal;
- suggested wording;
- one recommended proposal;
- closed outcomes.

### Missed-task path
If not completed:
1. status becomes `overdue`;
2. system reassigns to next eligible coach when a future class exists, otherwise to the valid exposure-based owner **only if the required exposure data is verified**;
3. unresolved tasks escalate to admin as exceptions.

Vacations/substitutions must not require routine Marian redistribution.

## 8. Admin EVO

Admin controls versioned configuration for:
- journeys;
- Plan B catalogue;
- contextual resources;
- milestones/badges;
- coach scripts;
- thresholds;
- challenge definitions;
- integration health;
- recognition exception flag;
- audit log.

No normal admin operation should require editing raw JSON or code.

## 9. Supabase domains

Foundation tables:

Identity/state:
- `mc_people`
- `mc_enrollments`
- `mc_goal_cycles`

Plan/content:
- `mc_plan_templates`
- `mc_plan_versions`
- `mc_resources`
- `mc_resource_deliveries`

Coach/check-in:
- `mc_checkins`
- `mc_observations`
- `mc_coach_tasks`

Plan B:
- `mc_plan_b_catalog`
- `mc_plan_b_activations`

Gamification:
- `mc_milestone_definitions`
- `mc_milestone_awards`
- `mc_challenges`
- `mc_challenge_progress`

Integration/ops:
- `mc_wodbuster_events`
- `mc_wodbuster_reservations`
- `mc_wodbuster_attendance`
- `mc_sync_state`
- `mc_settings`
- `mc_audit_log`

## 10. Event model

Normalized events remain the internal contract:

```text
person.created
reservation.created
reservation.cancelled
attendance.confirmed
attendance.no_show
checkin.submitted
plan_b.offered
plan_b.accepted
plan_b.completed
journey.checkpoint_due
milestone.earned
milestone.validated
milestone.celebrated
coach_task.completed
class_option.unlocked
```

All derivations must be idempotent.

## 11. WodBuster capability gate

Before live transport, verify whether the EVO account can reliably provide:
- user identity/creation;
- reservations;
- cancellations;
- no-show;
- confirmed attendance;
- class/session id;
- timestamp;
- coach id;
- RestHook/event availability;
- authentication and request verification;
- reconciliation/history.

### Capability tree

**Complete** → implement full adapter.

**Partial** → disable/redesign only dependent functions. Never infer a missing coach or attendance event from unrelated aggregates.

**Insufficient** → simplify affected automation or define an explicit operational capture flow. CSV/manual data may support analysis/recovery but is not the permanent autonomous trigger for critical flows.

Stable module boundary:

```text
api/lib/wodbuster/
  client.js
  adapter.js
  normalize.js
  reconcile.js
  verifyWebhook.js
```

Exact endpoints/auth/signature are filled only from verified current access.

## 12. Reconciliation and health

Webhooks/RestHooks provide freshness, reconciliation provides correctness.

`mc_sync_state` tracks:
- last start;
- last success;
- lag;
- cursor;
- error.

Failed or stale sync creates an admin-only operational alert. It must not trigger customer blame or risk messaging.

## 13. Authentication/linking

Use Supabase Auth.

- customer: `mc_people.user_id`;
- coach/programmer/admin: `profiles.role`;
- RLS is authorization, not hidden UI.

Critical rule: client browser cannot choose its own external WodBuster id. Linking is trusted server/admin work.

## 14. Deterministic rule engine

Routine product state is not LLM-decided.

Deterministic rules handle:
- milestones;
- check-in timing;
- Plan B triggers;
- attendance-risk thresholds;
- coach tasks;
- checkpoint timing;
- mission totals.

LLM use, if any, is limited to safe human-readable summaries from approved structured data.

## 15. Canonical Plan B families

The implementation source of truth is:

- **B1 · Mantener el vínculo**
- **B2 · Sustituir la sesión**
- **B3 · Mantener el estímulo**

Plan B never increments confirmed attendance.

Safety signals block automatic exercise recommendations.

## 16. Milestones and independent clocks

Attendance milestones use **confirmed attendance only**.

Calendar checkpoints and attendance milestones are independent:
- day 30 runs on day 30;
- attendance 10 runs when count reaches 10;
- neither blocks the other.

This is important for 2x/week plans where attendance 10 may occur after day 30.

## 17. Recognition rule

Safe milestones are public by default.

Do not expose a general customer privacy toggle. Provide an admin/staff exception flag (`private_recognition`) for explicit requests or sensitive circumstances.

Never publicly reveal health/body/injury/nutrition/private-absence information.

## 18. Notifications

Risk recovery cannot rely only on app-open behavior.

Architecture requirement:
```text
critical action
  → in-app state
  + configurable external notification channel
```

Do not select a new notification vendor by default. Concierge uses the existing operational channel; final automation is chosen after existing capabilities are reviewed.

## 19. Baseline and product analytics

Store a historical baseline before pilot interpretation where data permits:
- early attendance/frequency;
- frequency drop;
- continuity around day 30/90;
- absence/reactivation patterns.

Pilot success must be compared to baseline, not to an isolated target percentage.

## 20. Privacy/legal launch gate

Treat sleep/fatigue/energy/sensitive signals conservatively until professional review confirms exact classification and basis.

Before production close:
- privacy notice;
- legal basis/consents as applicable;
- retention/deletion rules;
- vendor/processor agreements;
- data-region/residency record;
- role/access review;
- audit-log retention.

Agents prepare technical evidence. Legal approval is not delegated to Codex.

## 21. Visual/accessibility constraints

Use the approved light premium-active direction and EVO tokens.

Accessibility:
- 44×44 minimum touch targets;
- visible focus states;
- 16px minimum body copy in app;
- do not use yellow as low-contrast text on pale surfaces;
- use `#FFFF4C` as accent or with dark EVO text where contrast is sufficient;
- stale-data state must be visible when source freshness matters.

## 22. Observability

Minimum signals:
- inbound event success/failure;
- reconciliation last success + lag;
- rule processor failures;
- open/overdue/reassigned coach tasks;
- duplicate prevention count;
- auth/linking failures;
- customer/server errors;
- suppressed actions caused by stale source data.

Do not log secrets or unnecessary sensitive free text.

## 23. Backup / rollback

- every schema change is a migration;
- destructive migration requires explicit approval + restore path;
- backup restore rehearsal before launch;
- Vercel rollback rehearsal before launch;
- WodBuster mirrors rebuildable where source access permits.

## 24. Current build order

1. verify WodBuster + capability tree;
2. calculate historical baseline;
3. run R01 0→14 concierge in parallel;
4. close minimum staging/RLS/rollback blockers;
5. secure invite/link + external critical-notification contract;
6. implement WodBuster live only against verified capabilities;
7. implement only R01 0→30 rule engine;
8. implement customer + minimum coach surface;
9. staging rehearsal with real team;
10. launch gate.

## 25. First proof

The first proof is no longer expressed as a forced linear order between milestone 10 and day 30.

```text
customer linked
→ R01 assigned
→ first-class briefing
→ attendance/check-in facts arrive
→ Plan B if verified trigger occurs
→ unresolved risk creates 2–3 min coach task
→ day-30 checkpoint happens on calendar

independently:
confirmed attendance count reaches 10
→ milestone award
→ next eligible class recognition
```

No 31→180 expansion until this first proof works and the two evidence gates have passed.
