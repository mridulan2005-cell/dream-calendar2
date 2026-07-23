import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Share2, ArrowRight, Info } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { progress } from '../logic/timetable.js'
import { TERM, SEEDED_TERM } from '../data/seed.js'
import { departments } from '../data/aeroTimetable.js'
import Sidebar from '../components/Sidebar.jsx'
import StepNav from '../components/StepNav.jsx'
import { buildSteps } from '../logic/plannerSteps.js'
import CoursesSection from '../components/sections/CoursesSection.jsx'
import FacultySection from '../components/sections/FacultySection.jsx'
import SlotSection from '../components/sections/SlotSection.jsx'
import VenueSection from '../components/sections/VenueSection.jsx'
import SectionHeader from '../components/sections/SectionHeader.jsx'
import DraftTimetable from './DraftTimetable.jsx'

// The redesigned Department Timetable planner. A single workspace: a vertical
// stepper on the left (primary nav) and the active section on the right. All
// planner steps are accessible from the left rail so users can jump freely to
// courses, faculty, slot, venue, or generate at any time.
// `embedded` renders the planner inside another shell (the Faculty workspace):
// the IITB Experience sidebar is dropped, it fills its parent rather than the
// whole viewport, and it lands on the Master Timetable step.
// `viewer` (a faculty member or student, not the coordinator) strips the planner
// down to a read-only Master Timetable: no step-nav, no review rail. `role` tells
// DraftTimetable which viewer it is so it can highlight that faculty's courses.
export default function Workspace({ embedded = false, viewer = false, role = 'ttc' }) {
  const { courses, workflow, conflicts, generate, activeStep, setActiveStep, aeroCourses } = useApp()
  const navigate = useNavigate()
  const { search } = useLocation()
  const active = activeStep
  const setActive = setActiveStep

  // A dashboard shortcut may deep-link straight to a planner step (e.g. the slot
  // preference deadline reminder → slot allotment) via `?step=`. It wins over the
  // default landing step below, and reaches viewers too so a faculty member can
  // be dropped on the slot surface.
  const requestedStep = new URLSearchParams(search).get('step')

  // Term scope (academic year + semester + department) shared by every step.
  // Owned here so it survives switching steps and so the scope band reads the
  // same on courses, faculty, slot, venue AND the Master Timetable.
  const [scope, setScope] = useState({
    academicYear: SEEDED_TERM.academicYear,
    semester: SEEDED_TERM.semester,
    departmentId: 'idc',
  })

  // The left-rail badges answer to the department in scope. IDC's track its own
  // courses; a B.Tech department (e.g. Aerospace) tracks its own editable slice,
  // so allotting a faculty / slot / venue there moves its badges just like IDC.
  // A department not yet imported reads 0/0.
  const dept = departments.find((d) => d.id === scope.departmentId)
  const isBtech = !!dept && dept.id !== 'idc'
  const EMPTY_PROGRESS = {
    total: 0,
    faculty: { done: 0, total: 0 },
    slot: { done: 0, total: 0 },
    venue: { done: 0, total: 0 },
  }
  const p = isBtech ? (dept.ready ? progress(aeroCourses) : EMPTY_PROGRESS) : progress(courses)
  const conflictFree = isBtech ? true : conflicts.conflicts.length === 0

  const slotDone = workflow.slotFinalised
  const steps = buildSteps(workflow)

  // Entering the embedded (Faculty) planner always lands on the Master Timetable.
  // Viewers are pinned there — they have no other steps to reach.
  useEffect(() => {
    if (requestedStep) setActiveStep(requestedStep)
    else if (embedded || viewer) setActiveStep('generate')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, viewer, requestedStep])

  useEffect(() => {
    if (active === 'generate' && !workflow.generated && slotDone) {
      generate()
    }
  }, [active, workflow.generated, slotDone, generate])

  const unassigned = p.slot.total - p.slot.done

  // One nav element shared by whichever step is active — each step renders it
  // beneath its own full-width page header (see StepShell / DraftTimetable).
  // Viewers (faculty / students) get no planner nav at all, and the embedded
  // (Department Timetable) shell supplies its own rail at the page edge, so in
  // both cases the step content renders without one.
  const navEl =
    viewer || embedded ? null : (
      <StepNav
        steps={steps}
        active={active}
        onSelect={setActive}
        stats={{ conflictFree, conflicts: conflicts.conflicts.length }}
        progress={p}
      />
    )

  return (
    <div
      className={
        embedded
          ? 'flex min-h-0 min-w-0 flex-1 overflow-hidden bg-canvas text-slate-900 dark:bg-slate-950 dark:text-slate-100'
          : 'flex h-full min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100'
      }
    >
      {!embedded && <Sidebar />}

      {/* The right side: each step renders its own full-width page header with
          the planner nav beneath it (uniform across courses … master
          timetable). The Master Timetable rides on a soft mint canvas. */}
      <div
        className={`flex min-w-0 flex-1 flex-col ${
          active === 'generate' ? 'bg-[#F5F9F8] dark:bg-slate-950' : ''
        }`}
      >
        {/* Every step wears the same chrome: a full-width page header band at
            the top with the planner nav directly beneath it. The Master
            Timetable owns that layout itself; the other steps get it via the
            shared StepShell. */}
        {active === 'generate' && (
          <DraftTimetable nav={navEl} viewer={viewer} role={role} scope={scope} setScope={setScope} />
        )}
        {active === 'courses' && <CoursesSection nav={navEl} scope={scope} setScope={setScope} role={role} />}
        {active === 'faculty' && <FacultySection nav={navEl} scope={scope} setScope={setScope} />}
        {active === 'slot' && <SlotSection nav={navEl} scope={scope} setScope={setScope} role={role} />}
        {active === 'venue' && <VenueSection nav={navEl} scope={scope} setScope={setScope} role={role} />}
      </div>
    </div>
  )
}


// ── Step 5: Generate ───────────────────────────────────────────────────────
function GenerateSection() {
  const { courses, workflow, generate, changeRequests } = useApp()
  const navigate = useNavigate()
  const p = progress(courses)
  const slotComplete = p.slot.done === p.slot.total

  return (
    <div className="mx-auto max-w-3xl">
      <SectionHeader title="Generate Timetable" eyebrow="Build the draft from the allotments" />

      <p className="mt-4 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
        The timetable can be generated once slot allotment is complete. Faculty and venue allotment
        need not be finished — though for the most efficient result it's best to wait until they're
        nearly done.
      </p>

      {!workflow.generated ? (
        <div className="mt-6">
          <button
            disabled={!slotComplete}
            onClick={() => {
              generate()
              navigate('/draft')
            }}
            className="flex items-center gap-2 rounded-2xl bg-accent px-7 py-4 text-base font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Generate Timetable <ArrowRight size={18} />
          </button>
          {!slotComplete && (
            <p className="mt-2 text-sm text-amber-600">
              {p.slot.total - p.slot.done} course(s) still need a slot before you can generate.
            </p>
          )}
        </div>
      ) : (
        <button
          onClick={() => navigate('/draft')}
          className="mt-6 w-80 rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-accent hover:shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="text-base font-semibold text-slate-900 dark:text-white">
            Open Draft Timetable
          </div>
          <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {changeRequests.length} change request(s) raised · review & publish
          </div>
        </button>
      )}
    </div>
  )
}
