# Mi Camino EVO V1 — Autonomous Build Plan

Status: **reordered after external audit — 2026-08-08**

## Objective

Deliver a production-ready web experience with the least possible Marian intervention. Engineering agents own implementation decisions; Marian only enters at documented method, experience, privacy, irreversible-production or launch gates.

## Non-negotiable sequencing rule

**Do not expand product functionality while two critical hypotheses remain unverified:**

1. **Data truth:** what WodBuster can actually provide at the granularity Mi Camino needs.
2. **Human truth:** whether real customers and coaches understand/use the first 0→14 day loop as designed.

The 0→180 product remains designed and frozen. `31→180`, Story of Evolution, EVO del Mes and expanded gamification are **backlog, not current build scope**.

## Maximum active workstreams

Only two strategic workstreams may be active until the evidence gates pass.

### Workstream A — Data truth

Deliverables:
- verified WodBuster capability matrix;
- decision tree `complete / partial / insufficient API`;
- credential rotation before live connection;
- historical adherence/retention baseline;
- minimum staging/RLS/rollback readiness needed to safely test the slice.

### Workstream B — Human truth

Run a concierge test for Journey R01, days 0→14:
- 5–8 compatible participants;
- existing operational communication channel, no new notification tool required;
- simulate next action, check-in, Plan B and coach tasks manually where necessary;
- measure comprehension, coach time, ignored tasks, perceived support and copy friction.

Recommended exit gate:
- ≥80% understand the principal actions without extra explanation;
- ordinary coach tasks fit within 2–3 real minutes;
- no structural friction invalidates the R01 model.

---

## Gate A — WodBuster contract before live integration

Verify with current official account access whether EVO can reliably obtain/receive:
- customer identity / creation;
- reservation created;
- cancellation;
- no-show;
- confirmed attendance;
- class/session identifier;
- class date/time;
- coach identifier;
- available RestHooks/events;
- authentication/signature model;
- historical/reconciliation access.

### Branch A — Complete
Keep the planned architecture and implement the live adapter.

### Branch B — Partial
Keep only functions supported by reliable data. Redesign **only** the functions that depend on missing fields. Example: if coach-per-session is unavailable, do not fake exposure-based assignment.

### Branch C — Insufficient
Do not automate from guessed data. Simplify the affected feature or define an explicit operational capture path. CSV/manual import is acceptable for analysis/recovery, not as the permanent source for critical autonomous triggers.

No endpoint, header, event or webhook signature may be invented from memory.

---

## Phase 0 — Foundation and evidence

### F0.1 Repository contract
- `AGENTS.md` remains binding.
- branch → tests → preview/staging → PR.
- no production-first migrations.

### F0.2 Supabase staging
- `mc_*` schema stays in `programing-evo-staging` first.
- complete negative RLS tests for customer/coach/admin.
- run security/performance advisors after DDL changes.
- preserve production isolation.

### F0.3 Authentication/linking
- Supabase Auth.
- trusted server/admin process links `auth.users.id` ↔ `mc_people.user_id` ↔ external WodBuster identity.
- browser must never self-claim a WodBuster identity.
- invite/account UX remains a functional gate before real customer testing.

### F0.4 Hosting/recovery
- external web via Vercel, never local-only.
- Preview/Staging use staging Supabase.
- choose one canonical Vercel project before production.
- verify rollback and backup restore rehearsal before launch.

### F0.5 Legal/privacy launch package
Agents prepare the technical inventory; professional/human review owns the legal gate. Before production close:
- privacy notice and lawful basis/consents as applicable;
- sensitive-data treatment;
- retention/deletion;
- processor/vendor agreements where needed;
- data region/residency;
- role access;
- audit-log retention.

### F0.6 Historical baseline
Before pilot results are interpreted, save a baseline from available historical data. Minimum useful metrics where available:
- first-weeks attendance/frequency;
- frequency drop;
- continuity around 30/90 days;
- reactivation/absence patterns.

### Phase 0 exit
- WodBuster branch chosen;
- baseline stored;
- concierge gate passed;
- RLS/staging/rollback minimum verified;
- invite/linking path defined;
- critical external notification path defined at architecture level.

---

## Phase 1 — First vertical slice: R01 customer → day 30

Only after Phase 0 evidence gates.

### V1.1 Customer shell
- `/mi-camino/*`;
- `Hoy`, `Mi camino`, `Evolución`, `Perfil`;
- loading/empty/error/data-stale states;
- `Hoy` = one primary action + week + next milestone only.

