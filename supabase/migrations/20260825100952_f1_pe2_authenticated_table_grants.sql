-- Corrige "permission denied for table pe2_programmer_state" y equivalentes.
--
-- Causa: 20260629150000_pe2_structured_auth se escribió en junio, cuando las
-- tablas nuevas heredaban privilegios para `authenticated` por defecto. El
-- endurecimiento de privilegios por defecto de agosto (f0) eliminó esa
-- herencia, así que las tablas creadas después quedaron con políticas RLS
-- correctas pero sin el GRANT base: RLS filtra filas, pero sin GRANT el motor
-- rechaza la consulta antes de evaluar la política.
--
-- pe2_weeks no estaba afectada porque se creó antes del endurecimiento. El
-- fallo solo se manifestó el 25 de agosto de 2026, al entrar la primera
-- identidad real en producción: hasta entonces no había nadie autenticado que
-- pudiera toparse con él.
--
-- La autorización real la siguen imponiendo las políticas de
-- f1_programming_capability_rls (capacidades programming.manage /
-- programming.read_published). Aquí solo se devuelve el permiso base que esas
-- políticas necesitan para poder aplicarse. `anon` no recibe nada.
--
-- Rollback: revoke de los grants a authenticated en estas seis tablas.

grant select, insert, update, delete on table public.pe2_programmer_state to authenticated;
grant select, insert, update, delete on table public.pe2_class_types to authenticated;
grant select, insert, update, delete on table public.pe2_exercises to authenticated;
grant select, insert, update, delete on table public.pe2_sessions to authenticated;
grant select, insert, update, delete on table public.pe2_blocks to authenticated;
grant select, insert, update, delete on table public.pe2_block_items to authenticated;

revoke all on table public.pe2_programmer_state from anon;
revoke all on table public.pe2_class_types from anon;
revoke all on table public.pe2_exercises from anon;
revoke all on table public.pe2_sessions from anon;
revoke all on table public.pe2_blocks from anon;
revoke all on table public.pe2_block_items from anon;
revoke all on table public.pe2_weeks from anon;
