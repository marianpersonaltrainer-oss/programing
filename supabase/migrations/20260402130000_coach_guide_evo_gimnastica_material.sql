-- Resumen EvoGimnástica en material_override (pestaña Material de la guía coach).
-- Idempotente: no duplica si ya está el marcador.
-- La versión completa y actualizada vive en código: src/data/coachGuideContent.js (COACH_GIMNASTICA_EXTENDED_BLOCKS).

update public.coach_guide_settings
set
  material_override = trim(both from coalesce(material_override, '') || case
    when coalesce(material_override, '') like '%[EVO] Guía EvoGimnástica — abril 2026%' then ''
    else E'\n\n[EVO] Guía EvoGimnástica — abril 2026\n'
      || E'Identidad: cuerpo libre con técnica + diversión (relevos, circuitos, ritmo). No es solo tracción dura cada semana.\n'
      || E'Rotación sugerida por semanas: (A) Tracción+core — pull-ups, scapular, hollow/arch, plank. '
      || E'(B) Empuje+balance — pike push, handstand pared/freestanding scale, shoulder taps. '
      || E'(C) Acrobático+dinámico — cartwheels básicos, kipping educado, saltos, juegos.\n'
      || E'Escalados rápidos — Pull: dead hang/banda/ring rows → asistido/negativas → strict. '
      || E'Vertical: pike caja+wall walk → chest-to-wall+taps → freestanding/HSPU scaled. '
      || E'Dips: soporte box → ring support+negativas → ring dips.\n'
      || E'Coach: máx. ~1 min de charla por bloque; el resto es hacer y corregir.\n'
      || E'Guía detallada (3 semanas ejemplo, bloques listos): app coach → Guía → Clases → EvoGimnástica.\n'
  end),
  updated_at = now()
where id = 'default';
