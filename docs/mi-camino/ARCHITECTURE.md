# Mi Camino EVO V1 — Technical Architecture

Status: build foundation
Target: web, mobile-first, externally hosted
Repository: `marianpersonaltrainer-oss/programing`

## 1. Architecture decision

Use the existing Programming EVO repository and Supabase organization rather than creating another isolated stack.

Logical surfaces:

```text
WodBuster
  │ official API / RestHooks + reconciliation
  ▼
Server-side WodBuster adapter
  ▼
Supabase / Nucleus EVO (`mc_*` domain)
  ├─ journeys + check-ins + Plan B
  ├─ milestones + challenges
  ├─ resources + settings
  ├─ coach tasks + observations
  └─ event mirror + audit
       │
       ├────────────► Mi Camino EVO (customer web)
       ├────────────► EVO Coach (existing Programming EVO surface)
       └────────────► Admin EVO

GitHub → PR/CI → Vercel Preview/Staging → Vercel Production
```

## 2. Why this shape

- Reuses existing React/Vite/Tailwind/Supabase stack.
- One identity model and one event layer.
- Clear domain separation through `mc_*` tables rather than another database by default.
- WodBuster continues to own administrative truth.
- Coach work stays in the existing trainer product.
- Customer UI can evolve independently as its own route/shell.

## 3. Web hosting

### Production recommendation

**Vercel** for the React/Vite web application and serverless API routes.

Reasons:
- the repository already has Vercel tooling/deployment history;
- PR previews support autonomous agent QA;
- environment separation is straightforward;
- rollback can use prior deployments;
- no local server is required for users.

### Environments

- `Preview`: every PR.
- `Staging`: stable branch/deployment connected to `programing-evo-staging` Supabase.
- `Production`: main/release deployment connected to `Programing Evo` Supabase only after launch gate.

Do not use production Supabase from previews.

### Domain

Do not invent or purchase a new domain during build. V1 can run under the existing Vercel project route. At launch, Marian chooses whether Mi Camino is exposed through an existing EVO domain route or dedicated subdomain. This is a launch decision, not a build blocker.

## 4. Frontend routing

Target routes:

```text
/mi-camino              customer shell
/mi-camino/hoy
/mi-camino/camino
/mi-camino/evolucion
/mi-camino/perfil

/coach                   EVO Coach shell (existing capability, progressively consolidated)
/admin/mi-camino         Admin EVO
```

During incremental migration, legacy query modes (`?coach`, `?v2`) may remain. New Mi Camino code should not depend on query parameters as its final routing model.

Recommended implementation: add `react-router-dom` only if route handling cannot be kept simple with the existing app shell. Avoid a routing migration unrelated to Mi Camino unless needed.

## 5. Customer shell

Bottom navigation V1:

1. **Hoy** — one next action, weekly state, next milestone.
2. **Mi camino** — current journey/stage, active action, check-in/resource, Plan B when relevant.
3. **Evolución** — badges, timeline, personal challenge, collective mission, occasional team challenge, Story of Evolution.
4. **Perfil** — identity/account and minimal plan information.

### Home priority resolver

`Hoy` must not become a dashboard. The server/domain layer computes one primary card using ordered priority:

1. safety/human review required;
2. action requiring response today;
3. check-in due;
4. Plan B/recovery action due;
5. upcoming class;
6. no action — positive continuity summary.

Week progress and next milestone are secondary only.

## 6. EVO Coach integration

EVO Coach consumes `mc_coach_tasks` and does not reconstruct customer history client-side.

Task payload includes:
- what happened;
- what the customer expressed;
- what the system tried;
- conversation goal;
- suggested wording;
- one recommended proposal;
- permitted outcomes.

Task types include first class, quick contact, checkpoint review, milestone recognition, class-option validation and sensitive review.

Ordinary intervention budget: **2–3 minutes**.

## 7. Admin EVO

Configuration areas:
- journeys and published versions;
- Plan B catalog;
- contextual resource library;
- milestone definitions and thresholds;
- challenges / collective missions;
- messages/coach scripts;
- business-rule settings;
- WodBuster integration health;
- audit log.

Admin changes that affect live customers are versioned/published rather than silently editing historical plan definitions.

## 8. Supabase domains

Foundation migration creates these tables:

### Identity/state
- `mc_people`
- `mc_enrollments`
- `mc_goal_cycles`

### Plan/content
- `mc_plan_templates`
- `mc_plan_versions`
- `mc_resources`
- `mc_resource_deliveries`

### Check-in/coach
- `mc_checkins`
- `mc_observations`
- `mc_coach_tasks`

### Plan B
- `mc_plan_b_catalog`
- `mc_plan_b_activations`

### Gamification
- `mc_milestone_definitions`
- `mc_milestone_awards`
- `mc_challenges`
- `mc_challenge_progress`

### Integration/ops
- `mc_wodbuster_events`
- `mc_wodbuster_reservations`
- `mc_wodbuster_attendance`
- `mc_sync_state`
- `mc_settings`
- `mc_audit_log`

## 9. Event model

Every external or internal change should become a normalized event before deriving tasks/hits.

