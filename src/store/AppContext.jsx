import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import {
  courses as seedCourses,
  changeRequests as seedRequests,
  sharedAccess as seedShared,
  weeklyElectives as seedWeeklyElectives,
} from '../data/seed.js'
import { aeroCourses as seedAeroCourses } from '../data/aeroTimetable.js'
import { SEED_CURRICULUM } from '../data/curriculum.js'
import { DEFAULT_SLOT_SYSTEM, cloneSlotSystem } from '../data/slotSystem.js'
import { applyOp, detectConflicts, clashKey } from '../logic/timetable.js'

const AppContext = createContext(null)

// The slot system is the institute "source of truth" (S / L / M). It's editable
// on the Slot System page and persisted to localStorage so it behaves like the
// backing file — survives reloads and flows to every surface that fetches it.
const SLOT_SYSTEM_KEY = 'iitb-slot-system'
function loadSlotSystem() {
  if (typeof localStorage === 'undefined') return cloneSlotSystem(DEFAULT_SLOT_SYSTEM)
  try {
    const raw = localStorage.getItem(SLOT_SYSTEM_KEY)
    if (!raw) return cloneSlotSystem(DEFAULT_SLOT_SYSTEM)
    const parsed = JSON.parse(raw)
    if (parsed && parsed.S && parsed.L && parsed.M) return parsed
  } catch {
    /* fall through to default */
  }
  return cloneSlotSystem(DEFAULT_SLOT_SYSTEM)
}

const initialState = {
  // A new term is PRE-POPULATED with last year's mapping by default: every course
  // carries over its previous weeks and room, so the coordinator starts from the
  // previous timetable and edits from there (rather than allotting from scratch).
  // `prevSlots` / `prevVenue` still hold last year's values as the on-screen
  // reference (e.g. the "optimal slot" hints in the grid). This carry-over flows
  // to every surface that reads `courses` — the sem & week grid, master timetable,
  // and the slot / venue allotment pages.
  courses: seedCourses.map((c) => ({
    ...c,
    prevSlots: c.prevSlots ?? c.slots,
    prevVenue: c.venue,
  })),
  changeRequests: seedRequests,
  sharedAccess: seedShared,
  // The Aerospace (B.Tech) department's own editable courses. It reads through
  // the SAME planner steps as IDC — faculty / slot / venue are all allottable —
  // so it lives in the store just like the IDC courses, with last year's values
  // carried as the on-screen reference. Seeded from the published curriculum.
  aeroCourses: seedAeroCourses.map((c) => ({
    ...c,
    faculty: [...c.faculty],
    slots: [...c.slots],
    prevSlots: [...c.slots],
    prevVenue: c.venue,
    prevFaculty: [...c.faculty],
  })),
  // Weekly electives likewise carry over to the slots where they ran last year.
  weeklyElectives: seedWeeklyElectives.map((e) => ({
    ...e,
    weeklySlots: e.prevWeeklySlots?.length ? [...e.prevWeeklySlots] : null,
  })),
  // The BDes programme curriculum — the versioned knowledge layer that defines
  // what each batch studies per semester. Editable on the Curriculum page.
  curriculum: SEED_CURRICULUM,
  // The institute slot system (S / L / M). Editable on the Slot System page;
  // hydrated from localStorage so edits persist like a backing file.
  slotSystem: loadSlotSystem(),
  // The course currently being allotted (highlighted in the list, focused in the
  // grid). Synced across tabs so switching course in the planner switches it in
  // the grid too.
  selectedCourseId: null,
  // The full multi-selection (Shift/⌘-click in the list). Synced so the grid can
  // place every selected course into a clicked week at once (running them in
  // parallel). selectedCourseId is the primary of this set.
  selectedCourseIds: [],
  // Which planner step the list window is on. Synced across tabs so the grid
  // editor knows whether it's a slot surface (editable) or a venue surface.
  activeStep: 'courses',
  // Clashes the coordinator has explicitly dismissed (by clashKey). They drop
  // out of the live conflict analysis until the underlying placement changes and
  // a genuinely different clash re-arises.
  dismissedClashes: [],
  workflow: {
    // Each step is unlocked only after the previous one is explicitly marked done.
    coursesFinalised: false,
    facultyFinalised: false,
    slotFinalised: false,
    venueFinalised: false,
    generated: false, // becomes true after "Generate Timetable"
    published: false,
  },
  theme: 'light',
  past: [], // undo stack: snapshots of { courses, changeRequests }
  future: [], // redo stack
}

