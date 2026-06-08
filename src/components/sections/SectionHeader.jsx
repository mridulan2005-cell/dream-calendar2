// Consistent header for each planner section: a small eyebrow (breadcrumb-style
// context), the section title, and an optional right-aligned action cluster.
export default function SectionHeader({ eyebrow, title, action }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        {eyebrow && <p className="text-sm text-slate-400">{eyebrow}</p>}
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      {action}
    </div>
  )
}
