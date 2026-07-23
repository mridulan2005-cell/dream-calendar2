import {
  ClipboardList,
  ListChecks,
  Bell,
  Building2,
  Landmark,
  Search,
  ChevronDown,
  Video,
  X,
  Check,
  ArrowUpRight,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useRole } from '../store/RoleContext.jsx'
import DeptTimetableCard from '../components/DeptTimetableCard.jsx'

// ── Today dashboard ──────────────────────────────────────────────────────────
// The landing surface (Figma node 336:1318): a personal "today" view — the day's
// schedule, reminders, a to-do queue, and what's happening across IIT and IDC.
// A few cards double as entry points into the Department Timetable: hovering one
// reveals a minimal link that switches to the right account (coordinator /
// faculty / student) and lands on the right surface.

// Reminders — mostly informational, each tagged with a status badge.
const REMINDERS = [
  { text: 'Reimbursement - IDDC 2026 Travel', badge: { label: 'Conference Paper', variant: 'filled' } },
  { text: 'Course Feedback - ID 401 Sem 7', badge: { label: 'Conference Paper', variant: 'outline' } },
  { text: 'Leave Balance – CL/EL', badge: { label: 'Conference Paper', variant: 'filled' } },
]
// …and the slot-preference deadline, which drops faculty onto the slot surface.
const SLOT_DEADLINE = {
  text: 'Slot preference submission deadline — May 10th',
  action: { label: 'Go to slot allotment', role: 'faculty', to: '/faculty/timetable?step=slot' },
}

// To Do — a change request that opens the timetable for the coordinator, over a
// queue of approval cards.
const CHANGE_REQUEST = {
  title: 'Change request — DE 312 slot swap',
  sub: 'Raised by Prof. Anirudha Joshi · review & respond',
  date: '12 Jun – 16 Jun 2026',
  action: { label: 'Open in Department Timetable', role: 'ttc', to: '/faculty/timetable' },
}
const TODOS = [
  {
    title: 'AMS Leave request – Ankit Verma',
    desc: 'Student requesting medical leave. Supervisor approval required.',
    date: '12 Jun – 16 Jun 2026',
  },
  {
    title: 'Meeting Minutes – DUGC May 2026',
    desc: 'Minutes of the Department UG Committee meeting. Review and sign.',
    date: '12 Jun – 16 Jun 2026',
  },
  {
    title: 'AMS Leave request – Ankit Verma',
    desc: 'Student requesting medical leave. Supervisor approval required.',
    date: '12 Jun – 16 Jun 2026',
  },
]

// Today's happenings — shared list for IIT and IDC.
const NEWS = [
  { title: 'Senate Meeting - Circular for Agenda', meta: 'Distributed via webmail' },
  { title: 'IDC Faculty Colloquium - "AI in Design Education"', meta: '11:00 am - 12:30 pm • Auditorium' },
  { title: 'B.des 1 Exhibition - Art & Fundamental Design', meta: '04:00 pm - 05:30 pm • B.des 1' },
]
// IDC leads with two departmental updates that each open the timetable in a
// different guise.
const IDC_UPDATES = [
  {
    text: 'Slot preferences submitted by Prof. Meera Rao',
    action: { label: 'View', role: 'ttc', to: '/faculty/timetable' },
  },
  {
    text: 'Draft timetable is published for this semester',
    action: { label: 'View', role: 'student', to: '/faculty/timetable' },
  },
]