Suggested event names:

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
journey.day_90_reached
journey.day_180_reached
milestone.earned
milestone.validated
milestone.celebrated
coach_task.completed
class_option.unlocked
```

Derivations must be idempotent.

## 10. WodBuster adapter

Create one server-side module boundary, e.g.:

```text
api/lib/wodbuster/
  client.js
  adapter.js
  normalize.js
  reconcile.js
  verifyWebhook.js
```

Public interface should remain stable even if WodBuster endpoint details change:

```ts
interface WodBusterAdapter {
  listUsers(updatedSince?: Date): Promise<UserRecord[]>
  listReservations(range: DateRange): Promise<ReservationRecord[]>
  listAttendance(range: DateRange): Promise<AttendanceRecord[]>
  verifyInboundRequest(request: Request): Promise<boolean>
}
```

Exact endpoint/auth mapping is filled only from verified official access. UI and business rules must run against fixtures until then.

## 11. Reconciliation

RestHooks/webhooks provide freshness but are not enough for correctness.

Run scheduled reconciliation:
- recent reservations: frequent rolling window;
- recent attendance: after classes / rolling window;
- users: daily or based on supported update cursor;
- full sanity reconciliation: lower frequency.

The exact schedule is configuration, not hardcoded business logic.

A failed reconciliation updates `mc_sync_state` and produces an admin-only operational alert. It must not automatically contact customers.

## 12. Authentication and authorization

Use Supabase Auth.

Roles:
- customer: linked by `mc_people.user_id`;
- coach/programmer: `profiles.role`;
- admin: `profiles.role = admin`.

RLS is the authorization layer, not hidden UI.

Legacy shared coach codes/localStorage credentials are not acceptable for access to Mi Camino customer information. They may remain temporarily for unrelated legacy screens during migration.

## 13. Rule engine

V1 does **not** require an LLM to decide routine state transitions.

Use deterministic rules for:
- attendance milestones;
- check-in due dates;
- Plan B triggers;
- no-attendance risk thresholds;
- checkpoint tasks;
- day 90/180 transitions;
- collective mission totals.

LLM use, if any, is limited to drafting/summarizing human-readable briefings from approved structured data and must not invent health decisions or business rules.

## 14. Plan B selector

Inputs:
- reason for missed session;
- customer stage/month;
- training level/autonomy;
- current goal;
- available time;
- available equipment;
- recent training context;
- safety exclusions;
- prior Plan B history.

Output:
- one primary Plan B;
- optional one alternative;
- or `safety_blocked`.

No random workout rotation just for novelty.

## 15. Milestone engine

Attendance milestone source: only `mc_wodbuster_attendance.confirmed = true` after normalized WodBuster attendance.

Initial active public milestone can start with 10 confirmed trainings. More thresholds are configuration and can remain disabled until approved.

Technical/evolution milestones require a validation workflow before award when configured with `requires_validation`.

Public recognition queue is sorted by priority and limits each class to two public recognition tasks.

## 16. Challenges / mini-competition

No permanent user leaderboard.

V1 data model supports:
- personal challenge;
- collective EVO mission;
- temporary team challenge.

Points/contribution rules must cap healthy behavior and never reward attendance beyond the agreed sustainable frequency.

## 17. Voice/content

Content is structured and versioned. UI does not hardcode long coaching copy in components.

Message fields can be rendered from published resource/plan/milestone configuration while keeping a safe fallback in code.

Every customer message follows the Marian/EVO voice guide: close, clear, short, one main action.

## 18. Visual system

Base tokens are the existing EVO palette.

Mi Camino uses the approved **light premium-active** direction:
- warm/lilac surfaces;
- deep EVO purple for hierarchy;
- energetic accent used sparingly;
- achievement moments may use a formalized warm metallic/gold tonal extension, but this must be represented as a design token before implementation;
- badges feel premium/game-like, not childish;
- ordinary operational screens remain calm and sparse.

The customer Home has only one primary action and should be understandable in ~5 seconds.

## 19. Observability

Minimum operational signals:
- inbound WodBuster event count/failures;
- reconciliation last success + lag;
- rule processing failures;
- open/overdue coach tasks;
- duplicate-event prevention count;
- customer auth/linking failures;
- client/server API errors.

Do not log credentials, raw sensitive health text unnecessarily or service-role tokens.

## 20. Backup / rollback

- Preserve/verify existing Supabase backup workflow.
- Every schema change is a migration in Git.
- Destructive migrations require explicit approval and a restore path.
- Vercel deployment rollback uses the prior verified deployment.
- WodBuster mirrors are rebuildable from reconciliation where source availability permits.

## 21. Build order

1. staging schema + RLS + seeds + security audit;
2. auth/identity linking;
3. WodBuster adapter contract + fixtures + live verification;
4. event/rule engine;
5. customer shell and first vertical journey slice;
6. EVO Coach task surface;
7. milestone/recognition end-to-end;
8. Admin configuration;
9. day 90→180 bridge;
10. final reliability/security/accessibility/load QA;
11. production launch.

## 22. First proof

The first vertical slice must demonstrate:

```text
customer exists
→ journey assigned
→ first-class briefing task
→ attendance/check-in data arrives
→ risk triggers Plan B if necessary
→ unresolved risk creates 2–3 min coach task
→ confirmed attendance count reaches 10
→ milestone award + recognition task
→ day 30 checkpoint
```

No production launch until this flow can be tested deterministically in staging.
