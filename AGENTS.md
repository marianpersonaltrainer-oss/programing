# AGENTS.md — Evolution Boutique Fitness

## 1. Mission

Build and maintain EVO software so Marian only needs to decide matters that cannot be safely resolved by the engineering agent: product method, customer experience, privacy trade-offs, business policy and final launch approval.

For implementation details, choose the safest simple option, document it, test it and continue. Do not ask Marian to choose libraries, folder structures, SQL details, API client patterns, CI commands, cache strategy, deployment internals or other routine engineering decisions.

## 2. Current product surfaces

- **Programming EVO**: existing programming product and the base repository.
- **EVO Coach**: trainer-facing operational surface. Reuse the existing app/repository; do not create a separate CRM.
- **Mi Camino EVO**: customer-facing web experience for journeys, Plan B, check-ins, milestones, evolution and the 90–180 day bridge.
- **Admin EVO**: configuration surface for journeys, resources, Plan B, milestones, rules and messages.
- **Nucleus EVO**: shared data/events/tasks layer in Supabase. Mi Camino tables use the `mc_` prefix.

## 3. Source-of-truth boundaries

- **WodBuster** remains the administrative source of truth for people, contracts, payments, reservations and attendance.
- **Supabase / Nucleus EVO** stores Mi Camino state, event mirrors, journeys, rules, coach tasks, milestones, resources and audit data.
- Never make a reservation equal attendance. Attendance-based milestones require confirmed attendance data.
- Do not duplicate payment or contract ownership into Mi Camino unless a read model is strictly required.

## 4. Hosting and environments

This is a web product, never a local-only tool.

- Frontend/serverless web: **Vercel**.
- Data/Auth/RLS/Edge Functions: **Supabase**.
- Code/issues/PRs/CI: **GitHub**.
- Design source: Figma when available; production UI is still code-first and must be reproducible from repository tokens/components.

Environment order:

1. local development when useful;
2. `programing-evo-staging` Supabase + Vercel preview/staging;
3. production only after automated tests + explicit launch approval.

Never apply a new Mi Camino migration directly to production first.

## 5. Security rules

- Never commit secrets.
- Never put WodBuster credentials, Supabase service-role keys or any privileged key in `VITE_*` variables.
- Browser code gets only publishable/anon credentials that are safe for the client and relies on RLS.
- WodBuster credentials remain server-side only.
- Treat any WodBuster key previously found in documents as exposed. Require rotation before production use; never reproduce it in code, issues or logs.
- Prefer Supabase Auth + RLS over shared coach codes or localStorage secrets for privileged data.
- Add least-privilege RLS for every new table before calling the feature complete.
- Run Supabase security advisors after DDL/RLS changes.

## 6. WodBuster integration contract

Critical events must use the official WodBuster API/RestHooks available to the account, with periodic reconciliation.

Required conceptual data:
- user/customer identity;
- class/reservation identity;
- reservation create/cancel/change;
- confirmed attendance/no-show when available;
- class start + coach identity when available.

Implementation rules:
- isolate WodBuster behind a server-side adapter;
- exact URLs/auth are environment configuration, not scattered through UI code;
- make ingestion idempotent using external event/reservation/attendance IDs;
- persist raw inbound events before processing;
- retries must not double-award a milestone or double-create a coach task;
- reconciliation must repair missed webhooks;
- CSV/manual reconciliation is the documented emergency fallback;
- Zapier, if used, is only a low-risk transport and never source of truth.

Do not invent undocumented WodBuster endpoints. If official access cannot be verified, implement the adapter contract + mock and mark the live connector blocked rather than guessing.

## 7. Product constraints

### Customer UX
- Mobile-first.
- Navigation V1: `Hoy`, `Mi camino`, `Evolución`, `Perfil`.
- One main idea + one main action per screen.
- Interactions should normally take under one minute.
- Do not surface every available feature on the Home screen.

### Coach UX
- Ordinary human intervention max 2–3 minutes.
- Every task shows: what happened, what the customer expressed, what automation tried, goal of the conversation, exact suggested wording, one recommended action, one-tap outcome.
- A stable customer should not create manual work.

