import { useCallback, useEffect, useState } from 'react'
import { evoBrand } from '../../constants/evoBrand.js'
import {
  archivePe2Week,
  createPe2WeekDraft,
  listPe2WeeksForSlot,
} from '../../lib/pe2Supabase.js'
import { formatPe2SlotLabel, PE2_STATUS_LABELS, readPe2SlotFromV1 } from './pe2Slot.js'

const MIGRATION_SQL = `-- Programación V2 — pe2_weeks
-- Pegar en Supabase → SQL Editor → Run

create table if not exists public.pe2_weeks (
  id uuid primary key default gen_random_uuid(),
  mesociclo text not null,
  semana integer not null check (semana >= 1),
  phase text,
  titulo text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'generating', 'ready', 'archived')),
  is_primary boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  proposal jsonb,
  briefing_pack text,
  generation_log jsonb not null default '[]'::jsonb,
  published_week_id uuid references public.published_weeks (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pe2_weeks_one_primary_per_slot
  on public.pe2_weeks (mesociclo, semana)
  where is_primary = true and status <> 'archived';

create unique index if not exists pe2_weeks_one_ready_per_slot
  on public.pe2_weeks (mesociclo, semana)
  where status = 'ready';

create index if not exists pe2_weeks_mesociclo_semana_idx
  on public.pe2_weeks (mesociclo, semana, updated_at desc);

create index if not exists pe2_weeks_status_idx
  on public.pe2_weeks (status);

create or replace function public.pe2_weeks_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pe2_weeks_set_updated_at on public.pe2_weeks;
create trigger pe2_weeks_set_updated_at
  before update on public.pe2_weeks
  for each row execute function public.pe2_weeks_set_updated_at();

alter table public.pe2_weeks enable row level security;

drop policy if exists pe2_weeks_select_anon on public.pe2_weeks;
create policy pe2_weeks_select_anon on public.pe2_weeks for select to anon, authenticated using (true);

drop policy if exists pe2_weeks_insert_anon on public.pe2_weeks;
create policy pe2_weeks_insert_anon on public.pe2_weeks for insert to anon, authenticated
  with check (length(trim(mesociclo)) > 0 and semana >= 1);

drop policy if exists pe2_weeks_update_anon on public.pe2_weeks;
create policy pe2_weeks_update_anon on public.pe2_weeks for update to anon, authenticated
  using (true) with check (length(trim(mesociclo)) > 0 and semana >= 1);
`

function statusStyle(status) {
  if (status === 'ready') return { bg: '#E8F5EC', color: '#1F8A4C', border: '#1F8A4C44' }
  if (status === 'generating') return { bg: '#FFF4E5', color: '#B45309', border: '#B4530944' }
  return { bg: `${evoBrand.purple}11`, color: evoBrand.purple, border: `${evoBrand.purple}33` }
}