// Actions that change the timetable and should be undoable.
const UNDOABLE = new Set([
  'UPDATE_COURSE',
  'UPDATE_COURSES',
  'UPDATE_WEEKLY_ELECTIVE',
  'ACCEPT_REQUEST',
  'REJECT_REQUEST',
  'RESOLVE_REQUESTS',
])
const snapshot = (s) => ({
  courses: s.courses,
  changeRequests: s.changeRequests,
  weeklyElectives: s.weeklyElectives,
})

// History wrapper around the base reducer: records a snapshot before each
// undoable change, and handles UNDO / REDO.
function reducer(state, action) {
  if (action.type === 'UNDO') {
    if (!state.past.length) return state
    const prev = state.past[state.past.length - 1]
    return {
      ...state,
      ...prev,
      past: state.past.slice(0, -1),
      future: [snapshot(state), ...state.future],
    }
  }
  if (action.type === 'REDO') {
    if (!state.future.length) return state
    const next = state.future[0]
    return {
      ...state,
      ...next,
      past: [...state.past, snapshot(state)],
      future: state.future.slice(1),
    }
  }
  const nextState = baseReducer(state, action)
  if (UNDOABLE.has(action.type) && nextState !== state) {
    return {
      ...nextState,
      past: [...state.past, snapshot(state)].slice(-100),
      future: [],
    }
  }
  return nextState
}

