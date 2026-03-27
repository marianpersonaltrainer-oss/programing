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
    todos:         'bg-white/10 text-white',
    calentamiento: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    landmine:      'bg-purple-500/10 text-purple-400 border-purple-500/20',
    accesorios:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    kettlebell:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
    olimpicos:     'bg-rose-500/10 text-rose-400 border-rose-500/20',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-[#111] border border-white/8 rounded-2xl flex flex-col h-[85vh] animate-fade-in shadow-2xl">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-display text-lg font-bold text-white tracking-tight">Biblioteca de Vídeos EVO</h2>
            <p className="text-xs text-evo-muted mt-1">Busca ejercicios y accede a los tutoriales oficiales directamente.</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-evo-muted hover:text-white transition-all transform hover:rotate-90"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Search & Categories */}
        <div className="px-6 py-4 bg-[#0D0D0D] border-b border-white/5 space-y-4 flex-shrink-0">
          <div className="relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-evo-muted group-focus-within:text-[#7B2FBE] transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ej: landmine clean, back squat, wall slide..."
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-sm text-white placeholder-evo-muted focus:outline-none focus:border-[#7B2FBE]/50 focus:ring-1 focus:ring-[#7B2FBE]/20 transition-all shadow-inner"
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {Object.keys(catLabels).map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all ${
                  activeCategory === cat
                    ? 'bg-[#7B2FBE] border-[#7B2FBE] text-white shadow-lg shadow-[#7B2FBE]/20'
                    : 'bg-white/5 border-white/10 text-evo-muted hover:bg-white/10 hover:border-white/20'
                }`}
              >
                {catLabels[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Exercises Grid */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-elegant">
          {filtered.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-40">
              <span className="text-4xl mb-4">🔍</span>
              <p className="text-white font-medium">No hay resultados para "{searchTerm}"</p>
              <p className="text-xs text-evo-muted mt-2">Prueba con otros términos o cambia la categoría.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(ex => (
                <a 
                  key={ex.name}
                  href={ex.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/8 hover:border-[#7B2FBE]/30 transition-all duration-300 transform hover:-translate-y-1 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${catColors[ex.category] || 'bg-white/5 text-evo-muted'}`}>
                      {catLabels[ex.category] || 'General'}
                    </span>
                    <span className="text-white/20 group-hover:text-[#7B2FBE] transition-colors">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white mb-4 group-hover:text-[#7B2FBE] transition-colors capitalize">
                    {ex.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] font-medium text-[#7B2FBE]">
                    <span className="w-5 h-5 rounded-full bg-[#7B2FBE]/10 flex items-center justify-center">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                    </span>
                    Ver Tutorial
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 bg-[#0D0D0D] text-center flex-shrink-0">
          <p className="text-[10px] text-white/20 font-medium tracking-tight">E V O L U T I O N   B O U T I Q U E   F I T N E S S</p>
        </div>
      </div>
    </div>
  )
}
