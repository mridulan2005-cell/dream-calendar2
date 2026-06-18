// The planner's step model, shared by the Workspace and the Slot System editor
// so both render the same left-rail navigation (StepNav) consistently.
export const PLANNER_STEPS = [
  { id: 'courses', n: '01', label: 'Running Courses' },
  { id: 'faculty', n: '02', label: 'Faculty Allotment' },
  { id: 'slot', n: '03', label: 'Slot Allotment' },
  { id: 'venue', n: '04', label: 'Venue Allotment' },
  { id: 'generate', n: '05', label: 'Master Timetable' },
]

// Decorate the steps with their done/locked state from the workflow flags.
export function buildSteps(workflow) {
  const doneById = {
    courses: workflow.coursesFinalised,
    faculty: workflow.facultyFinalised,
    slot: workflow.slotFinalised,
    venue: workflow.venueFinalised,
    generate: workflow.generated,
  }
  return PLANNER_STEPS.map((s) => ({ ...s, locked: false, done: doneById[s.id] }))
}
