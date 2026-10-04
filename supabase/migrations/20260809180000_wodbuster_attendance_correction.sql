-- Compatibility migration for staging/environments where the initial mirror
-- already exists. A later WodBuster correction may remove a previously set
-- FechaLecturaTorno, so attended_at must be nullable and confirmed becomes
-- the canonical boolean used by product logic.

alter table public.mc_wodbuster_attendance
  alter column attended_at drop not null,
  alter column confirmed set default false;

comment on table public.mc_wodbuster_attendance is
  'Attendance confirmation mirror keyed by reservation; only confirmed=true counts as real attendance.';
