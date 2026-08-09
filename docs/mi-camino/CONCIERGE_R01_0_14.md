# R01 Concierge Validation — days 0→14

Status: required evidence gate before expanding Mi Camino functionality.

## Goal

Validate the experience and coach workload without waiting for the complete app.

This is **not** a marketing pilot and not a test of every Mi Camino feature. It tests the central recovery/adherence loop.

## Participants

5–8 people compatible with R01 (`Vuelta después de una pausa`).

Exclude cases already defined as requiring sensitive/professional handling.

## What is simulated

Use the current operational communication channel and lightweight manual tracking. Do not install a new app/tool for this test.

For each participant simulate only when applicable:
1. initial next step;
2. first-class briefing to coach;
3. first-class quick closure;
4. check-in;
5. Plan B if continuity risk occurs;
6. contextual coach contact if automation/manual step does not resolve it.

## Minimum record per participant

At each relevant event capture:

- `understood_without_extra_explanation`: yes/no
- `customer_interaction_seconds`
- `coach_task_seconds`
- `action_helpfulness`: yes/partial/no
- `task_ignored`: yes/no
- `ignored_reason`: optional structured reason
- `support_perception`: short answer
- `copy_or_flow_friction`: max one line

Do not collect extra health detail merely for research.

## Coach task observation

For every coach intervention verify:
- could the coach understand the task in <30 seconds?
- could the ordinary intervention finish in 2–3 minutes?
- did the coach need to search history manually?
- was the suggested next action usable?
- if the task was not done, why?

## Customer observation

Verify:
- does the person know what to do next?
- does Plan B feel like continuity rather than punishment/failure?
- does the check-in feel useful rather than bureaucratic?
- does a quiet/stable week still feel accompanied?

## Gate

Pass when all are true:

1. ≥80% of participants understand principal actions without extra explanation.
2. Ordinary coach tasks are ≤3 minutes in real use.
3. No repeated confusion requires a structural R01 redesign.
4. No safety/privacy issue appears that requires stopping the flow.
5. At least one stable case and one disrupted-week case have been observed.

If the gate fails, fix only the demonstrated friction, rerun the smallest affected portion, and do not open new product scope.

## Owner model

- System/design owner: Mi Camino product specification.
- Test execution: assigned EVO staff during normal operations.
- Marian: reviews only method/experience/privacy findings that cross an approval gate.
- Codex: receives confirmed changes only after the evidence review.
