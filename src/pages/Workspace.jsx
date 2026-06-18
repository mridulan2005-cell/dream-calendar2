import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Share2, ArrowRight, Info } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { progress } from '../logic/timetable.js'
import { TERM } from '../data/seed.js'
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
export default function Workspace() {
  const { courses, workflow, conflicts, generate, activeStep, setActiveStep } = useApp()
  const navigate = useNavigate()
  const active = activeStep
  const setActive = setActiveStep

  const p = progress(courses)
  const conflictFree = conflicts.conflicts.length === 0

  const slotDone = workflow.slotFinalised
  const steps = buildSteps(workflow)

  useEffect(() => {
    if (active === 'generate' && !workflow.generated && slotDone) {
      generate()
    }
  }, [active, workflow.generated, slotDone, generate])

  const unassigned = p.slot.total - p.slot.done

  return (
    <div className="flex h-full min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar />
      <StepNav
        steps={steps}
        active={active}
        onSelect={setActive}
        stats={{ conflictFree, conflicts: conflicts.conflicts.length }}
        progress={p}
      />

      {active === 'generate' ? (
        <DraftTimetable />
      ) : (
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar: term context + global actions */}
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-8 py-4 dark:border-slate-800">
            <div className="flex items-center gap-6 text-sm">
              <label className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <span className="text-xs font-medium uppercase tracking-wide">Academic Year</span>
                <select className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                  <option>{TERM.academicYear}</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <span className="text-xs font-medium uppercase tracking-wide">Semester</span>
                <select className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                  <option>{TERM.semester}</option>
                </select>
              </label>
            </div>
            <div className="flex items-center gap-2">
              {/* The institute slot system (S / L / M) — a constant reference,
                  opening the editable grid. Sits beside Share access. */}
              <button
                onClick={() => navigate('/slot-system')}
                title="View and edit the institute slot system"
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-accent hover:text-accent dark:border-slate-700 dark:text-slate-300 dark:hover:border-accent"
              >
                <Info size={15} /> Slot system
              </button>
              <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                <Share2 size={15} /> Share access
              </button>
            </div>
          </header>

          {/* Section body */}
          <main className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
            {active === 'courses' && <CoursesSection />}
            {active === 'faculty' && <FacultySection />}
            {active === 'slot' && <SlotSection />}
            {active === 'venue' && <VenueSection />}
          </main>

          {/* Footer status bar */}
          <footer className="flex shrink-0 items-center gap-6 border-t border-slate-200 px-8 py-2.5 text-xs dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">
              Total courses: <b className="text-slate-700 dark:text-slate-200">{courses.length}</b>
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              Unassigned:{' '}
              <b className={unassigned ? 'text-amber-600' : 'text-slate-700 dark:text-slate-200'}>
                {unassigned}
              </b>
            </span>
            <span className="flex items-center gap-1.5">
              Conflict-free:{' '}
              <b className={conflictFree ? 'text-green-600' : 'text-red-500'}>
                {conflictFree ? 'Yes' : 'No'}
              </b>
            </span>
            <span className="ml-auto italic text-slate-400">Draft v0.8.2 · auto-saved</span>
          </footer>
        </div>
      )}
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