// `variant` picks which landing this is. "today" is the personal day view, where
// the timetable is reached obliquely through whichever card happens to mention
// it. "faculty" is the Faculty tab: the same day view, but the department's
// timetable gets its own container — one card that carries the allotment's
// standing and hands the person off to the Department Timetable page in whatever
// guise their account gives them (see DeptTimetableCard). With that card present
// the oblique entry points are redundant, so they step aside.
export default function Dashboard({ variant = 'today' }) {
  const { setRole } = useRole()
  const navigate = useNavigate()
  const dept = variant === 'faculty'

  // A card's action switches to the account the destination expects, then
  // navigates to the timetable surface it points at.
  const goTo = (action) => {
    if (action.role) setRole(action.role)
    navigate(action.to)
  }

  return (
    <div className="mx-auto max-w-[1180px]">
      {/* Welcome + search */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h1 text-slate-900 dark:text-white">Welcome Amogh!</h1>
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Search"
            className="text-body1-regular w-72 rounded-full border border-slate-200 bg-canvas py-2.5 pl-10 pr-4 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-accent focus:ring-1 focus:ring-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card icon={ClipboardList} title="My Schedule" right={<TodayPill />}>
          <div className="rounded-lg bg-surface p-3 dark:bg-slate-900">
            <ScheduleTimeline />
          </div>
        </Card>

        <Card icon={Bell} title="Reminders and Updates">
          <div className="space-y-2.5">
            {!dept && <ActionRow {...SLOT_DEADLINE} onGo={goTo} />}
            {REMINDERS.map((r, i) => (
              <ReminderRow key={i} {...r} />
            ))}
          </div>
        </Card>

        <Card icon={ListChecks} title="To Do" className="lg:row-span-2">
          <div className="space-y-3">
            {!dept && <ChangeRequestCard data={CHANGE_REQUEST} onGo={goTo} />}
            {TODOS.map((t, i) => (
              <TodoCard key={i} {...t} />
            ))}
          </div>
        </Card>

        {dept ? (
          <DeptTimetableCard className="lg:col-span-2" />
        ) : (
          <>
            <Card icon={Building2} title="Today in IIT">
              <NewsCard items={NEWS} />
            </Card>

            <Card icon={Landmark} title="Today in IDC">
              <NewsCard updates={IDC_UPDATES} items={NEWS} onGo={goTo} />
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

// ── Building blocks ──────────────────────────────────────────────────────────
function Card({ icon: Icon, title, right, className = '', children }) {
  return (
    <section
      className={`flex flex-col rounded-xl border border-slate-200 bg-canvas p-4 dark:border-slate-800 dark:bg-slate-900/40 ${className}`}
    >
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white">
            <Icon size={16} />
          </span>
          <h2 className="text-h3-medium text-slate-700 dark:text-slate-200">{title}</h2>
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}

const TodayPill = () => (
  <button className="text-body2-regular flex items-center gap-1.5 rounded-lg border border-slate-200 bg-surface px-2.5 py-1.5 text-slate-500 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
    Today <ChevronDown size={12} />
  </button>
)

// The minimal, clean hover affordance shared by the interactive rows/cards: a
// teal link that fades in on hover or keyboard focus. Purely visual — the parent
// element carries the click.
const HoverLink = ({ label }) => (
  <span className="text-body2-regular flex shrink-0 items-center gap-1 whitespace-nowrap text-accent opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
    {label}
    <ArrowUpRight size={13} />
  </span>
)

// ── My Schedule ──────────────────────────────────────────────────────────────
const HOURS = [9, 10, 11, 12, 13]
const HOUR_H = 42
const fmtHour = (h) => `${String(((h + 11) % 12) + 1).padStart(2, '0')}:00 ${h < 12 ? 'am' : 'pm'}`

// A vertical day timeline: the hours run down the left, events sit as blocks over
// a set of hour gridlines.
function ScheduleTimeline() {
  const base = HOURS[0]
  const span = (HOURS[HOURS.length - 1] - base) * HOUR_H

  return (
    <div className="relative" style={{ height: span + HOUR_H }}>
      {HOURS.map((h) => (
        <div key={h} className="absolute inset-x-0 flex items-center" style={{ top: (h - base) * HOUR_H }}>
          <span className="text-body3-regular w-12 shrink-0 text-slate-400">{fmtHour(h)}</span>
          <span className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
        </div>
      ))}

      {/* 9:30 – 12:30 lecture */}
      <div
        className="absolute right-1.5 overflow-hidden rounded-lg border border-[#b8eae2] bg-[#f3fbf9] py-2 pl-3.5 pr-2 dark:border-slate-700 dark:bg-slate-800"
        style={{ left: 52, top: (9.5 - base) * HOUR_H, height: (12.5 - 9.5) * HOUR_H - 8 }}
      >
        <span className="absolute inset-y-0 left-0 w-1 bg-accent" />
        <div className="text-body2-regular text-slate-700 dark:text-slate-200">Design Research Class (DE 312)</div>
        <div className="text-body3-regular mt-0.5 text-slate-500 dark:text-slate-400">Bdes 3</div>
        <div className="text-body3-regular text-slate-500 dark:text-slate-400">9:30am - 12:30pm</div>
      </div>

      {/* Later block, with a Join control */}
      <div
        className="absolute right-1.5 flex items-start justify-between gap-2 overflow-hidden rounded-lg bg-canvas px-3.5 py-2 dark:bg-slate-800/50"
        style={{ left: 52, top: (12.75 - base) * HOUR_H, height: HOUR_H - 6 }}
      >
        <div className="min-w-0">
          <div className="text-body2-regular truncate text-slate-700 dark:text-slate-200">
            Design Research Class (DE 312)
          </div>
          <div className="text-body3-regular truncate text-slate-500 dark:text-slate-400">
            Bdes 3 · 9:30am - 12:30pm
          </div>
        </div>
        <button className="text-body3-regular flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-surface px-2 py-1 text-slate-500 transition hover:border-accent hover:text-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <Video size={11} /> Join
        </button>
      </div>
    </div>
  )
}

// ── Reminders ────────────────────────────────────────────────────────────────
function ReminderRow({ text, badge }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3.5 py-3 dark:bg-slate-900">
      <span className="text-body1-regular min-w-0 text-slate-700 dark:text-slate-200">{text}</span>
      <Badge {...badge} />
    </div>
  )
}

function Badge({ label, variant }) {
  if (variant === 'outline')
    return (
      <span className="text-body2-regular flex shrink-0 items-center gap-1.5 rounded-full border border-accent px-2.5 py-1 text-accent">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        {label}
      </span>
    )
  return (
    <span className="text-body2-regular flex shrink-0 items-center gap-1.5 rounded-full border border-[#103d37]/50 bg-[#b8eae2] px-2.5 py-1 text-[#103d37]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#103d37]" />
      {label}
    </span>
  )
}

// A reminder that navigates: the whole row is the control, with the minimal
// hover link on the right.
function ActionRow({ text, action, onGo }) {
  return (
    <button
      onClick={() => onGo(action)}
      className="group flex w-full items-center justify-between gap-3 rounded-lg bg-surface px-3.5 py-3 text-left transition hover:bg-accent-soft/40 focus:outline-none dark:bg-slate-900 dark:hover:bg-slate-800"
    >
      <span className="text-body1-regular min-w-0 truncate text-slate-700 dark:text-slate-200">{text}</span>
      <HoverLink label={action.label} />
    </button>
  )
}

// ── To Do ────────────────────────────────────────────────────────────────────
function TodoCard({ title, desc, date }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-surface p-3.5 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-body1-medium text-slate-900 dark:text-white">{title}</div>
      <p className="text-body2-regular mt-1 text-slate-400">{desc}</p>
      <p className="text-body2-regular mt-1.5 text-slate-500 dark:text-slate-300">{date}</p>
      <div className="mt-2.5 flex gap-2">
        <button className="text-body2-regular flex items-center gap-1 rounded-md border border-slate-200 bg-[#f9f9fb] px-3 py-1.5 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <X size={12} /> Reject
        </button>
        <button className="text-body2-regular flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-white transition hover:brightness-95">
          <Check size={12} /> Accept
        </button>
      </div>
    </div>
  )
}

// The change request card — same shape as a to-do, but the whole card navigates
// and reveals the minimal hover link.
function ChangeRequestCard({ data, onGo }) {
  return (
    <button
      onClick={() => onGo(data.action)}
      className="group w-full rounded-xl border border-slate-200 bg-surface p-3.5 text-left transition hover:border-accent hover:shadow-sm focus:outline-none dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-body1-medium min-w-0 truncate text-slate-900 dark:text-white">{data.title}</span>
        <span className="text-body2-regular shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-accent dark:bg-slate-800 dark:text-slate-200">
          Change request
        </span>
      </div>
      <p className="text-body2-regular mt-1 text-slate-400">{data.sub}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-body2-regular text-slate-500 dark:text-slate-300">{data.date}</p>
        <HoverLink label={data.action.label} />
      </div>
    </button>
  )
}

// ── Today in IIT / IDC ───────────────────────────────────────────────────────
// A single white card of dividered rows. `updates` (IDC only) lead as navigating
// rows; `items` are the plain happenings beneath.
function NewsCard({ updates = [], items, onGo }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-surface dark:border-slate-800 dark:bg-slate-900">
      {updates.map((u, i) => (
        <button
          key={`u${i}`}
          onClick={() => onGo(u.action)}
          className="group flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-accent-soft/40 focus:outline-none dark:border-slate-800 dark:hover:bg-slate-800"
        >
          <span className="text-body1-regular min-w-0 truncate text-slate-800 dark:text-slate-200">{u.text}</span>
          <HoverLink label={u.action.label} />
        </button>
      ))}
      {items.map((it, i) => (
        <div
          key={`i${i}`}
          className={`px-4 py-3 ${i < items.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : ''}`}
        >
          <div className="text-body1-regular text-slate-800 dark:text-slate-200">{it.title}</div>
          <div className="text-body2-regular mt-0.5 text-slate-400">{it.meta}</div>
        </div>
      ))}
    </div>
  )
}
