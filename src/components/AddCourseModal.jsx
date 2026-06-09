import { useState } from 'react'
import { X, Check } from 'lucide-react'
import { PROGRAMS, DISCIPLINE_LABEL } from '../logic/timetable.js'

const DISCIPLINES = Object.values(DISCIPLINE_LABEL)

export default function AddCourseModal({ isOpen, onClose, onSave }) {
  const [formData, setFormData] = useState({
    code: '',
    title: '',
    type: 'Core',
    credits: '',
    program: 'BDes 1',
    discipline: '',
    registrationLimit: '',
    preRegistration: false,
    prerequisites: '',
    description: '',
    references: '',
  })

  if (!isOpen) return null

  const selectedProgram = PROGRAMS.find((p) => p.id === formData.program)
  const isMDes = selectedProgram?.sub?.options?.length > 0

  const handleSave = () => {
    let cohort = formData.program
    if (isMDes && formData.discipline) {
      // Find the short code for the selected discipline label
      const discEntry = Object.entries(DISCIPLINE_LABEL).find(
        ([k, v]) => v === formData.discipline
      )
      if (discEntry) {
        cohort = `${formData.program}: ${discEntry[0]}`
      }
    }

    const newCourse = {
      id: `NEW-${Date.now()}`,
      code: formData.code || 'DE ___',
      title: formData.title || 'Untitled Course',
      type: formData.type || 'Core',
      credits: Number(formData.credits) || 0,
      cohort,
      year: selectedProgram?.label || formData.program,
      faculty: [],
      venue: '',
      slots: [],
      durationWeeks: 1,
      dateRanges: [],
      // Extra fields (unused for logic but kept for future reference based on UI instructions)
      registrationLimit: formData.registrationLimit,
      preRegistration: formData.preRegistration,
      prerequisites: formData.prerequisites,
      description: formData.description,
      references: formData.references,
    }

    onSave(newCourse)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-[800px] max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between px-8 pt-8 pb-4">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Add a new course</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6 px-8 py-2">
          {/* Row 1: Code and Name */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-6">
            <div className="flex items-center gap-4">
              <label className="text-[14px] font-medium text-slate-700 dark:text-slate-300 w-[100px] shrink-0">
                Course Code:
              </label>
              <input
                type="text"
                autoFocus
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full rounded-xl bg-slate-100 px-4 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800 dark:text-white placeholder:text-slate-400"
                placeholder="enter the provided code"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="text-[14px] font-medium text-slate-700 dark:text-slate-300 w-[100px] shrink-0">
                Course Name:
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full rounded-xl bg-slate-100 px-4 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800 dark:text-white placeholder:text-slate-400"
                placeholder="enter the approved name"
              />
            </div>

            {/* Row 2: Type and Credits */}
            <div className="flex items-center gap-4">
              <label className="text-[14px] font-medium text-slate-700 dark:text-slate-300 w-[100px] shrink-0">
                Course Type:
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full appearance-none rounded-xl bg-slate-100 px-4 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800 dark:text-white"
              >
                <option value="Core">Core</option>
                <option value="Elective">Elective</option>
              </select>
            </div>
            <div className="flex items-center gap-4">
              <label className="text-[14px] font-medium text-slate-700 dark:text-slate-300 w-[100px] shrink-0">
                Credits:
              </label>
              <input
                type="number"
                value={formData.credits}
                onChange={(e) => setFormData({ ...formData, credits: e.target.value })}
                className="w-full rounded-xl bg-slate-100 px-4 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800 dark:text-white placeholder:text-slate-400"
                placeholder="enter approved credits"
                min="0"
              />
            </div>
          </div>

          <hr className="my-6 border-slate-200 dark:border-slate-800" />

          {/* Row 3 & 4: Program and Discipline */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-6">
            <div className="flex items-center gap-4">
              <label className="text-[14px] font-medium text-slate-700 dark:text-slate-300 w-[100px] shrink-0">
                Program:
              </label>
              <div className="flex w-full items-center gap-3">
                <select
                  value={formData.program}
                  onChange={(e) => {
                    const newProg = e.target.value
                    setFormData({
                      ...formData,
                      program: newProg,
                      discipline: '',
                    })
                  }}
                  className="w-full appearance-none rounded-xl bg-slate-100 px-4 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800 dark:text-white"
                >
                  {PROGRAMS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <button className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition">
                  <span className="text-xl font-light leading-none">+</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {isMDes && (
                <>
                  <label className="text-[14px] font-medium text-slate-700 dark:text-slate-300 w-[100px] shrink-0">
                    Discipline:
                  </label>
                  <div className="flex w-full items-center gap-3">
                    <select
                      value={formData.discipline}
                      onChange={(e) => setFormData({ ...formData, discipline: e.target.value })}
                      className="w-full appearance-none rounded-xl bg-slate-100 px-4 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="">type or select from dropdown</option>
                      {DISCIPLINES.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <button className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition">
                      <span className="text-xl font-light leading-none">+</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Row 5: Registration Limit */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 pt-2">
            <div className="flex items-center gap-4 col-span-2">
              <label className="text-[14px] font-medium text-slate-700 dark:text-slate-300 w-[130px] shrink-0">
                Registration Limit:
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={formData.registrationLimit}
                  onChange={(e) => setFormData({ ...formData, registrationLimit: e.target.value })}
                  className="w-36 rounded-xl bg-slate-100 px-4 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800 dark:text-white placeholder:text-slate-400"
                  placeholder="enter number of"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">students</span>
              </div>
              <div className="ml-8 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="pre-reg"
                  checked={formData.preRegistration}
                  onChange={(e) => setFormData({ ...formData, preRegistration: e.target.checked })}
                  className="h-5 w-5 rounded border-2 border-slate-300 text-indigo-600 focus:ring-indigo-600 dark:border-slate-600 dark:bg-slate-800 dark:ring-offset-slate-900"
                />
                <label htmlFor="pre-reg" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  Select for pre-registration
                </label>
              </div>
            </div>
          </div>

          {/* Row 6: Prerequisites */}
          <div className="flex gap-4 pt-4">
            <label className="text-[14px] font-medium text-slate-700 dark:text-slate-300 w-[130px] shrink-0 mt-2">
              Pre-requisites:
            </label>
            <textarea
              value={formData.prerequisites}
              onChange={(e) => setFormData({ ...formData, prerequisites: e.target.value })}
              className="w-full resize-none rounded-xl bg-slate-100/80 px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800/80 dark:text-white placeholder:text-slate-400"
              placeholder="Type to add pre-requisites"
              rows={3}
            />
          </div>

          <hr className="my-6 border-slate-200 dark:border-slate-800" />

          {/* Row 7: Course Description */}
          <div className="flex gap-4 pt-2">
            <label className="text-[14px] font-medium text-slate-700 dark:text-slate-300 w-[130px] shrink-0 mt-2">
              Course Description:
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full resize-none rounded-xl bg-slate-100/80 px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800/80 dark:text-white placeholder:text-slate-400"
              placeholder="Write in 80-100 words"
              rows={3}
            />
          </div>

          {/* Row 8: Text References */}
          <div className="flex gap-4 pt-2">
            <label className="text-[14px] font-medium text-slate-700 dark:text-slate-300 w-[130px] shrink-0 mt-2">
              Text References:
            </label>
            <textarea
              value={formData.references}
              onChange={(e) => setFormData({ ...formData, references: e.target.value })}
              className="w-full resize-none rounded-xl bg-slate-100/80 px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800/80 dark:text-white placeholder:text-slate-400"
              placeholder="Write in 80-100 words"
              rows={3}
            />
          </div>
        </div>

        <div className="flex items-center justify-end px-8 py-6 mt-4">
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="rounded-xl px-6 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              className="rounded-xl bg-slate-100 px-6 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 dark:hover:bg-slate-700"
            >
              Add to course list
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
