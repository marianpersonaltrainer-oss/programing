/** Bloquea generación si la biblioteca oficial EVO no está disponible o es inválida. */
export function validateOfficialLibrary(rows) {
  if (!Array.isArray(rows)) {
    return {
      ok: false,
      code: 'LIB-OFFICIAL-001',
      message:
        'La biblioteca oficial EVO no se pudo cargar. Revisa la conexión con Supabase y vuelve a intentarlo; no se genera programación sin esa fuente.',
    }
  }

  const active = rows.filter((row) => row && row.is_active !== false && String(row.name || row.exercise_name || '').trim())
  if (active.length === 0) {
    return {
      ok: false,
      code: 'LIB-OFFICIAL-001',
      message:
        'La biblioteca oficial EVO está vacía o sin ejercicios activos. Completa la biblioteca antes de generar; no se usa un fallback genérico.',
    }
  }

  return { ok: true, count: active.length }
}

export function assertOfficialLibrary(rows) {
  const result = validateOfficialLibrary(rows)
  if (!result.ok) {
    const err = new Error(result.message)
    err.code = result.code
    throw err
  }
  return result
}
