import { useMemo, useState } from 'react'
import { Check, Plus, Minus, ChevronDown, Sparkles, X } from 'lucide-react'
import { useApp } from '../../store/AppContext.jsx'
import { TERM, PREV_YEAR } from '../../data/seed.js'
import {
  PROGRAMS,
  DISCIPLINE_LABEL,
  matchesFilter,
  courseProgram,
  courseDisciplineCode,
} from '../../logic/timetable.js'
import CourseFilters from '../CourseFilters.jsx'
import SectionHeader from './SectionHeader.jsx'
import AddCourseModal from '../AddCourseModal.jsx'

const programLabel = (cohort) =>
  PROGRAMS.find((p) => p.id === courseProgram(cohort))?.label || cohort
const DISCIPLINES = Object.values(DISCIPLINE_LABEL)

// Step 1 — the running-courses list, as editable cards. Each course is carried
// over from last year; the coordinator confirms/edits programme + discipline,
// removes courses that aren't running, or adds new ones, then marks the section
// done (which unlocks allotment).
export default function CoursesSection() {
  const { courses, workflow, finaliseCourses, removeCourse, addCourse, updateCourse } = useApp()
  const [filter, setFilter] = useState({ program: '', sub: '', query: '' })
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [courseToDelete, setCourseToDelete] = useState(null)
  const [selectedCourse, setSelectedCourse] = useState(null)

  const q = filter.query.trim().toLowerCase()
  const list = useMemo(
    () =>
      courses.filter(
        (c) =>
          matchesFilter(c, filter.program, filter.sub) &&
          (!q || c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)),
      ),
    [courses, filter, q],
  )

  const updateCourseProgramme = (course, newProgramId) => {
    const isMDes = PROGRAMS.find((p) => p.id === newProgramId)?.sub != null
    let newCohort = newProgramId
    if (isMDes) {
      // try to keep previous discipline if applicable
      const prevDiscSrc = courseDisciplineCode(course.cohort) || 'ID'
      newCohort = `${newProgramId}: ${prevDiscSrc}`
    } else if (newProgramId === 'MDesR') {
      const prevSub = course.cohort.startsWith('MDesR ') ? course.cohort.replace('MDesR ', '') : '1'
      newCohort = `MDesR ${prevSub}`
    }
    updateCourse({ ...course, cohort: newCohort })
  }

  const updateCourseDiscipline = (course, newDisciplineLabel) => {
    const progCode = courseProgram(course.cohort)
    if (progCode.startsWith('MDes ')) {
      const discKey = Object.keys(DISCIPLINE_LABEL).find(k => DISCIPLINE_LABEL[k] === newDisciplineLabel) || newDisciplineLabel
      updateCourse({ ...course, cohort: `${progCode}: ${discKey}` })
    }
  }

  return (
    <div className={`mx-auto transition-all duration-300 ${selectedCourse ? 'max-w-[75rem]' : 'max-w-5xl'}`}>
      <div className="flex items-start gap-8">
        <div className="flex-1 min-w-0">
          <SectionHeader
            eyebrow={`Department Timetable ${TERM.semester} 2026-27`}
            title="Running Courses List"
            action={
              <button
                onClick={finaliseCourses}
                className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                  workflow.coursesFinalised
                    ? 'bg-ok-soft text-green-800'
                    : 'bg-accent text-white hover:brightness-95'
                }`}
              >
                {workflow.coursesFinalised && <Check size={16} strokeWidth={3} />}
                {workflow.coursesFinalised ? 'Marked as done' : "Mark this section as 'Done'"}
              </button>
            }
          />

          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Courses are carried over from Academic Year {PREV_YEAR}, {TERM.semester} Semester. Make edits
            to this list as required.
          </p>

          {!workflow.coursesFinalised && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft/40 px-4 py-3 text-sm text-slate-700 dark:border-accent/20 dark:bg-slate-800/60 dark:text-slate-200">
              <Sparkles size={15} className="text-accent" />
              Confirm the running courses to unlock faculty, slot and venue allotment.
            </div>
          )}

          {/* Filter + add */}
          <div className="mt-5 flex items-center gap-4">
            <CourseFilters value={filter} onChange={setFilter} searchPlaceholder="Search a course code or name" />
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-accent hover:text-accent dark:border-slate-700 dark:text-slate-200"
            >
              <Plus size={15} /> Add a new course
            </button>
          </div>

          {/* Cards */}
          <div className="mt-6 space-y-3 pb-4">
            {list.map((c) => {
              const isSelected = selectedCourse?.id === c.id;
              return (
              <div
                key={c.id}
                onClick={() => setSelectedCourse(c)}
                className={`flex items-center gap-5 rounded-2xl border bg-white px-5 py-4 transition cursor-pointer ${
                  isSelected
                    ? 'border-amber-400 ring-1 ring-amber-400 dark:border-amber-500 dark:ring-amber-500 dark:bg-slate-900'
                    : 'border-slate-200 hover:border-amber-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-amber-500'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    {c.type} Course · {c.credits} Credits
                  </div>
                  <div className="mt-0.5 truncate text-base font-semibold text-slate-900 dark:text-white">
                    <span className="text-slate-500 dark:text-slate-400">{c.code}</span>
                    <span className="mx-1.5 text-slate-300">|</span>
                    {c.title}
                  </div>
                </div>

                <Labelled label="Programme">
                  <div className="relative">
                    <select
                      value={courseProgram(c.cohort)}
                      onChange={(e) => updateCourseProgramme(c, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      {PROGRAMS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={15}
                      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                  </div>
                </Labelled>

                <Labelled label="Discipline">
                  <div className="relative">
                    <select
                      value={courseDisciplineCode(c.cohort) ? DISCIPLINE_LABEL[courseDisciplineCode(c.cohort)] : ''}
                      onChange={(e) => updateCourseDiscipline(c, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="appearance-none w-40 rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 disabled:opacity-50"
                      disabled={!courseProgram(c.cohort).startsWith('MDes ')}
                    >
                      <option value="">N/A</option>
                      {DISCIPLINES.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={15}
                      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                  </div>
                </Labelled>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setCourseToDelete(c)
                  }}
                  title="Remove course"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:border-red-300 hover:bg-red-50 hover:text-red-500 dark:border-slate-700"
                >
                  <Minus size={16} />
                </button>
              </div>
            )})}
            {list.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400 dark:border-slate-800">
                No courses in this view.
              </p>
            )}
          </div>

          {courseToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
              <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">Remove Course</h3>
                  <button
                    onClick={() => setCourseToDelete(null)}
                    className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="px-5 py-5 text-sm text-slate-600 dark:text-slate-300">
                  Are you sure you want to remove <strong>{courseToDelete.code} {courseToDelete.title}</strong>? This action will unassign any faculty or slots and cannot be undone via UI.
                </div>
                <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/50">
                  <button
                    onClick={() => setCourseToDelete(null)}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      removeCourse(courseToDelete.id)
                      setCourseToDelete(null)
                    }}
                    className="rounded-lg bg-red-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-red-600"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          )}

          <AddCourseModal 
            isOpen={isAddModalOpen} 
            onClose={() => setIsAddModalOpen(false)} 
            onSave={addCourse} 
          />
        </div>

        {selectedCourse && (
          <div className="w-[380px] shrink-0 sticky top-0">
            <CourseDetailsPanel 
              course={selectedCourse} 
              onClose={() => setSelectedCourse(null)} 
            />
          </div>
        )}
      </div>
    </div>
  )
}

