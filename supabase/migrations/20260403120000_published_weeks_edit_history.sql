-- Historial de cambios en JSON de semana (programador / guardados desde modal Excel)
ALTER TABLE published_weeks
  ADD COLUMN IF NOT EXISTS edit_history jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN published_weeks.edit_history IS
  'Array JSON: { at, actor, source, changes: [{ day, class, field, before, after }] }';
