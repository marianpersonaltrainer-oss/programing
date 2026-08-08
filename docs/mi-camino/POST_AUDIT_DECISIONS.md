# Mi Camino EVO — Post-audit decisions

Approved: 2026-08-08

This file records the execution changes approved after the external audit. It does **not** replace the product design; it changes build order and closes ambiguities.

## 1. Product stays frozen

Do not redesign or delete the approved 0→180 experience. Days 31→180, Story of Evolution, EVO del Mes and expanded gamification remain approved backlog but are blocked from build until the first R01 slice proves the engine.

## 2. Two active fronts only

### Data truth
- verify WodBuster granularity;
- choose `complete / partial / insufficient` branch;
- rotate credentials before live use;
- save historical baseline.

### Human truth
- concierge R01 days 0→14 with 5–8 people;
- measure comprehension, coach time, ignored tasks, support perception and copy friction.

No #22 build. No #17/#18 expansion until both evidence gates pass.

## 3. Canonical Plan B naming

Implementation source of truth:
- B1 · Mantener el vínculo
- B2 · Sustituir la sesión
- B3 · Mantener el estímulo

Any older conflicting wording is superseded.

## 4. Independent clocks

Day-30 checkpoint is calendar-driven. Attendance milestone 10 is event-driven. One never blocks the other.

## 5. Recognition privacy

Safe milestones are public by default. No general privacy preference is added to the customer UI.

Admin/staff may apply a discreet `private_recognition` exception for an explicit customer request or a sensitive circumstance. Sensitive personal data is never announced publicly.

## 6. Critical notifications

Risk recovery cannot depend only on app opening. Build a configurable external notification-channel contract, but do not add a new vendor/tool until existing capabilities are reviewed.

## 7. Veteran state

Existing members must not be forced into a fake day-0 journey. Preserve/import history where possible and calculate the next relevant milestone without retroactive celebration floods.

## 8. Coach capacity/failure path

Every task needs owner, due time, overdue state, reassignment rule and final admin escalation. Coach absence/vacation/substitution must not create a routine Marian bottleneck.

## 9. Privacy/legal gate

Legal/privacy package is an explicit launch gate. Codex prepares technical evidence; human/professional review approves the legal basis, notices, retention, processors and sensitive-data treatment.

## 10. Decision numbering correction

The two duplicate identifiers in the previous decision export are corrected in the new canonical export:
- second `DA-042` (visual direction) → `DA-069`;
- second `DA-043` (technical architecture/autonomy) → `DA-070`.

New post-audit decisions continue from DA-071.
