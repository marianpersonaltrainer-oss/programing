# Inventario de reglas — Sprint 1

Generado: 2026-07-20T12:24:02.882Z

> Script read-only. No modifica Supabase ni inserta seeds.

## Contradicciones críticas (no activar automáticamente)

- **warmup_visibility**: systemPrompt.js: calentamiento SIEMPRE vs systemPromptExcel/DayEdit: NO obligatorio global
- **landmine_frequency**: DEFAULT_METHOD + systemPrompt.js: OBLIGATORIO vs systemPromptExcel.js: opcional
- **feedback_format**: systemPromptExcel: viñetas 4 bloques vs QA/regen: prosa corrida

## Duplicadas

- Prohibiciones MU/OHS/thruster: DEFAULT_METHOD + systemPrompt + Excel
- EvoFit sin olímpicos: DEFAULT_METHOD + systemPromptExcel
- Ensayo calentamiento: systemPrompt + Excel BLOQUE 3 (cuando hay calentamiento)

## Desactualizadas

- API_COSTS.md: 2 llamadas Excel (hoy 1 POST/día)

## Pendientes de revisión

- 53 filas method_rules en producción → legacy_unreviewed tras migración
- localStorage programingevo_method_learned (por dispositivo)
- Restricciones julio/agosto (operativas; no hardcodeadas en prompts)

## Candidatas permanentes

- **warmup_purpose**: Ensayo del día cuando hay calentamiento
- Prohibiciones ejercicios extremos (MU, OHS principal)
- EvoFit sin movimientos olímpicos
- Basics juego máx 2 días/semana (Excel)

## Candidatas temporales

- **summer_schedule**: Horario/carga verano; valid_from/valid_to jul–ago
- **effective_duration**: 32 min en verano si se confirma

## Hits por rule_key en fuentes del repo

- `warmup_visibility`: systemPrompt.js, systemPromptExcel.js
- `warmup_purpose`: systemPrompt.js, systemPromptExcel.js
- `landmine_frequency`: systemPrompt.js, systemPromptExcel.js, MethodPanel DEFAULT_METHOD
- `basics_skill_progression`: systemPrompt.js, systemPromptExcel.js, systemPromptDayEdit.js, MethodPanel DEFAULT_METHOD
- `room_capacity`: systemPrompt.js, systemPromptExcel.js
- `feedback_format`: systemPromptExcel.js, systemPromptDayEdit.js
- `effective_duration`: systemPromptExcel.js

Ver JSON completo: `docs/rules-inventory.generated.json`
