-- Las políticas de Programming ya usan memberships/capabilities. Conservamos
-- los helpers legacy por compatibilidad de rollback, pero dejamos de exponerlos
-- como RPC a clientes autenticados.
--
-- Rollback: devolver EXECUTE de ambos helpers al rol de usuarios autenticados.

revoke all on function public.pe2_my_org()
  from public, anon, authenticated;
revoke all on function public.pe2_my_role()
  from public, anon, authenticated;

grant execute on function public.pe2_my_org()
  to service_role;
grant execute on function public.pe2_my_role()
  to service_role;
