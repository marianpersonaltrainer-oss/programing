const paths = {
  today: <><path d="M8 2v3M16 2v3M3 9h18" /><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M8 13h3v3H8z" /></>,
  signups: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>,
  class: <><path d="M6 5v14M18 5v14M3 9v6M21 9v6M6 12h12" /></>,
  followups: <><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6M12 7v5l3 2" /></>,
  incidents: <><path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
  exceptions: <><path d="M12 3 4 7v5c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V7l-8-4Z" /><path d="m9 12 2 2 4-4" /></>,
  back: <path d="m15 18-6-6 6-6" />,
  arrow: <path d="m9 18 6-6-6-6" />,
  spark: <><path d="m12 3-1.4 4.1L6.5 8.5l4.1 1.4L12 14l1.4-4.1 4.1-1.4-4.1-1.4L12 3Z" /><path d="m5 15-.7 2.3L2 18l2.3.7L5 21l.7-2.3L8 18l-2.3-.7L5 15Z" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
}

export default function Icon({ name, className = 'h-5 w-5' }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] || paths.spark}
    </svg>
  )
}
