import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { DAYS_ES, DAYS_ORDER, CLASS_COLORS } from '../../constants/evoColors.js'
import { ALL_CLASS_LABELS } from '../../constants/evoClasses.js'
import { evoBrand } from '../../constants/evoBrand.js'
import { coachBg, coachBorder, coachText } from '../CoachView/coachTheme.js'
import { appendAutoLearnedLines } from '../../utils/methodLearnedStorage.js'
import {
  EDIT_REASON_PRESETS,
  EDIT_REASON_OTHER_ID,
  EDIT_REASON_OTHER_MAX,
  EDIT_REASON_MAX_CHIPS,
  buildLearnedLinesFromEditReasons,
  buildContextualLearnedLinesFromEditReasons,
} from '../../utils/methodLearnedFromEdit.js'

export default function EditModal({ day, session, onSave, onClose }) {
  const [content, setContent] = useState(session?.content || '')
  const [selectedDay, setSelectedDay] = useState(day || '')
  const [classes, setClasses] = useState(session?.classes || [])

  const [phase, setPhase] = useState('edit')
  const [pendingSave, setPendingSave] = useState(null)
  const [learnSelected, setLearnSelected] = useState([])
  const [otherText, setOtherText] = useState('')

  const initialRef = useRef(null)

  useEffect(() => {
    setContent(session?.content || '')
    setSelectedDay(day || '')
    setClasses(session?.classes || [])
    setPhase('edit')
    setPendingSave(null)
    setLearnSelected([])
    setOtherText('')
  }, [day, session])

  useLayoutEffect(() => {
    initialRef.current = {
      day: day || '',
      content: session?.content || '',
      classesStr: JSON.stringify([...(session?.classes || [])].sort()),
    }
  }, [day, session])

  function classesSortedStr(cls) {
    return JSON.stringify([...(cls || [])].sort())
  }

  function isDirty() {
    const init = initialRef.current
    if (!init) return false
    return (
      content.trim() !== (init.content || '').trim() ||
      selectedDay !== init.day ||
      classesSortedStr(classes) !== init.classesStr
    )
  }

  function toggleLearnChip(id) {
    setLearnSelected((prev) => {
      const s = new Set(prev)
      if (s.has(id)) {
        s.delete(id)
        return [...s]
      }
      if (s.size >= EDIT_REASON_MAX_CHIPS) return prev
      s.add(id)
      return [...s]
    })
  }

  function finishSave(payload) {
    onSave(payload.day, payload.content, payload.classes)
  }

  function handleConfirmEdit() {
    if (!selectedDay || !content.trim()) return
    if (!isDirty()) {
      finishSave({ day: selectedDay, content, classes })
      return
    }
    setPendingSave({ day: selectedDay, content, classes })
    setLearnSelected([])
    setOtherText('')
    setPhase('learn')
  }

  function handleLearnSkip() {
    if (!pendingSave) return
    const p = pendingSave
    setPhase('edit')
    setPendingSave(null)
    setLearnSelected([])
    setOtherText('')
    finishSave(p)
  }

  function handleLearnConfirm() {
    if (!pendingSave) return
    const genericLines = buildLearnedLinesFromEditReasons({
      dayLabel: DAYS_ES[pendingSave.day] || pendingSave.day,
      classLabels: pendingSave.classes || [],
      selectedPresetIds: learnSelected,
      otherText,
    })
    const contextualLines = buildContextualLearnedLinesFromEditReasons({
      dayLabel: DAYS_ES[pendingSave.day] || pendingSave.day,
      classLabels: pendingSave.classes || [],
      selectedPresetIds: learnSelected,
      otherText,
      sessionContent: pendingSave.content || '',
    })
    const lines = [...new Set([...genericLines, ...contextualLines])]
    if (lines.length) appendAutoLearnedLines(lines)
    const p = pendingSave
    setPhase('edit')
    setPendingSave(null)
    setLearnSelected([])
    setOtherText('')
    finishSave(p)
  }

  function handleLearnBack() {
    setPhase('edit')
    setPendingSave(null)
    setLearnSelected([])
    setOtherText('')
  }

  function toggleClass(cls) {
    setClasses((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls],
    )
  }

  const allClasses = ALL_CLASS_LABELS
  const otherSelected = learnSelected.includes(EDIT_REASON_OTHER_ID)
  const learnChipDisabled = (id) =>
    !learnSelected.includes(id) && learnSelected.length >= EDIT_REASON_MAX_CHIPS

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
        {phase === 'edit' ? (
          <div
            className={`w-full max-w-4xl ${coachBg.card} border ${coachBorder} rounded-t-3xl max-h-[85vh] flex flex-col animate-slide-up shadow-2xl overflow-hidden`}
          >
            <div className={`px-8 py-5 border-b ${coachBorder} flex items-center justify-between flex-shrink-0 ${coachBg.app}`}>
              <div>
                <h3 className={`font-evo-display text-base font-bold ${coachText.title} uppercase tracking-tight`}>Editar Sesión</h3>
                <p className={`text-[10px] ${coachText.muted} font-bold mt-1 uppercase tracking-widest`}>Ajustar contenido y clasificación</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className={`w-8 h-8 rounded-xl ${coachBg.card} hover:bg-red-100 flex items-center justify-center ${coachText.muted} hover:text-red-600 transition-all border ${coachBorder}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className={`px-8 py-4 border-b ${coachBorder} flex items-center gap-6 flex-shrink-0 flex-wrap ${coachBg.card}`}>
              <div className="flex items-center gap-3">
                <label className={`text-[11px] font-bold ${coachText.muted} uppercase tracking-widest`}>Día</label>
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className={`${coachBg.app} border ${coachBorder} rounded-xl px-4 py-2 text-xs !text-[#1A0A1A] font-medium focus:outline-none focus:border-[#A729AD]/50`}
                >
                  <option value="">Seleccionar día...</option>
                  {DAYS_ORDER.map((d) => (
                    <option key={d} value={d}>{DAYS_ES[d]}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2.5">
                <span className={`text-[11px] font-bold ${coachText.muted} uppercase tracking-widest`}>Clases</span>
                <div className="flex gap-2 flex-wrap">
                  {allClasses.map((cls) => {
                    const color = CLASS_COLORS[cls]
                    const active = classes.includes(cls)
                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => toggleClass(cls)}
                        className="text-[10px] px-4 py-1.5 rounded-xl border font-bold transition-all"
                        style={{
                          backgroundColor: active ? `${color.bg}28` : evoBrand.app,
                          color: active ? color.text || color.bg : evoBrand.muted,
                          borderColor: active ? `${color.bg}55` : evoBrand.border,
                        }}
                      >
                        {cls}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className={`flex-1 overflow-hidden ${coachBg.app} min-h-[200px]`}>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className={`w-full h-full min-h-[200px] bg-transparent px-8 py-6 text-[13px] font-medium ${coachText.primary} focus:outline-none leading-relaxed resize-none font-mono placeholder-[#C4A8C4]`}
                spellCheck={false}
                placeholder="Escribe el contenido de la sesión aquí..."
              />
            </div>

            <div className={`px-8 py-5 border-t ${coachBorder} flex items-center justify-between flex-shrink-0 ${coachBg.card}`}>
              <div className={`text-[10px] ${coachText.muted} font-bold uppercase tracking-widest`}>{content.length} CARACTERES</div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-6 py-2.5 rounded-xl border ${coachBorder} ${coachBg.cardAlt} ${coachText.primary} hover:bg-[#EDE3F2] text-[10px] font-bold uppercase tracking-widest transition-all`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEdit}
                  disabled={!selectedDay || !content.trim()}
                  className="px-8 py-3 rounded-xl bg-[#A729AD] hover:bg-[#6A1F6D] disabled:opacity-30 text-white text-[11px] font-bold uppercase tracking-widest transition-all active:scale-95"
                >
                  Confirmar cambios
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {phase === 'learn' ? (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[2px] p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-learn-title"
        >
          <div
            className={`w-full sm:max-w-lg max-h-[min(90dvh,560px)] overflow-y-auto rounded-t-3xl sm:rounded-3xl border ${coachBorder} ${coachBg.card} shadow-2xl flex flex-col`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`px-6 py-4 border-b ${coachBorder} flex items-start justify-between gap-3 shrink-0 ${coachBg.app}`}>
              <div>
                <h3 id="edit-learn-title" className={`font-evo-display text-base font-bold ${coachText.title} uppercase tracking-tight`}>
                  ¿Por qué editaste esta sesión?
                </h3>
                <p className={`text-[10px] ${coachText.muted} font-bold mt-1 uppercase tracking-widest`}>
                  Opcional — hasta {EDIT_REASON_MAX_CHIPS} motivos · Tu método
                </p>
              </div>
              <button
                type="button"
                onClick={handleLearnBack}
                className={`w-8 h-8 rounded-xl ${coachBg.card} hover:bg-red-100 flex items-center justify-center ${coachText.muted} hover:text-red-600 transition-all border ${coachBorder} shrink-0`}
                aria-label="Cerrar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className={`flex-1 overflow-y-auto px-6 py-5 space-y-5 ${coachBg.app}`}>
              <p className={`text-[11px] ${coachText.muted} leading-relaxed`}>
                Se generará una frase por motivo en <span className="font-bold">Reglas aprendidas</span>.
              </p>
              <div className="flex flex-wrap gap-2">
                {EDIT_REASON_PRESETS.map(({ id, label }) => {
                  const on = learnSelected.includes(id)
                  const disabled = learnChipDisabled(id)
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleLearnChip(id)}
                      className={`text-left text-[11px] px-3 py-2.5 rounded-xl border font-bold transition-all max-w-full ${
                        on
                          ? 'bg-[#A729AD]/20 border-[#A729AD] text-[#4a154d]'
                          : disabled
                            ? 'opacity-35 cursor-not-allowed border-transparent bg-black/5'
                            : `${coachBg.cardAlt} ${coachBorder} ${coachText.primary} hover:bg-[#EDE3F2]`
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
                <button
                  type="button"
                  disabled={learnChipDisabled(EDIT_REASON_OTHER_ID)}
                  onClick={() => toggleLearnChip(EDIT_REASON_OTHER_ID)}
                  className={`text-left text-[11px] px-3 py-2.5 rounded-xl border font-bold transition-all ${
                    otherSelected
                      ? 'bg-[#A729AD]/20 border-[#A729AD] text-[#4a154d]'
                      : learnChipDisabled(EDIT_REASON_OTHER_ID)
                        ? 'opacity-35 cursor-not-allowed border-transparent bg-black/5'
                        : `${coachBg.cardAlt} ${coachBorder} ${coachText.primary} hover:bg-[#EDE3F2]`
                  }`}
                >
                  ✏️ Otro
                </button>
              </div>
              {otherSelected ? (
                <div className="space-y-1">
                  <label className={`text-[10px] font-bold ${coachText.muted} uppercase tracking-widest`}>
                    Texto libre (máx. {EDIT_REASON_OTHER_MAX})
                  </label>
                  <textarea
                    value={otherText}
                    maxLength={EDIT_REASON_OTHER_MAX}
                    onChange={(e) => setOtherText(e.target.value.slice(0, EDIT_REASON_OTHER_MAX))}
                    rows={3}
                    className={`w-full rounded-xl border ${coachBorder} ${coachBg.card} px-4 py-3 text-sm ${coachText.primary} focus:outline-none focus:border-[#A729AD]/50`}
                    placeholder="Describe el motivo…"
                  />
                  <p className={`text-[10px] ${coachText.muted}`}>
                    {otherText.length}/{EDIT_REASON_OTHER_MAX}
                  </p>
                </div>
              ) : null}
            </div>

            <div className={`px-6 py-4 border-t ${coachBorder} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0 ${coachBg.card}`}>
              <button
                type="button"
                onClick={handleLearnBack}
                className={`text-[10px] font-bold uppercase tracking-widest ${coachText.muted} hover:opacity-80 text-left`}
              >
                ← Volver al editor
              </button>
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={handleLearnSkip}
                  className={`px-5 py-2.5 rounded-xl border ${coachBorder} ${coachBg.cardAlt} ${coachText.primary} text-[10px] font-bold uppercase tracking-widest`}
                >
                  Saltar
                </button>
                <button
                  type="button"
                  onClick={handleLearnConfirm}
                  className="px-6 py-2.5 rounded-xl bg-[#A729AD] hover:bg-[#6A1F6D] text-white text-[10px] font-bold uppercase tracking-widest"
                >
                  Guardar {learnSelected.length ? 'y añadir reglas' : 'sesión'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
