import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import {
  courses as seedCourses,
  changeRequests as seedRequests,
  sharedAccess as seedShared,
} from '../data/seed.js'
import { applyOp, detectConflicts } from '../logic/timetable.js'

const AppContext = createContext(null)

const initialState = {
  // Slot allotment starts EMPTY: no course has weeks by default. Last year's
  // slots are kept on `prevSlots` purely as an on-screen reference.
  courses: seedCourses.map((c) => ({ ...c, prevSlots: c.slots, slots: [] })),
  changeRequests: seedRequests,
  sharedAccess: seedShared,
  // The course currently being allotted (highlighted in the list, focused in the
  // grid). Synced across tabs so switching course in the planner switches it in
  // the grid too.
  selectedCourseId: null,
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
  'ACCEPT_REQUEST',
  'REJECT_REQUEST',
  'RESOLVE_REQUESTS',
])
const snapshot = (s) => ({ courses: s.courses, changeRequests: s.changeRequests })

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
    // Batch update (e.g. a drag that moves/swaps several courses at once).
    case 'UPDATE_COURSES': {
      const byId = new Map(action.courses.map((c) => [c.id, c]))
      const courses = state.courses.map((c) => byId.get(c.id) || c)
      return { ...state, courses }
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
      return { ...state, selectedCourseId: action.id }

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
      },
    })
  }, [state.courses, state.changeRequests, state.workflow, state.sharedAccess, state.selectedCourseId])

  // Derived: live conflict analysis over the current courses.
  const conflicts = useMemo(() => detectConflicts(state.courses), [state.courses])

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
      finaliseCourses: () => dispatch({ type: 'FINALISE_COURSES' }),
      setStepDone: (step, value) => dispatch({ type: 'SET_STEP_DONE', step, value }),
      setSelectedCourse: (id) => dispatch({ type: 'SET_SELECTED_COURSE', id }),
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