export default function Pe2HomeView({ slot, onOpenWeek, onSelectDraft, selectedDraftId }) {
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [copiedSql, setCopiedSql] = useState(false)

  const loadDrafts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await listPe2WeeksForSlot(slot.mesociclo, slot.semana)
      setDrafts(rows)
      if (!selectedDraftId && rows.length > 0) {
        const primary = rows.find((r) => r.is_primary) || rows[0]
        onSelectDraft?.(primary.id)
      }
    } catch (e) {
      setDrafts([])
      setError(e.message || 'Error al cargar borradores')
    } finally {
      setLoading(false)
    }
  }, [slot.mesociclo, slot.semana, selectedDraftId, onSelectDraft])

  useEffect(() => {
    loadDrafts()
  }, [loadDrafts])

  async function handleCreateDraft() {
    setCreating(true)
    setError('')
    try {
      const row = await createPe2WeekDraft({
        mesociclo: slot.mesociclo,
        semana: slot.semana,
        phase: slot.phase,
        titulo: `${formatPe2SlotLabel(slot)} · borrador`,
        data: { titulo: `${formatPe2SlotLabel(slot)}`, dias: [] },
        is_primary: drafts.length === 0,
      })
      onSelectDraft?.(row.id)
      await loadDrafts()
    } catch (e) {
      setError(e.message || 'No se pudo crear el borrador')
    } finally {
      setCreating(false)
    }
  }

  async function handleArchive(id) {
    if (!window.confirm('¿Archivar este borrador? (no se borra de la base; queda oculto)')) return
    setError('')
    try {
      await archivePe2Week(id)
      if (selectedDraftId === id) onSelectDraft?.(null)
      await loadDrafts()
    } catch (e) {
      setError(e.message || 'No se pudo archivar')
    }
  }

  async function copyMigrationSql() {
    try {
      await navigator.clipboard.writeText(MIGRATION_SQL)
      setCopiedSql(true)
      setTimeout(() => setCopiedSql(false), 2500)
    } catch {
      setError('No se pudo copiar al portapapeles')
    }
  }

  const v1Slot = readPe2SlotFromV1()

  return (
    <div className="max-w-3xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: evoBrand.muted }}>
        ProgramingEvo · V2
      </p>
      <h1 className="font-evo-display text-3xl sm:text-4xl font-bold mb-4" style={{ color: evoBrand.text }}>
        Programación V2
      </h1>

      <div
        className="rounded-2xl border px-5 py-4 mb-6"
        style={{ backgroundColor: evoBrand.paleYellow, borderColor: `${evoBrand.purple}44` }}
      >
        <p className="text-sm font-bold uppercase tracking-wide mb-1" style={{ color: evoBrand.purple }}>
          Slot activo
        </p>
        <p className="text-sm leading-relaxed" style={{ color: evoBrand.text }}>
          {formatPe2SlotLabel(slot)} — tomado del programador V1 (<code className="text-xs">/</code>).
          Cambia mesociclo/semana allí y recarga <code className="text-xs">/?v2</code>.
        </p>
        {v1Slot.mesociclo !== slot.mesociclo || v1Slot.semana !== slot.semana ? (
          <p className="text-xs mt-2" style={{ color: evoBrand.muted }}>
            V1 ahora muestra {formatPe2SlotLabel(v1Slot)} — recarga para sincronizar.
          </p>
        ) : null}
      </div>

      {error ? (
        <div
          className="rounded-2xl border px-4 py-3 mb-6 text-sm"
          style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', color: '#991B1B' }}
        >
          <p className="font-semibold mb-2">{error}</p>
          {error.includes('pe2_weeks') ? (
            <button
              type="button"
              onClick={copyMigrationSql}
              className="text-xs font-bold underline hover:no-underline"
            >
              {copiedSql ? 'SQL copiado — pégalo en Supabase SQL Editor' : 'Copiar SQL de migración'}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          type="button"
          onClick={handleCreateDraft}
          disabled={creating || loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-colors hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: evoBrand.accent }}
        >
          {creating ? 'Creando…' : 'Nuevo borrador'}
        </button>
        <button
          type="button"
          onClick={loadDrafts}
          disabled={loading}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-black/5 disabled:opacity-50"
          style={{ borderColor: `${evoBrand.purple}44`, color: evoBrand.text }}
        >
          Recargar
        </button>
        {selectedDraftId ? (
          <button
            type="button"
            onClick={() => onOpenWeek?.()}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-black/5"
            style={{ borderColor: `${evoBrand.purple}44`, color: evoBrand.purple }}
          >
            Abrir semana →
          </button>
        ) : null}
      </div>

      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: evoBrand.card, borderColor: `${evoBrand.purple}33` }}
      >
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: `${evoBrand.purple}22` }}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: evoBrand.purple }}>
            Borradores en Supabase
          </p>
          <span className="text-xs" style={{ color: evoBrand.muted }}>
            {loading ? 'Cargando…' : `${drafts.length} en este slot`}
          </span>
        </div>

        {drafts.length === 0 && !loading && !error ? (
          <p className="px-4 py-8 text-sm text-center" style={{ color: evoBrand.muted }}>
            Sin borradores todavía. Crea uno para empezar (no afecta al Coach).
          </p>
        ) : null}

        <ul className="divide-y" style={{ borderColor: `${evoBrand.purple}22` }}>
          {drafts.map((row) => {
            const st = statusStyle(row.status)
            const selected = row.id === selectedDraftId
            return (
              <li
                key={row.id}
                className={`px-4 py-3 flex flex-wrap items-center gap-3 ${selected ? 'bg-[#A729AD]/08' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => onSelectDraft?.(row.id)}
                  className="flex-1 min-w-[200px] text-left"
                >
                  <p className="text-sm font-semibold truncate" style={{ color: evoBrand.text }}>
                    {row.titulo || 'Sin título'}
                    {row.is_primary ? (
                      <span className="ml-2 text-[10px] font-bold uppercase" style={{ color: evoBrand.purple }}>
                        principal
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: evoBrand.muted }}>
                    Actualizado {new Date(row.updated_at).toLocaleString('es-ES')}
                  </p>
                </button>
                <span
                  className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg border"
                  style={{ backgroundColor: st.bg, color: st.color, borderColor: st.border }}
                >
                  {PE2_STATUS_LABELS[row.status] || row.status}
                </span>
                <button
                  type="button"
                  onClick={() => handleArchive(row.id)}
                  className="text-xs font-semibold px-2 py-1 rounded-lg hover:bg-black/5"
                  style={{ color: evoBrand.muted }}
                >
                  Archivar
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="mt-6 text-xs leading-relaxed" style={{ color: evoBrand.muted }}>
        Fase 1: borradores en <code>pe2_weeks</code>. Publicación al Hub Coach será manual (Fase 2).
      </p>
    </div>
  )
}
