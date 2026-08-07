# Mi Camino EVO V1 — UI / Screen Specification

## Product rule

Every screen has one dominant question/action. Do not render all engines at once.

---

# A. Customer — Mi Camino EVO

Primary navigation: **Hoy · Mi camino · Evolución · Perfil**

## A1. Login / access

### Purpose
Enter Mi Camino with minimum friction.

### V1 states
- magic-link request;
- password fallback;
- link sent;
- auth error;
- authenticated but not linked to `mc_people`;
- expired session.

### Main action
`Enviarme acceso` or `Entrar`.

---

## A2. Hoy

### Purpose
Answer in ~5 seconds: **what do I need to do now and how am I going?**

### Always visible
1. one primary card resolved by priority;
2. this-week progress;
3. next milestone.

### Primary-card priority
1. safety/human review required;
2. action due today;
3. check-in due;
4. active Plan B/recovery action;
5. next class;
6. positive no-action state.

### Never simultaneously add
- full badge collection;
- challenge table;
- every resource;
- full journey timeline;
- long educational content.

Those live elsewhere.

---

## A3. Mi camino — overview

### Purpose
Show the current 0–90 journey / bridge and the active focus.

### Content
- journey name;
- current stage;
- agreed frequency;
- current action;
- contextual resource if one is active;
- Plan B only if active/relevant;
- next checkpoint when useful.

### Journey labels
- `return_after_pause`: volver a coger mi rutina;
- `organization`: encontrar mi forma de organizarme;
- `all_or_nothing`: construir constancia sin empezar de cero.

No fourth tiredness journey.

---

## A4. Check-in

### Purpose
Collect approved weekly signal in <1 minute.

### Questions
1. `¿Cómo de difícil te ha resultado mantener tu plan esta semana?`
   - Fácil
   - Bien, aunque he tenido que ajustar
   - Difícil
2. `¿Cómo ha estado tu energía?`
   - Baja
   - Normal
   - Buena
3. `¿Crees que puedes mantener tu plan la próxima semana?`
   - Sí
   - Sí, pero creo que necesitaré Plan B
   - No estoy seguro/a → final implementation must use neutral wording; prefer `No lo tengo claro`.

### UX
One question at a time, progress 1/3 → 3/3, final single submit.

### Output
System response is contextual, not a generic score.

---

## A5. Plan B

### Purpose
Keep continuity when the original week is no longer viable.

### Content
- why it appeared, without blame;
- one recommended Plan B;
- max one alternative;
- duration/material;
- clear `Empezar` / `Lo haré después` action;
- safety-blocked state routes to human/safe message.

### Families
- B1 maintain link;
- B2 replace session;
- B3 maintain specific stimulus.

### Important
Completion shows `Semana mantenida/adaptada`; never class attendance.

---

## A6. Resource card / guide

### Purpose
Show one contextual education/action resource only when relevant.

Examples:
- first-week normal sensations;
- sleep routine when poor sleep is reported;
- scaling explanation when insecurity/level concern appears;
- strength explanation when relevant;
- all-or-nothing reflection.

### UX
Short card/step flow, never a mandatory long PDF.

---

## A7. Evolución

### Purpose
Make progress emotionally visible and enjoyable.

### Hierarchy
1. next milestone;
2. latest/earned badges;
3. personal challenge when active;
4. collective mission when active;
5. temporary team challenge when active;
6. timeline / Story of Evolution entry.

No permanent person-to-person leaderboard.

### Visual direction
Light premium-active, calm surface + more expressive achievement cards.

---

## A8. All badges

### Purpose
Collection view.

Families:
- Continuidad;
- Evolución;
- Comunidad;
- Especiales.

### Initial neutral naming direction
- En marcha
- Ritmo EVO
- Suma y sigue
- Sin pausa
- De vuelta
- Nueva ruta
- Paso abierto
- Modo EVO
- Trayectoria EVO
- EVO del mes
- Equipo en marcha
- VIP EVO
- Imparable
- Sin frenar
- Misión cumplida
- Reto superado

Locked badges may show the next clear condition if safe and not behaviorally harmful.

---

## A9. Milestone unlocked

### Purpose
Create a celebration moment.

### Content
- badge art;
- neutral milestone name;
- what it means in one sentence;
- next step, if one exists.

This screen is short and celebratory; recognition in class is handled separately by EVO Coach.

---

## A10. Personal challenge

Examples:
- maintain base frequency for 3 weeks;
- resume after interruption;
- follow recovery action for agreed period.

The progress target must be sustainable and capped; no extra reward for overtraining.

---

## A11. Misión EVO collective

### Purpose
Belonging without personal comparison.

Example structure:
`628 / 750 entrenamientos juntos`

Customer sees total + their contribution only when meaningful. They do not see a ranked list of people.

---

## A12. Temporary team challenge

### Purpose
Occasional playful mini-competition.

### Content
- team A score;
- team B score;
- customer contribution;
- time remaining;
- behavior used for points.

Never show an individual ranking within the team.

---

## A13. Organization experiment

Only for organization journey when needed.

### Steps
- what time window they think works;
- two-week real attendance/reservation experiment;
- summary of reliable window;
- confirm/adapt strategy.

Do not hardcode Sunday/Saturday opening time. React to reservation availability/config.

---

## A14. All-or-nothing reflection

### Purpose
Recognize pattern without guilt, then choose one next action.

### Flow
- what happened;
- what thought appeared;
- what do you need now;
- one next action.

Not therapy and not an open-ended journal.

---

## A15. Sleep / energy adaptive module

Only appears when sleep/rest signal supports it.