// A small stacked "label over value" cell used on the cards.
function Labelled({ label, children }) {
  return (
    <div className="shrink-0">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      {children}
    </div>
  )
}

function CourseDetailsPanel({ course, onClose }) {
  if (!course) return null

  return (
    <div className="bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Course Details</h2>
        <button onClick={onClose} className="p-1.5 -mr-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition">
          <X size={18} />
        </button>
      </div>
      <div className="px-6 py-6 space-y-6">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-indigo-600 mb-1">{course.type} Course</div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{course.code} {course.title}</h3>
          <p className="text-sm text-slate-500 mt-1">{course.credits} Credits • {course.year}</p>
        </div>
        
        {course.registrationLimit ? (
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80">
            <div className="text-sm font-medium text-slate-800 dark:text-slate-200">Registration</div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Limit: {course.registrationLimit} students</p>
            {course.preRegistration && (
              <div className="mt-2 text-[10px] font-bold uppercase tracking-wide text-indigo-600">Pre-registration Required</div>
            )}
          </div>
        ) : null}

        <div>
           <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Pre-requisites</h4>
           <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{course.prerequisites || 'None specified'}</p>
        </div>
        <hr className="border-slate-100 dark:border-slate-800" />
        <div>
           <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Description</h4>
           <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{course.description || 'No description available for this course.'}</p>
        </div>
        <hr className="border-slate-100 dark:border-slate-800" />
        <div>
           <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Text References</h4>
           <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{course.references || 'No text references provided.'}</p>
        </div>
      </div>
    </div>
  )
}

