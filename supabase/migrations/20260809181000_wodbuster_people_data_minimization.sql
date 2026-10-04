-- mc_people may be self-readable by the linked customer. Never retain the raw
-- WodBuster Atletas payload there because it can contain unnecessary PII such as
-- phone, DNI, address, tariff or other administrative fields.

update public.mc_people
set metadata = metadata - 'wodbuster_snapshot',
    updated_at = now()
where metadata ? 'wodbuster_snapshot';

comment on column public.mc_people.metadata is
  'Product metadata only. Raw WodBuster Atletas payloads must never be stored here.';
