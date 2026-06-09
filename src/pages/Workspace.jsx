import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Share2, ArrowRight } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { progress } from '../logic/timetable.js'
import { TERM } from '../data/seed.js'
import StepNav from '../components/StepNav.jsx'
import CoursesSection from '../components/sections/CoursesSection.jsx'
import FacultySection from '../components/sections/FacultySection.jsx'
import SlotSection from '../components/sections/SlotSection.jsx'
import VenueSection from '../components/sections/VenueSection.jsx'
import SectionHeader from '../components/sections/SectionHeader.jsx'
import DraftTimetable from './DraftTimetable.jsx'

const STEPS = [
  { id: 'courses', n: '01', label: 'Running Courses' },
  { id: 'faculty', n: '02', label: 'Faculty Allotment' },
  { id: 'slot', n: '03', label: 'Slot Allotment' },
  { id: 'venue', n: '04', label: 'Venue Allotment' },
  { id: 'generate', n: '05', label: 'Generate Timetable' },
]

// The redesigned Department Timetable planner. A single workspace: a vertical
// stepper on the left (primary nav) and the active section on the right. Steps
// after "Running Courses" stay locked until the course list is confirmed, so the
// flow is entered in order (guided wizard with free back-navigation, NN/g).
export default function Workspace() {
  const { courses, workflow, conflicts, generate } = useApp()
  const [active, setActive] = useState('courses')

  const p = progress(courses)
  const conflictFree = conflicts.conflicts.length === 0

  // Step-by-step gating: a step is "done" only when the planner EXPLICITLY marks
  // it done (not merely because the seed data is already filled). Each step
  // unlocks only once the previous one is marked done — courses → faculty → slot
  // → (venue + generate).
  const coursesDone = workflow.coursesFinalised
  const facultyDone = workflow.facultyFinalised
  const slotDone = workflow.slotFinalised
  const venueDone = workflow.venueFinalised

  const lockedById = {
    courses: false,
    faculty: false,
    slot: false,
    venue: false,
    generate: false,
  }
  const doneById = {
    courses: coursesDone,
    faculty: facultyDone,
    slot: slotDone,
    venue: venueDone,
    generate: workflow.generated,
  }
  const steps = STEPS.map((s) => ({ ...s, locked: lockedById[s.id], done: doneById[s.id] }))

  // If the current step re-locks (e.g. an earlier allotment was undone), fall
  // back to the furthest step still available.
  const activeLocked = lockedById[active]
  useEffect(() => {
    if (activeLocked) {
      const fallback = [...steps].reverse().find((s) => !s.locked)
      if (fallback) setActive(fallback.id)
    }
  }, [activeLocked]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (active === 'generate' && !workflow.generated) {
      generate()
    }
  }, [active, workflow.generated, generate])

  const unassigned = p.slot.total - p.slot.done

  return (
    <div className="flex h-full min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
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
            <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              <Share2 size={15} /> Share access
            </button>
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


