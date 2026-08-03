const statusClasses = {
  pending: 'border-amber-300/25 bg-amber-300/10 text-amber-200',
  completed: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200',
  overdue: 'border-rose-300/25 bg-rose-300/10 text-rose-200',
  exception: 'border-fuchsia-300/25 bg-fuchsia-300/10 text-fuchsia-200',
  empty: 'border-white/10 bg-white/[0.04] text-white/55',
  error: 'border-red-300/25 bg-red-300/10 text-red-200',
}

const dots = {
  pending: 'bg-amber-300',
  completed: 'bg-emerald-300',
  overdue: 'bg-rose-300',
  exception: 'bg-fuchsia-300',
  empty: 'bg-white/35',
  error: 'bg-red-300',
}

export default function StatusBadge({ status, children }) {
  return (
    <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1 text-base font-bold sm:text-sm ${statusClasses[status] || statusClasses.empty}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dots[status] || dots.empty}`} />
      {children}
    </span>
  )
}
