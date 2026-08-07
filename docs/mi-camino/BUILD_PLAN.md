# Mi Camino EVO V1 — Autonomous Build Plan

## Objective

Deliver a production-ready web experience with the least possible Marian intervention. Engineering agents own implementation decisions; Marian only enters at documented human approval gates.

## Build principle

Do not build the whole product as parallel disconnected screens. Complete vertical slices using shared engines, then expand.

## Phase 0 — Foundation / no product-wide coding yet

### F0.1 Repository contract
- `AGENTS.md` exists and is binding for Codex work.
- All feature work uses branch → tests → preview/staging → PR.
- No direct production-first migrations.

### F0.2 Supabase staging
- Review and apply `20260807170000_mi_camino_evo_foundation.sql` to `programing-evo-staging`.
- Generate TS types after migration.
- Run security + performance advisors.
- Fix every RLS blocker before customer test accounts are linked.
- Explicitly audit old permissive anonymous policies outside `mc_*`; do not assume they are acceptable for Mi Camino.

### F0.3 Auth
- Customer login uses Supabase Auth.
- Preferred production customer UX: email magic link; password flow may remain as fallback/staging.
- Customer is linked to `mc_people.user_id` by trusted server/admin process, not by arbitrary browser claims.
- Coach/Admin access uses authenticated roles + RLS.
- Legacy shared coach code is not an authorization mechanism for Mi Camino data.

### F0.4 Hosting
- Existing Vercel project remains preferred host.
- PR Preview → staging → production.
- Vercel Preview/Stage must use staging Supabase values.
- Production values are separate and added only at launch gate.
- `vercel.json` already rewrites SPA routes to `index.html`, so `/mi-camino/*` can be externally served.

### F0.5 WodBuster
- Verify official API/RestHook access and auth for the account.
- Rotate any old/exposed credential before production.
- Add secrets only to server environment.
- Finish `api/lib/wodbuster` transport only after verification.
- Build fixture-backed integration tests before connecting live.

### F0.6 Observability / recovery
- Verify existing backup workflow actually runs.
- Add integration-health logging without secrets.
- Document rollback for DB migration + Vercel deployment.

### Phase 0 exit
- staging schema passes advisors;
- customer, coach, admin test users prove RLS boundaries;
- PR preview is external web URL;
- WodBuster live connector either verified or explicitly marked as the only external blocker with adapter/fixtures ready.

---

## Phase 1 — First vertical slice: customer → day 30

### V1.1 Customer shell
Already scaffolded:
- `/mi-camino/*` entry;
- `Hoy`;
- `Mi camino`;
- `Evolución`;
- `Perfil`;
- loading/empty/error/login states.

Finish:
- accessibility/keyboard QA;
- real badge artwork component;
- content states from published configs;
- visual regression screenshots.

### V1.2 Enrollment
Build trusted admin/server workflow:
- receive/sync WodBuster customer;
- link existing/new Supabase auth user;
- create `mc_people`;
- assign one of three active journey templates;
- persist confirmed barrier hypothesis;
- generate first-class task.

### V1.3 First class
EVO Coach task shows:
- brief from intake;
- exact first-class questions/fields;
- required quick observation;
- padrino/madrina reminder if applicable;
- one-tap completion.

### V1.4 Week 2 + weekly check-in
Customer check-in is <1 minute and uses only three approved questions.

Rules cross-check check-in with attendance/reservations/Plan B.

### V1.5 Plan B
- cancellation/no-show event;
- projected frequency risk;
- wait 24h without replacement;
- deterministic Plan B family B1/B2/B3;
- safety blocking;
- completion does not increment attendance.

### V1.6 Coach escalation
When continuity alerts persist:
- create one task owner;
- assign next-class coach, otherwise highest-exposure coach;
- render 2–3 minute script + one recommendation;
- three one-tap outcomes;
- follow-up closes automatically when evidence changes.

### V1.7 Attendance milestone 10
- source = confirmed WodBuster attendance only;
- award `En marcha` (configurable milestone definition);
- next-class recognition task;
- max two public recognitions per class;
- absent → defer to next class;
- mark celebrated.

### V1.8 Day 30 review
- auto-summarize objective metrics;
- assigned coach adds max 2 categories + one line;
- customer receives concise evolution output;
- route to continue / one adjustment / human review.

### Phase 1 exit
One staging customer can be driven through the whole slice with deterministic fixtures and no Marian intervention.

---

## Phase 2 — Complete days 31–90

Reuse the same engines, add:
- day 60 checkpoint;
- month 3 novelty/commitment logic;
- all-or-nothing reflection and compassionate operational response;
- organization window-of-compliance experiment;
- sleep/energy adaptive module inside return-after-pause journey only;
- week 11 Story of Evolution + coach validation;
- day 90 outcome decision.

Do not create another engine per journey. Journey templates configure shared primitives.

### Phase 2 exit
All three 0–90 journeys pass scripted staging scenarios.

---

## Phase 3 — Bridge 90–180

Common bridge structure:
- one next goal;
- recommended frequency;
- one outside-training action;
- short challenge only when useful;
- inherited barrier context;
- exception-based follow-up;
- day 180 review.

No paid-product checkout in V1 unless separately approved. Only recommendation slots can exist.

---

## Phase 4 — Gamification + community polish

Complete:
- badge library and neutral names;
- personal best / personal streak designed around sustainability;
- collective EVO missions;
- temporary team challenges;
- EVO del Mes nomination/validation;
- special-workout template reference to Programming EVO.

Never add permanent person-to-person leaderboard.

---

## Phase 5 — Admin EVO

Admin must edit without code:
- active journey/version;
- milestone thresholds/copy/badge;
- Plan B catalog;
- contextual resources;
- check-in copy;
- coach scripts;
- alert thresholds;
- challenge definitions;
- integration health.

Publishing is versioned and audited.

---

## Phase 6 — Reliability and launch

Required:
- security advisor clean for blocking findings;
- RLS test matrix;
- e2e tests across customer/coach/admin;
- WodBuster retry/reconciliation test;
- duplicate event/idempotency test;
- accessibility pass;
- responsive pass on common mobile widths;
- real trainer pilot;
- real-customer usability pilot;
- backup restore rehearsal;
- rollback drill;
- production environment variable checklist;
- final launch approval.

## Human actions that may remain

Codex should not ask Marian to do technical work it can do itself.

Only likely owner-only actions:
1. rotate/enable WodBuster credentials or account API/RestHook access;
2. approve/pick production domain if a domain change is wanted;
3. approve customer-facing method/privacy/launch decisions;
4. approve any external service with material cost;
5. complete third-party account verification that requires owner identity.

Everything else should be done by the engineering agent and reported after completion.
