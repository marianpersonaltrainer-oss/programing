-- Sprint 2 — operación atómica del Centro de revisión del método.
--
-- Aditiva. NO ejecutar en producción sin aplicar antes
-- 20260720140000_method_rules_scope.sql y sin aprobación explícita.
-- La función solo puede invocarse con service_role y vuelve a comprobar en
-- profiles que el revisor pertenece a la organización y tiene rol autorizado.

create or replace function public.pe2_review_method_rule_group(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_action text := coalesce(payload ->> 'action', '');
  v_org_id uuid := nullif(payload ->> 'orgId', '')::uuid;
  v_reviewer_id uuid := nullif(payload ->> 'reviewerId', '')::uuid;
  v_allow_unscoped boolean := coalesce((payload ->> 'allowUnscoped')::boolean, false);
  v_source_ids bigint[] := coalesce(
    array(select value::bigint from jsonb_array_elements_text(coalesce(payload -> 'sourceIds', '[]'::jsonb))),
    '{}'::bigint[]
  );
  v_canonical_id bigint := nullif(payload ->> 'canonicalId', '')::bigint;
  v_rule_key text := nullif(btrim(payload ->> 'ruleKey'), '');
  v_rule_text text := nullif(btrim(payload ->> 'ruleText'), '');
  v_rule_type text := coalesce(nullif(payload ->> 'ruleType', ''), 'format');
  v_validity text := coalesce(nullif(payload ->> 'validity', ''), 'permanent');
  v_strength text := coalesce(nullif(payload ->> 'strength', ''), 'preferred');
  v_valid_from date := nullif(payload ->> 'validFrom', '')::date;
  v_valid_to date := nullif(payload ->> 'validTo', '')::date;
  v_mesocycle_key text := nullif(btrim(payload ->> 'mesocycleKey'), '');
  v_week_number int := nullif(payload ->> 'weekNumber', '')::int;
  v_day_of_week smallint[] := coalesce(
    array(select value::smallint from jsonb_array_elements_text(coalesce(payload -> 'dayOfWeek', '[]'::jsonb))),
    '{}'::smallint[]
  );
  v_class_types text[] := coalesce(
    array(select value from jsonb_array_elements_text(coalesce(payload -> 'classTypes', '[]'::jsonb))),
    '{}'::text[]
  );
  v_room_key text := nullif(btrim(payload ->> 'roomKey'), '');
  v_time_slot text := nullif(btrim(payload ->> 'timeSlot'), '');
  v_change_reason text := left(coalesce(nullif(btrim(payload ->> 'changeReason'), ''), 'revision_centro_metodo'), 500);
  v_profile_role text;
  v_profile_org uuid;
  v_source_count int;
  v_result_id bigint;
  v_first_source bigint;
begin
  if v_action not in ('save_pending', 'approve', 'reject') then
    raise exception 'invalid_action' using errcode = '22023';
  end if;

  if v_org_id is null or v_reviewer_id is null then
    raise exception 'reviewer_scope_required' using errcode = '22023';
  end if;

  select role, org_id
    into v_profile_role, v_profile_org
  from public.profiles
  where id = v_reviewer_id;

  if v_profile_role is null
    or v_profile_role not in ('programmer', 'admin', 'head_coach')
    or v_profile_org is distinct from v_org_id then
    raise exception 'reviewer_not_authorized' using errcode = '42501';
  end if;

  if cardinality(v_source_ids) < 1 or cardinality(v_source_ids) > 100 then
    raise exception 'invalid_source_ids' using errcode = '22023';
  end if;

  if (select count(distinct source_id) from unnest(v_source_ids) as source_rows(source_id)) <> cardinality(v_source_ids) then
    raise exception 'duplicate_source_ids' using errcode = '22023';
  end if;

  -- Bloquea exactamente las fuentes indicadas y evita actuar sobre reglas de
  -- otra organización o sobre reglas ya resueltas/activas.
  perform id
  from public.method_rules
  where id = any(v_source_ids)
  for update;

  select count(*)::int
    into v_source_count
  from public.method_rules
  where id = any(v_source_ids)
    and (org_id = v_org_id or (org_id is null and v_allow_unscoped))
    and coalesce(rule_status, 'legacy_unreviewed') in ('legacy_unreviewed', 'pending_review');

  if v_source_count <> cardinality(v_source_ids) then
    raise exception 'source_rules_not_reviewable' using errcode = '22023';
  end if;

  if v_canonical_id is not null then
    perform id
    from public.method_rules
    where id = v_canonical_id
      and org_id = v_org_id
      and rule_status = 'pending_review'
    for update;
    if not found then
      raise exception 'canonical_rule_not_reviewable' using errcode = '22023';
    end if;
  end if;

  if v_action = 'reject' then
    update public.method_rules
    set
      rule_status = 'rejected',
      active = false,
      org_id = coalesce(org_id, v_org_id),
      updated_at = now(),
      change_reason = v_change_reason,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'review_center', true,
        'reviewed_by', v_reviewer_id,
        'reviewed_at', now()
      )
    where id = any(v_source_ids);

    if v_canonical_id is not null then
      update public.method_rules
      set
        rule_status = 'rejected',
        active = false,
        updated_at = now(),
        change_reason = v_change_reason
      where id = v_canonical_id;
    end if;

    return jsonb_build_object(
      'ok', true,
      'action', v_action,
      'canonicalId', v_canonical_id,
      'sourceCount', cardinality(v_source_ids),
      'status', 'rejected'
    );
  end if;

  if v_rule_key is null
    or v_rule_key !~ '^[a-z][a-z0-9_]{2,79}$'
    or v_rule_text is null
    or length(v_rule_text) > 4000 then
    raise exception 'canonical_rule_incomplete' using errcode = '22023';
  end if;

  if v_rule_type not in ('timing', 'load', 'exercise', 'format', 'rest')
    or v_validity not in ('permanent', 'temporary', 'weekly_exception')
    or v_strength not in ('required', 'preferred', 'avoid', 'prohibited') then
    raise exception 'invalid_rule_dimensions' using errcode = '22023';
  end if;

  select source_id
    into v_first_source
  from unnest(v_source_ids) as source_rows(source_id)
  where v_canonical_id is null or source_id <> v_canonical_id
  limit 1;

  if v_canonical_id is null then
    insert into public.method_rules (
      rule_type,
      trigger_context,
      rule_text,
      source,
      confidence,
      active,
      rule_status,
      rule_validity,
      rule_strength,
      rule_origin,
      rule_key,
      org_id,
      mesocycle_key,
      week_number,
      valid_from,
      valid_to,
      day_of_week,
      class_types,
      room_key,
      time_slot,
      supersedes_id,
      change_reason,
      created_by,
      metadata
    ) values (
      v_rule_type,
      'method_review_center',
      v_rule_text,
      'admin',
      100,
      v_action = 'approve',
      case when v_action = 'approve' then 'active' else 'pending_review' end,
      v_validity,
      v_strength,
      'method_panel',
      v_rule_key,
      v_org_id,
      v_mesocycle_key,
      v_week_number,
      v_valid_from,
      v_valid_to,
      nullif(v_day_of_week, '{}'::smallint[]),
      nullif(v_class_types, '{}'::text[]),
      v_room_key,
      v_time_slot,
      v_first_source,
      v_change_reason,
      v_reviewer_id,
      jsonb_build_object(
        'review_center', true,
        'source_rule_ids', to_jsonb(v_source_ids),
        'reviewed_by', v_reviewer_id,
        'reviewed_at', now()
      )
    )
    returning id into v_result_id;
  else
    update public.method_rules
    set
      rule_type = v_rule_type,
      trigger_context = 'method_review_center',
      rule_text = v_rule_text,
      confidence = 100,
      active = v_action = 'approve',
      rule_status = case when v_action = 'approve' then 'active' else 'pending_review' end,
      rule_validity = v_validity,
      rule_strength = v_strength,
      rule_origin = 'method_panel',
      rule_key = v_rule_key,
      mesocycle_key = v_mesocycle_key,
      week_number = v_week_number,
      valid_from = v_valid_from,
      valid_to = v_valid_to,
      day_of_week = nullif(v_day_of_week, '{}'::smallint[]),
      class_types = nullif(v_class_types, '{}'::text[]),
      room_key = v_room_key,
      time_slot = v_time_slot,
      supersedes_id = v_first_source,
      change_reason = v_change_reason,
      updated_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'review_center', true,
        'source_rule_ids', to_jsonb(v_source_ids),
        'reviewed_by', v_reviewer_id,
        'reviewed_at', now()
      )
    where id = v_canonical_id
    returning id into v_result_id;
  end if;

  if v_action = 'approve' then
    update public.method_rules
    set
      rule_status = 'superseded',
      active = false,
      org_id = coalesce(org_id, v_org_id),
      updated_at = now(),
      change_reason = 'Sustituida por regla canónica #' || v_result_id,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'review_center', true,
        'superseded_by', v_result_id
      )
    where id = any(v_source_ids)
      and id <> v_result_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'action', v_action,
    'canonicalId', v_result_id,
    'sourceCount', cardinality(v_source_ids),
    'status', case when v_action = 'approve' then 'active' else 'pending_review' end
  );
end;
$$;

revoke all on function public.pe2_review_method_rule_group(jsonb) from public;
revoke all on function public.pe2_review_method_rule_group(jsonb) from anon;
revoke all on function public.pe2_review_method_rule_group(jsonb) from authenticated;
grant execute on function public.pe2_review_method_rule_group(jsonb) to service_role;

comment on function public.pe2_review_method_rule_group(jsonb) is
  'Revisión atómica de grupos method_rules. Solo service_role; revalida perfil, rol y organización.';
