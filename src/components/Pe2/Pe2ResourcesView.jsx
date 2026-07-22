import { EVO_OPERATIONAL_RESOURCES } from '../../constants/shiftProtocolResources.js'
import { evoBrand } from '../../constants/evoBrand.js'
import ExternalResourceCard from './ExternalResourceCard.jsx'

export default function Pe2ResourcesView() {
  return (
    <div className="max-w-5xl mx-auto">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: evoBrand.muted }}>
        Equipo EVO
      </p>
      <h1 className="font-evo-display text-3xl sm:text-4xl font-bold" style={{ color: evoBrand.text }}>
        Recursos EVO
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: evoBrand.muted }}>
        Accesos directos a los documentos oficiales. La información sigue guardada en Drive y se abre con los permisos de tu cuenta.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 mt-7">
        {EVO_OPERATIONAL_RESOURCES.map((resource) => (
          <ExternalResourceCard key={resource.id} resource={resource} />
        ))}
      </div>
    </div>
  )
}
