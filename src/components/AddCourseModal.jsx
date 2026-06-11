import { useEffect, useState } from 'react'
import { X, Plus } from 'lucide-react'
import { PROGRAMS, DISCIPLINE_LABEL } from '../logic/timetable.js'

const DISC_CODE = Object.fromEntries(
  Object.entries(DISCIPLINE_LABEL).map(([code, label]) => [label, code]),
)
const NEEDS_DISCIPLINE = new Set(['MDes 1', 'MDes 2'])

// Build the internal cohort id from the chosen programme + discipline.
function deriveCohort(programId, discLabel) {
  if (NEEDS_DISCIPLINE.has(programId)) {
    const code = DISC_CODE[discLabel]
    return code ? `${programId}: ${code}` : programId
  }
  if (programId === 'MDesR') return 'MDesR 1'
  return programId // BDes 1..4, Dual Degree, Ph.D.
}

// A labelled field; the control sits below the label on its own line.
function Field({ label, children }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  )
}

const inputCls =
  'rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-accent/40 dark:bg-slate-800 dark:text-slate-100'
const selectCls = `${inputCls} appearance-none pr-8`

// "Add a new course" modal. Collects the course's identity (code, name, type,
// credits), where it runs (programme → cohort, discipline), and reference
// metadata. On submit it builds a course the planner can carry through faculty,
// slot and venue allotment (those start empty, like every running course).
export default function AddCourseModal({ onClose, onAdd }) {
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [type, setType] = useState('Core')
  const [credits, setCredits] = useState(6)
  const [program, setProgram] = useState('BDes 1')
  const [discipline, setDiscipline] = useState(DISCIPLINE_LABEL.CD)
  const [regLimit, setRegLimit] = useState(50)
  const [preReg, setPreReg] = useState(false)
  const [prereqs, setPrereqs] = useState([])
  const [prereqDraft, setPrereqDraft] = useState('')
  const [description, setDescription] = useState('')
  const [references, setReferences] = useState('')

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const needsDiscipline = NEEDS_DISCIPLINE.has(program)
  const canAdd = code.trim() && title.trim()

  const addPrereq = () => {
    const v = prereqDraft.trim()
    if (v && !prereqs.includes(v)) setPrereqs((p) => [...p, v])
    setPrereqDraft('')
  }

  const submit = () => {
    if (!canAdd) return
    onAdd({
      id: `NEW-${Date.now()}`,
      code: code.trim(),
      title: title.trim(),
      type,
      credits: Number(credits) || 0,
      cohort: deriveCohort(program, discipline),
      year: PROGRAMS.find((p) => p.id === program)?.label || '',
      faculty: [],
      venue: '',
      slots: [],
      durationWeeks: 1,
      dateRanges: [],
      // Extra catalogue metadata captured here, carried on the course.
      registrationLimit: Number(regLimit) || 0,
      preRegistration: preReg,
      prerequisites: prereqs,
      description: description.trim(),
      references: references.trim(),
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-course-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-7 py-5 dark:border-slate-800">
          <h2 id="add-course-title" className="text-xl font-bold text-slate-900 dark:text-white">
            Add a new course
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-7 py-6">
          {/* Identity */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <Field label="Course Code">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="DE 113"
                className={`${inputCls} w-28`}
              />
            </Field>
            <Field label="Course Name">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Introduction to Film Making"
                className={`${inputCls} min-w-0 flex-1`}
              />
            </Field>
            <Field label="Course Type">
              <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
                <option value="Core">Core course</option>
                <option value="Elective">Elective</option>
              </select>
            </Field>
            <Field label="Credits">
              <input
                type="number"
                min={0}
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
                className={`${inputCls} w-20`}
              />
            </Field>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800" />

          {/* Placement */}
          <div className="space-y-4">
            <Field label="Program">
              <div className="flex items-center gap-2">
                <select
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  className={selectCls}
                >
                  {PROGRAMS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </Field>

            {needsDiscipline && (
              <Field label="Discipline">
                <select
                  value={discipline}
                  onChange={(e) => setDiscipline(e.target.value)}
                  className={selectCls}
                >
                  {Object.values(DISCIPLINE_LABEL).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Registration Limit">
              <div className="flex flex-1 items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={regLimit}
                  onChange={(e) => setRegLimit(e.target.value)}
                  className={`${inputCls} w-20`}
                />
                <span className="text-sm text-slate-500 dark:text-slate-400">students</span>
                <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={preReg}
                    onChange={(e) => setPreReg(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent/40"
                  />
                  Select for pre-registration
                </label>
              </div>
            </Field>

            <Field label="Pre-requisites">
              <div className="min-w-0 flex-1 rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">
                {prereqs.length > 0 && (
                  <div className="mb-1.5 flex flex-wrap gap-1.5">
                    {prereqs.map((p) => (
                      <span
                        key={p}
                        className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-xs text-slate-700 shadow-sm dark:bg-slate-700 dark:text-slate-200"
                      >
                        {p}
                        <button
                          onClick={() => setPrereqs((list) => list.filter((x) => x !== p))}
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <input
                  value={prereqDraft}
                  onChange={(e) => setPrereqDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addPrereq()
                    }
                  }}
                  onBlur={addPrereq}
                  placeholder="Type to add pre-requisites"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>
            </Field>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800" />

          {/* Catalogue text */}
          <label className="flex gap-3 text-sm">
            <span className="w-28 shrink-0 pt-2 text-slate-500 dark:text-slate-400">
              Course Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Topics covered…"
              className={`${inputCls} min-w-0 flex-1 resize-y`}
            />
          </label>
          <label className="flex gap-3 text-sm">
            <span className="w-28 shrink-0 pt-2 text-slate-500 dark:text-slate-400">
              Text References
            </span>
            <textarea
              value={references}
              onChange={(e) => setReferences(e.target.value)}
              rows={3}
              placeholder="Books, papers…"
              className={`${inputCls} min-w-0 flex-1 resize-y`}
            />
          </label>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-7 py-4 dark:border-slate-800">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canAdd}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={15} /> Add to course list
          </button>
        </div>
      </div>
    </div>
  )
}
