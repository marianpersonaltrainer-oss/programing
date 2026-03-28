import { useState } from 'react'
import { EXERCISE_VIDEOS, EXERCISE_CATEGORIES } from '../../constants/exerciseVideos.js'

export default function ExerciseLibrary({ onClose }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState('todos')

  const catLabels = {
    todos:         'Todos los ejercicios',
    calentamiento: 'Calentamiento & Movilidad',
    landmine:      'Landmine',
    accesorios:    'Accesorios & Core',
    kettlebell:    'Kettlebell & Carries',
    olimpicos:     'Movimientos Olímpicos',
  }

  const catColors = {
    todos:         'bg-gray-100 text-gray-600 border-gray-200',
    calentamiento: 'bg-blue-50 text-blue-600 border-blue-100',
    landmine:      'bg-purple-50 text-purple-600 border-purple-100',
    accesorios:    'bg-emerald-50 text-emerald-600 border-emerald-100',
    kettlebell:    'bg-amber-50 text-amber-600 border-amber-100',
    olimpicos:     'bg-rose-50 text-rose-600 border-rose-100',
  }

  // Aplanar ejercicios para búsqueda global
  const allExercises = Object.keys(EXERCISE_VIDEOS).map(name => {
    // Buscar a qué categoría pertenece
    const category = Object.keys(EXERCISE_CATEGORIES).find(cat => 
      EXERCISE_CATEGORIES[cat].includes(name)
    ) || 'otros'
    return { name, category, url: EXERCISE_VIDEOS[name] }
  })

  const filtered = allExercises.filter(ex => {
    const matchesSearch = ex.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCat = activeCategory === 'todos' || ex.category === activeCategory
    return matchesSearch && matchesCat
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 evo-light-dialog">
      <div className="w-full max-w-4xl bg-white border border-black/5 rounded-3xl flex flex-col h-[85vh] animate-fade-in shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-black/5 flex items-center justify-between flex-shrink-0 bg-white">
          <div>
            <h2 className="text-display text-xl font-bold text-evo-text uppercase tracking-tight">Biblioteca de Vídeos EVO</h2>
            <p className="text-[10px] text-evo-muted font-bold mt-1 uppercase tracking-widest">TUTORIALES OFICIALES · EVOLUTION BOUTIQUE FITNESS</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-2xl bg-gray-50 hover:bg-red-50 flex items-center justify-center text-evo-muted hover:text-red-500 transition-all shadow-sm border border-black/5"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Search & Categories */}
        <div className="px-8 py-5 bg-gray-50/50 border-b border-black/5 space-y-5 flex-shrink-0">
          <div className="relative group">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-evo-accent transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre: landmine, back squat, wall slide..."
              className="w-full bg-white border border-black/10 rounded-2xl pl-14 pr-6 py-4 text-sm text-evo-text placeholder-evo-muted focus:outline-none focus:border-evo-accent focus:ring-4 focus:ring-evo-accent/5 transition-all shadow-soft"
            />
          </div>

          <div className="flex flex-wrap gap-2.5">
            {Object.keys(catLabels).map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all shadow-sm ${
                  activeCategory === cat
                    ? 'bg-evo-accent border-evo-accent text-white shadow-purple-500/20 active:scale-95'
                    : 'bg-white border-black/5 text-evo-muted hover:bg-gray-100 hover:text-evo-text'
                }`}
              >
                {catLabels[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Exercises Grid */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-elegant">
          {filtered.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-40">
              <span className="text-5xl mb-6">🔍</span>
              <p className="text-evo-text font-bold text-lg uppercase tracking-tight">No hay resultados</p>
              <p className="text-xs text-evo-muted mt-2 font-medium">Prueba con otros términos o cambia la categoría.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map(ex => (
                <a 
                  key={ex.name}
                  href={ex.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block p-5 rounded-2xl bg-white border border-black/5 hover:border-evo-accent/30 transition-all duration-500 transform hover:-translate-y-1.5 shadow-soft hover:shadow-elevated"
                >
                  <div className="flex items-start justify-between mb-4">
                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest border shadow-sm ${catColors[ex.category] || 'bg-gray-50 text-evo-muted border-gray-100'}`}>
                      {catLabels[ex.category] || 'General'}
                    </span>
                    <span className="text-gray-300 group-hover:text-evo-accent transition-colors transform group-hover:translate-x-1 group-hover:-translate-y-1">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </span>
                  </div>
                  <h3 className="text-[13px] font-bold text-evo-text mb-5 group-hover:text-evo-accent transition-colors uppercase tracking-tight leading-snug h-8 line-clamp-2">
                    {ex.name}
                  </h3>
                  <div className="flex items-center gap-2.5 text-[10px] font-bold text-evo-accent uppercase tracking-widest">
                    <span className="w-6 h-6 rounded-lg bg-evo-accent/10 flex items-center justify-center group-hover:bg-evo-accent group-hover:text-white transition-all shadow-sm">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                    </span>
                    Ver Tutorial Master
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-black/5 bg-gray-50 text-center flex-shrink-0">
          <p className="text-[10px] text-evo-muted font-bold tracking-widest uppercase">E V O L U T I O N   P R O G R A M I N G   H U B</p>
        </div>
      </div>
    </div>
  )
}