### Admin UX
- Rules/content/milestone thresholds must be editable without code when reasonably expected to change.
- Do not hardcode business schedules such as “Sunday 19:00”. Store event/availability-driven rules or configurable settings.

## 8. Active 0–90 journeys

Only these three are active in V1:

1. `return_after_pause` — Vuelta después de una pausa.
2. `organization` — No consigo organizarme.
3. `all_or_nothing` — Empiezo fuerte y termino abandonando.

Do not recreate “always tired” as a fourth journey. Energy/rest is an adaptive module within the first journey.

All three may converge after day 90 into the common **Puente EVO 90–180**, while keeping learned barrier/context.

## 9. Plan B contract

Plan B is adaptive and does not count as class attendance.

Families:
- `B1`: maintain the link / gentle continuity.
- `B2`: replace the missed session.
- `B3`: maintain a more specific training stimulus for stable/advanced users.

A Plan B may make a week `maintained/adapted`, but must never increment attendance milestones.

Safety exclusions (new pain, injury, illness, meaningful malaise, medical rest or other sensitive signal) stop automatic exercise advice and route to safe review.

## 10. Milestones and gamification

- Publicly celebrate safe achievement milestones in class; never expose sensitive health/body/personal information.
- Recognition should fit the first mobility minutes and normally take <1 minute.
- Maximum two public recognitions per class; defer the rest.
- No permanent individual leaderboard.
- Gamification weighting: primarily personal progress, then collective missions, then occasional team mini-challenges.
- Never reward training above the agreed sustainable frequency.
- Badge names must be gender-neutral.

Initial examples: `En marcha`, `Ritmo EVO`, `Suma y sigue`, `De vuelta`, `Nueva ruta`, `Modo EVO`, `Trayectoria EVO`, `EVO del mes`, `Sin frenar`, `Misión cumplida`.

## 11. Voice and visual system

Use the EVO design tokens and brand documentation already in the repository/project.

Voice: close, human, clear, calm and practical. One CTA. No corporate filler, hype or guilt.

Visual direction for Mi Camino: light premium-active shell, elegant and warm, with playful milestone/badge moments. Do not turn the full app into a game or a dense dashboard.

Do not silently introduce random fonts/colors. Formalize any approved visual extension as a token first.

## 12. Engineering workflow

For every non-trivial feature:

1. Read the relevant docs + existing code.
2. Create/update an issue with acceptance criteria if one does not exist.
3. Work on a feature branch.
4. Add migrations before data-dependent UI.
5. Add tests for business rules and failure cases.
6. Run `npm run test:ci` plus feature-specific tests.
7. Deploy/verify preview or staging.
8. Run security/performance checks when relevant.
9. Open PR with summary, test evidence, risks, rollback.
10. Do not merge to production merely because code compiles.

## 13. Definition of Done

A feature is not done until:
- acceptance criteria pass;
- loading/empty/error states exist;
- mobile UX is usable;
- accessibility basics pass (labels, focus, contrast, 44px targets);
- RLS/security is verified for data features;
- repeated events are idempotent;
- logs provide enough context to diagnose failures without secrets;
- tests pass;
- staging/preview is verified;
- docs are updated;
- rollback path is clear.

## 14. Human approval gates

Ask Marian only when one of these is genuinely required:

- change to EVO method/customer journey/business rules;
- wording/tone that materially changes the customer promise;
- privacy/public-recognition trade-off not already documented;
- new paid product/pricing;
- a destructive migration or irreversible production action;
- new external service with material ongoing cost;
- final production launch/domain change;
- required credential/API enablement that only account owner can do.

When asking, give one recommended option and at most two alternatives.

## 15. Things not to do

- Do not build extra journeys or feature ideas “just in case”.
- Do not create a second trainer app.
- Do not create a second database as a default response to domain separation.
- Do not use a new SaaS when a rule, existing app or small server function is enough.
- Do not let a missing external API block UI/rules work: use a typed adapter + fixtures, then connect live later.
- Do not hide technical blockers. Mark them explicitly with owner and exact unblock action.
