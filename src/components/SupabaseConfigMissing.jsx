/** Pantalla visible cuando el build de Vercel Preview no tiene variables VITE_SUPABASE_*. */
export default function SupabaseConfigMissing() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0C0B0C] text-[#F6E8F9] font-evo-body px-6">
      <div className="max-w-lg space-y-4 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#A729AD]">ProgramingEvo</p>
        <h1 className="text-xl font-bold uppercase tracking-tight">Configuración pendiente en esta preview</h1>
        <p className="text-sm text-[#F6E8F9]/80 leading-relaxed">
          Este despliegue de Vercel no tiene{' '}
          <code className="text-[#FFFF4C]">VITE_SUPABASE_URL</code> ni{' '}
          <code className="text-[#FFFF4C]">VITE_SUPABASE_ANON_KEY</code>. Sin ellas la app no puede arrancar
          (pantalla negra).
        </p>
        <p className="text-sm text-[#F6E8F9]/70 leading-relaxed">
          En Vercel → proyecto → <strong>Settings → Environment Variables</strong>: marca también el entorno{' '}
          <strong>Preview</strong> en esas variables (y en Anthropic), guarda y pulsa <strong>Redeploy</strong>.
        </p>
        <p className="text-[11px] text-[#F6E8F9]/50">
          Mientras tanto puedes probar en producción:{' '}
          <a className="underline text-[#FFFF4C]" href="https://programing-evo.vercel.app/">
            programing-evo.vercel.app
          </a>
        </p>
      </div>
    </div>
  )
}