### Flow
- short sleep/rest trial;
- 3 nights/week × 2 weeks as approved initial experiment;
- if improved → maintenance;
- if habits implemented but fatigue persists → `Reviso mi energía` and safe professional guidance;
- no automatic supplement/analysis interpretation.

---

## A16. Day 30 result

### Purpose
Show early evidence and next direction.

Content combines:
- planned vs confirmed attendance;
- adapted/maintained weeks;
- relevant Plan B use;
- short coach observation;
- one output: stable / one adjustment / human review.

---

## A17. Day 60 result

Same component system with second-stage evidence. No new dashboard.

---

## A18. Commitment moment — month 3

### Purpose
Address loss of novelty/impulse.

Customer selects:
- maintaining naturally;
- harder than beginning but wants to continue;
- losing impulse and worried about abandoning.

Stable = no human task. Risk + evidence = coach task.

---

## A19. Story of Evolution — week 11

### Content
- where I started;
- intended frequency;
- actual attendance;
- Plan B/adaptations;
- cycles/actions completed;
- wellbeing signals;
- validated coach observations;
- physical references when approved and relevant;
- next focus.

Coach validates rather than writes from scratch.

---

## A20. Day 90 decision

### Step 1
Is the original barrier controlled enough?

### If yes
Choose/recommend one next goal:
- Maintain
- Composition/body-fat direction with general healthy guidance
- Strength/muscle
- Mobility
- Help me decide

### If no
Continue a lightweight barrier plan; do not stack a new goal.

---

## A21. Puente EVO 90–180

Same `Mi camino` shell, no second app.

Shows:
- one next goal;
- recommended frequency;
- one current outside-training action;
- next relevant milestone;
- challenge only when active;
- inherited barrier guardrails.

---

## A22. Day 180 review

Options:
- advancing, continue;
- doing it but somewhat stuck;
- want more personalized work;
- struggling to continue.

Outputs:
- next milestone;
- basic adjustment;
- one future paid-product recommendation slot;
- human retention contact before sales when at-risk.

---

## A23. Profile

Only minimal operational account information:
- name/email;
- agreed frequency;
- recent/next class summary;
- account/session controls.

Do not expose admin/debug data.

---

# B. EVO Coach — trainer surface

Reuse existing Programming EVO shell.

## B1. Coach Today

Sections ordered by action priority, not customer list.

Cards:
- new customer/first class;
- quick 2–3 min contact;
- checkpoint review;
- milestone recognition;
- class-option validation;
- sensitive review;
- turn/operational tasks already defined elsewhere.

Stable customers do not appear just because they exist.

---

## B2. First-class briefing

Shows intake summary + exact quick fields.

Coach does not browse CRM.

---

## B3. First-class close

Specific quick inputs such as completion, load/reference, adaptation/important note according to approved template.

Target duration: about 2 min.

---

## B4. 2–3 minute contact

Layout:
- What happened
- What customer expressed
- What system tried
- Goal
- What to say
- Recommended proposal
- Outcome buttons

---

## B5. Checkpoint review

Week2/day30/day60/week11.

- evidence summary auto-generated;
- max two categories;
- optional one short line;
- one outcome.

---

## B6. Recognition card

Fields:
- customer;
- milestone;
- why it triggered;
- say it during first mobility minute;
- exact suggested line.

Outcomes:
- Celebrated
- Absent
- Defer
- Data wrong

---

## B7. New option validation

Outputs:
- Open new option
- Keep and review later
- Talk to customer

Language: `Nueva ruta/opción`, not rigid level graduation.

---

# C. Admin EVO

## C1. Overview

Only actionable management summary:
- integration health;
- overdue coach tasks;
- journeys with abnormal failure rate;
- upcoming milestone/recognition volume;
- active challenge;
- publishing/config alerts.

No vanity dashboard by default.

---

## C2. Journey templates

- three active 0–90 journeys;
- versions/draft/published;
- stages/actions/config;
- archive, not hard-delete historical versions.

---

## C3. Puente 90–180

Common bridge config + goal modules.

---

## C4. Plan B library

Filter B1/B2/B3.
Edit:
- title;
- duration;
- level range;
- equipment;
- goal/stage tags;
- safety exclusions;
- instructions;
- active/version.

---

## C5. Resource library

Contextual cards/guides/reflections/videos/links with trigger tags and versions.

---

## C6. Milestones

Edit:
- neutral name;
- category;
- trigger;
- threshold/config;
- requires validation;
- public recognition;
- priority;
- badge artwork;
- coach/customer copy;
- active/version.

---

## C7. Challenges

Personal / collective / teams.
Rules must prevent unlimited reward for extra attendance.

---

## C8. Coach scripts

Versioned templates for 2–3 minute conversations and milestone recognition.

---

## C9. Rule settings

Configurable values expected to change operationally. Avoid raw JSON for normal use.

---

## C10. Integrations

WodBuster:
- connected/degraded/blocked;
- last hook received;
- last reconciliation success;
- lag/errors count;
- run reconciliation button for admin if safe.

Never show secret values.

---

## C11. Audit

Who changed/published what and when.

---

# D. Cross-screen requirements

- Body >=16px on customer app.
- Touch target >=44×44.
- Keyboard focus visible.
- Error is text + state, not color only.
- Customer copy follows Marian voice guide.
- Loading skeleton/spinner does not hide critical errors indefinitely.
- Never show medical/body-sensitive data publicly.
- No gendered badge naming.
- Customer actions should have at most three options; default/recommend one where relevant.
- Business schedules are configurable/event-driven, not embedded in components.