### V1.2 Enrollment/linking
- trusted customer link;
- Journey R01 assignment;
- confirmed barrier hypothesis;
- first-class coach task.

### V1.3 First class + missed-task path
Coach gets briefing and quick observation. Every task has owner, due time and status.
If not completed:
1. mark `overdue`;
2. reassign to next eligible coach or exposure-based owner when data supports it;
3. unresolved exception escalates to admin.

Vacations/substitutions must not require Marian to redistribute routine tasks manually.

### V1.4 Check-in
Approved 3-question check-in, <1 minute.

### V1.5 Plan B
Trigger only from verified facts and approved rules. Safety exclusions block automatic exercise proposals.

Canonical families for implementation:
- **B1 · Mantener el vínculo**
- **B2 · Sustituir la sesión**
- **B3 · Mantener el estímulo**

### V1.6 Critical notification
A risk-triggered action cannot depend only on app-open behavior. Architecture exposes a configurable external notification channel.

Do **not** select a new tool by default. Concierge uses the existing operational channel; automation choice comes after reviewing existing capabilities.

### V1.7 Coach escalation
- one owner;
- brief + exact wording + one recommended proposal;
- 2–3 minute budget;
- closed outcomes.

### V1.8 Attendance milestones are event-driven
Attendance milestones come only from confirmed attendance.

**Important:** milestone 10 and day-30 checkpoint are independent clocks. A 2x/week customer may reach attendance 10 after day 30; this is valid and must not block day-30 review.

### V1.9 Day 30
Calendar checkpoint runs on schedule regardless of attendance milestone state.

### Phase 1 exit
A staging customer can complete R01 0→30 with stable and Plan-B scenarios, no false data assumptions and no Marian routine intervention.

---

## Veteran-member compatibility

The model must support two entry states:
- new customer with day 0 journey;
- existing/veteran customer with imported history where available.

Veterans do not pretend to start from zero and do not receive a burst of retroactive public celebrations. Compute the next relevant future milestone.

Veteran UX may be built after the first 0→30 slice, but schema/routing must not make it impossible.

---

## Recognition privacy rule

Safe EVO milestones remain public by default. Do not expose a general privacy preference in the customer UI.

Provide an admin/staff exception flag such as `private_recognition` when:
- the person explicitly asks not to be named publicly; or
- a sensitive circumstance makes public recognition inappropriate.

Never publicly expose health, body, injury, nutrition, sensitive goals or private reasons for absence.

---

## Phase 2 — Coach minimum for R01

Only what the 0→30 slice needs:
- first-class briefing/closure;
- contextual 2–3 min contact;
- milestone recognition when event occurs;
- overdue/reassignment/escalation behavior.

Before real pilot, estimate aggregate coach load for expected new-customer volume.

---

## Phase 3 — Reliability / launch gate

Before production:
- live WodBuster tests for every capability actually used;
- negative RLS tests for all roles;
- restore rehearsal;
- Vercel rollback rehearsal;
- privacy/legal package closed;
- external critical notification path operational;
- coach capacity + substitution rule documented;
- historical baseline stored;
- concierge gate passed;
- real-team staging rehearsal;
- Marian launch approval.

---

## Frozen backlog — do not build yet

Preserve as approved, but blocked until R01 0→30 proves the engine:
- days 31→90;
- Story of Evolution week 11;
- Bridge 90→180;
- EVO del Mes / special workout;
- temporary team competition expansion;
- broader badge catalogue;
- paid post-180 products.

Do not delete this work and do not redesign it unless real evidence shows a structural problem.

## Current strict execution order

1. WodBuster capability verification + decision tree.
2. Historical baseline calculation (parallel to #1).
3. Concierge R01 0→14 (parallel workstream).
4. Finish minimum #14/#21 staging, RLS and rollback blockers.
5. Resolve secure invitation/linking + external critical notification channel contract.
6. Build #16 live only against verified WodBuster capabilities.
7. Build #17 only for R01 0→30 rules.
8. Build #18 + minimum #19 for R01 0→30.
9. Real-team staging rehearsal.
10. Launch gate.

## Human actions that may remain

Codex must not ask Marian for technical work it can do.

Likely owner-only actions:
1. enable/rotate third-party credentials/account access;
2. approve method/customer experience/privacy changes;
3. provide/approve professional legal review where required;
4. approve paid external service changes;
5. final production launch approval.