function baseReducer(state, action) {
  switch (action.type) {
    case 'UPDATE_COURSE': {
      const courses = state.courses.map((c) =>
        c.id === action.course.id ? action.course : c,
      )
      return { ...state, courses }
    }
    // Allot faculty / slot / venue on one Aerospace course. Mirrors UPDATE_COURSE
    // but on the department's own slice.
    case 'UPDATE_AERO_COURSE': {
      const aeroCourses = state.aeroCourses.map((c) =>
        c.id === action.course.id ? action.course : c,
      )
      return { ...state, aeroCourses }
    }
    // Batch update (e.g. a drag that moves/swaps several courses at once).
    case 'UPDATE_COURSES': {
      const byId = new Map(action.courses.map((c) => [c.id, c]))
      const courses = state.courses.map((c) => byId.get(c.id) || c)
      return { ...state, courses }
    }
    case 'UPDATE_WEEKLY_ELECTIVE': {
      const weeklyElectives = state.weeklyElectives.map((e) =>
        e.id === action.elective.id ? action.elective : e,
      )
      return { ...state, weeklyElectives }
    }
    case 'REMOVE_COURSE':
      return { ...state, courses: state.courses.filter((c) => c.id !== action.id) }

    case 'ADD_COURSE':
      return { ...state, courses: [action.course, ...state.courses] }

    case 'FINALISE_COURSES':
      return { ...state, workflow: { ...state.workflow, coursesFinalised: true } }

    // Mark an allotment step (faculty | slot | venue) done / not-done.
    case 'SET_STEP_DONE': {
      const key = `${action.step}Finalised`
      return { ...state, workflow: { ...state.workflow, [key]: action.value } }
    }

    case 'GENERATE':
      return { ...state, workflow: { ...state.workflow, generated: true } }

    case 'ACCEPT_REQUEST': {
      const req = state.changeRequests.find((r) => r.id === action.id)
      if (!req) return state
      const courses = state.courses.map((c) =>
        c.id === req.courseId ? applyOp(c, req.op) : c,
      )
      const changeRequests = state.changeRequests.map((r) =>
        r.id === action.id ? { ...r, status: 'accepted' } : r,
      )
      return { ...state, courses, changeRequests }
    }
    case 'REJECT_REQUEST': {
      const changeRequests = state.changeRequests.map((r) =>
        r.id === action.id ? { ...r, status: 'rejected', rejectionReason: action.reason || '' } : r,
      )
      return { ...state, changeRequests }
    }
    // Mark request(s) resolved WITHOUT applying their literal op — used when the
    // TTC's manual edit (placement mode) supersedes the request.
    case 'RESOLVE_REQUESTS': {
      const ids = new Set(action.ids)
      const changeRequests = state.changeRequests.map((r) =>
        ids.has(r.id) ? { ...r, status: 'accepted' } : r,
      )
      return { ...state, changeRequests }
    }
    case 'SET_SHARE_ROLE': {
      const sharedAccess = state.sharedAccess.map((p, i) =>
        i === action.index ? { ...p, role: action.role } : p,
      )
      return { ...state, sharedAccess }
    }
    case 'ADD_SHARE': {
      return { ...state, sharedAccess: [...state.sharedAccess, action.person] }
    }
    case 'PUBLISH':
      return { ...state, workflow: { ...state.workflow, published: true } }

    case 'SET_THEME':
      return { ...state, theme: action.theme }

    case 'SET_SELECTED_COURSE':
      return { ...state, selectedCourseId: action.id, selectedCourseIds: action.id ? [action.id] : [] }

    case 'SET_SELECTED_COURSES':
      return { ...state, selectedCourseIds: action.ids, selectedCourseId: action.ids[0] || null }

    case 'SET_ACTIVE_STEP':
      return { ...state, activeStep: action.step }

    case 'DISMISS_CLASH':
      return state.dismissedClashes.includes(action.key)
        ? state
        : { ...state, dismissedClashes: [...state.dismissedClashes, action.key] }

    // Replace the whole curriculum knowledge layer (the Curriculum page computes
    // the next object immutably: edits, new versions, batch reassignments).
    case 'SET_CURRICULUM':
      return { ...state, curriculum: action.curriculum }

    // Replace the institute slot system (the Slot System editor computes the
    // next object immutably). Persisted + broadcast so every surface refetches.
    case 'SET_SLOT_SYSTEM':
      return { ...state, slotSystem: action.slotSystem }

    // Replace the shared slice with state mirrored from another browser tab
    // (see the BroadcastChannel sync in AppProvider). Not undoable, and never
    // re-broadcast (the `applyingRemote` guard suppresses the echo).
    case 'HYDRATE':
      return { ...state, ...action.payload }

    default:
      return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // Keep the <html> class in sync with the theme for Tailwind dark mode.
  useEffect(() => {
    const root = document.documentElement
    if (state.theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
  }, [state.theme])

  // Persist the slot system so it behaves like the institute's backing file —
  // edits survive reloads and are picked up by any surface that reads it.
  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(SLOT_SYSTEM_KEY, JSON.stringify(state.slotSystem))
    } catch {
      /* storage may be unavailable (private mode) — non-fatal */
    }
  }, [state.slotSystem])

  // --- Global undo / redo shortcuts ---------------------------------------
  // Ctrl/Cmd+Z undoes the last edit; Ctrl/Cmd+V (and the conventional
  // Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z) redoes it. Active everywhere — the grid
  // editor, the planner and the draft — so an edit can always be walked back.
  // We bow out while a text field is focused so its native editing still works
  // (and a real paste in an input is never hijacked).
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      )
        return
      if (!(e.metaKey || e.ctrlKey)) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault()
        dispatch({ type: 'UNDO' })
      } else if (k === 'y' || k === 'v' || (k === 'z' && e.shiftKey)) {
        e.preventDefault()
        dispatch({ type: 'REDO' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // --- Cross-tab sync (BroadcastChannel) ----------------------------------
  // The slot-grid editor opens in a SEPARATE browser tab; each tab runs its own
  // store. We mirror the shared slice (courses / change requests / workflow /
  // access) across tabs so a slot edit in either surface shows up in the other.
  // A freshly opened tab asks already-open tabs for the current state (the
  // channel does not replay past messages), and every local change is broadcast
  // as a patch. `applyingRemote` stops a remote-applied change from echoing back.
  const channelRef = useRef(null)
  const applyingRemote = useRef(false)
  const skipFirstBroadcast = useRef(true)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const slice = (s) => ({
      courses: s.courses,
      changeRequests: s.changeRequests,
      workflow: s.workflow,
      sharedAccess: s.sharedAccess,
      selectedCourseId: s.selectedCourseId,
      selectedCourseIds: s.selectedCourseIds,
      activeStep: s.activeStep,
      slotSystem: s.slotSystem,
      weeklyElectives: s.weeklyElectives,
    })
    const ch = new BroadcastChannel('timetable-sync')
    channelRef.current = ch
    ch.onmessage = (e) => {
      const msg = e.data
      if (!msg || !msg.type) return
      if (msg.type === 'REQUEST_STATE') {
        ch.postMessage({ type: 'FULL_STATE', payload: slice(stateRef.current) })
      } else if (msg.type === 'FULL_STATE' || msg.type === 'PATCH') {
        applyingRemote.current = true
        dispatch({ type: 'HYDRATE', payload: msg.payload })
      }
    }
    // Catch up to any tab that's already open.
    ch.postMessage({ type: 'REQUEST_STATE' })
    return () => {
      ch.close()
      channelRef.current = null
    }
  }, [])

  // Broadcast every local change to the other tabs — skipping the initial mount
  // (so a new tab never clobbers others with its seed state) and any change we
  // ourselves just applied from a remote message.
  useEffect(() => {
    if (skipFirstBroadcast.current) {
      skipFirstBroadcast.current = false
      return
    }
    if (applyingRemote.current) {
      applyingRemote.current = false
      return
    }
    channelRef.current?.postMessage({
      type: 'PATCH',
      payload: {
        courses: state.courses,
        changeRequests: state.changeRequests,
        workflow: state.workflow,
        sharedAccess: state.sharedAccess,
        selectedCourseId: state.selectedCourseId,
        selectedCourseIds: state.selectedCourseIds,
        activeStep: state.activeStep,
        slotSystem: state.slotSystem,
        weeklyElectives: state.weeklyElectives,
      },
    })
  }, [
    state.courses,
    state.changeRequests,
    state.workflow,
    state.sharedAccess,
    state.selectedCourseId,
    state.selectedCourseIds,
    state.activeStep,
    state.slotSystem,
    state.weeklyElectives,
  ])

  // Derived: live conflict analysis over the current courses, minus any clashes
  // the coordinator has dismissed (and their cell/course markers rebuilt to match,
  // so a dismissed clash also clears its red grid highlight and unblocks publish).
  const conflicts = useMemo(() => {
    const raw = detectConflicts(state.courses)
    if (!state.dismissedClashes?.length) return raw
    const dismissed = new Set(state.dismissedClashes)
    const kept = raw.conflicts.filter((c) => !dismissed.has(clashKey(c)))
    if (kept.length === raw.conflicts.length) return raw
    const conflictCells = new Set()
    const conflictCourseIds = new Set()
    for (const c of kept) {
      const [idA, idB] = c.courseIds
      conflictCourseIds.add(idA)
      conflictCourseIds.add(idB)
      conflictCells.add(`${idA}@${c.slot}`)
      conflictCells.add(`${idB}@${c.slot}`)
    }
    return { conflicts: kept, conflictCourseIds, conflictCells }
  }, [state.courses, state.dismissedClashes])

  const pendingRequests = useMemo(
    () => state.changeRequests.filter((r) => r.status === 'pending'),
    [state.changeRequests],
  )

  const value = useMemo(
    () => ({
      ...state,
      conflicts,
      pendingRequests,
      // action creators
      updateCourse: (course) => dispatch({ type: 'UPDATE_COURSE', course }),
      updateCourses: (courses) => dispatch({ type: 'UPDATE_COURSES', courses }),
      updateAeroCourse: (course) => dispatch({ type: 'UPDATE_AERO_COURSE', course }),
      updateWeeklyElective: (elective) => dispatch({ type: 'UPDATE_WEEKLY_ELECTIVE', elective }),
      finaliseCourses: () => dispatch({ type: 'FINALISE_COURSES' }),
      setStepDone: (step, value) => dispatch({ type: 'SET_STEP_DONE', step, value }),
      setSelectedCourse: (id) => dispatch({ type: 'SET_SELECTED_COURSE', id }),
      setSelectedCourses: (ids) => dispatch({ type: 'SET_SELECTED_COURSES', ids }),
      setActiveStep: (step) => dispatch({ type: 'SET_ACTIVE_STEP', step }),
      dismissClash: (key) => dispatch({ type: 'DISMISS_CLASH', key }),
      setCurriculum: (curriculum) => dispatch({ type: 'SET_CURRICULUM', curriculum }),
      updateSlotSystem: (slotSystem) => dispatch({ type: 'SET_SLOT_SYSTEM', slotSystem }),
      resetSlotSystem: () => dispatch({ type: 'SET_SLOT_SYSTEM', slotSystem: cloneSlotSystem() }),
      removeCourse: (id) => dispatch({ type: 'REMOVE_COURSE', id }),
      addCourse: (course) => dispatch({ type: 'ADD_COURSE', course }),
      generate: () => dispatch({ type: 'GENERATE' }),
      acceptRequest: (id) => dispatch({ type: 'ACCEPT_REQUEST', id }),
      rejectRequest: (id, reason) => dispatch({ type: 'REJECT_REQUEST', id, reason }),
      resolveRequests: (ids) => dispatch({ type: 'RESOLVE_REQUESTS', ids }),
      setShareRole: (index, role) => dispatch({ type: 'SET_SHARE_ROLE', index, role }),
      addShare: (person) => dispatch({ type: 'ADD_SHARE', person }),
      publish: () => dispatch({ type: 'PUBLISH' }),
      toggleTheme: () =>
        dispatch({ type: 'SET_THEME', theme: state.theme === 'dark' ? 'light' : 'dark' }),
      // Undo / redo
      undo: () => dispatch({ type: 'UNDO' }),
      redo: () => dispatch({ type: 'REDO' }),
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
    }),
    [state, conflicts, pendingRequests],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
