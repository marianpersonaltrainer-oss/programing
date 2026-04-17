const STATES = [
  { score: 1, emoji: '😩', label: 'Semana dura' },
  { score: 2, emoji: '😕', label: 'Tirando' },
  { score: 3, emoji: '😐', label: 'Normal' },
  { score: 4, emoji: '😊', label: 'Bien' },
  { score: 5, emoji: '🔥', label: 'Semana de 10' },
]

export default function WeeklyCheckinModal({
  weekLabel,
  moodScore,
  highlights,
  improvements,
  feedbackText,
  submitError,
  onChange,
  onSubmit,
}) {
  return (
    <div className="fixed inset-0 z-[150] bg-[#0C0B0C] flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-lg border border-[#6A1F6D]/40 bg-[#1a0f1b] px-5 py-6 space-y-5">
        <p className="text-sm text-[#F6E8F9CC]">EVO</p>
        <h2 className="text-2xl font-evo-display font-bold text-[#FFFF4C]">{weekLabel}</h2>
        <p className="text-lg text-[#F6E8F9]">¿Cómo ha ido esta semana dando clases?</p>
        <div className="grid grid-cols-5 gap-2">
          {STATES.map((s) => (
            <button
              key={s.score}
              type="button"
              onClick={() => onChange('moodScore', s.score)}
              className={`min-h-11 rounded-lg border px-2 py-2 transition-colors ${
                Number(moodScore) === s.score ? 'bg-[#A729AD] border-[#FFFF4C]' : 'bg-[#221427] border-[#6A1F6D]/40'
              }`}
            >
              <div className="text-3xl leading-none">{s.emoji}</div>
            </button>
          ))}
        </div>
        <label className="block text-sm text-[#F6E8F9CC]">
          ¿Qué fue especialmente bien?
          <textarea
            value={highlights}
            onChange={(e) => onChange('highlights', e.target.value)}
            className="mt-1 w-full min-h-[90px] rounded-lg border border-[#6A1F6D] bg-[#221427] px-3 py-2 text-[#F6E8F9]"
          />
        </label>
        <label className="block text-sm text-[#F6E8F9CC]">
          ¿Qué cambiarías o mejorarías?
          <textarea
            value={improvements}
            onChange={(e) => onChange('improvements', e.target.value)}
            className="mt-1 w-full min-h-[90px] rounded-lg border border-[#6A1F6D] bg-[#221427] px-3 py-2 text-[#F6E8F9]"
          />
        </label>
        <label className="block text-sm text-[#F6E8F9CC]">
          Comentario opcional
          <textarea
            value={feedbackText}
            onChange={(e) => onChange('feedbackText', e.target.value)}
            className="mt-1 w-full min-h-[80px] rounded-lg border border-[#6A1F6D] bg-[#221427] px-3 py-2 text-[#F6E8F9]"
          />
        </label>
        <button
          type="button"
          onClick={onSubmit}
          className="w-full h-11 rounded-lg bg-[#6A1F6D] hover:bg-[#A729AD] text-[#FFFF4C] font-evo-display uppercase tracking-wide"
        >
          Enviar check-in
        </button>
        {submitError ? (
          <p className="text-sm text-red-300 rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2" role="alert">
            {submitError}
          </p>
        ) : null}
        <p className="text-xs text-[#F6E8F966]">Solo lo ve Marian. Gracias.</p>
      </div>
    </div>
  )
}
