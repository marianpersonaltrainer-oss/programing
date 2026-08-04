const statusClasses = {
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  overdue: 'border-rose-200 bg-rose-50 text-rose-800',
  exception: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800',
  empty: 'border-slate-200 bg-slate-50 text-slate-600',
  error: 'border-red-200 bg-red-50 text-red-800',
}

const dots = {
  pending: 'bg-amber-500',
  completed: 'bg-emerald-500',
  overdue: 'bg-rose-500',
  exception: 'bg-fuchsia-500',
  empty: 'bg-slate-400',
  error: 'bg-red-500',
}

export default function StatusBadge({ status, children }) {
  return (
    <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-bold ${statusClasses[status] || statusClasses.empty}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dots[status] || dots.empty}`} />
      {children}
    </span>
  )
}
