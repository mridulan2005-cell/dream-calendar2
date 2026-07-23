import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import TopNavLayout from './components/TopNavLayout.jsx'
import FacultyLayout from './components/FacultyLayout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import FacultyPlaceholder from './pages/FacultyPlaceholder.jsx'
import FacultyTimetable from './pages/FacultyTimetable.jsx'
import MasterFlow from './pages/MasterFlow.jsx'
import Curriculum from './pages/Curriculum.jsx'
import Workspace from './pages/Workspace.jsx'
import SlotGridEditor from './pages/SlotGridEditor.jsx'
import AeroSlotGrid from './pages/AeroSlotGrid.jsx'
import SlotSystemEditor from './pages/SlotSystemEditor.jsx'

// Redirect a legacy path to its new home, preserving any query string (e.g. the
// curriculum's deep-link into a term's timetable).
function LegacyRedirect({ to }) {
  const { search } = useLocation()
  return <Navigate to={`${to}${search}`} replace />
}

export default function App() {
  return (
    <Routes>
      {/* Top-level persona tabs (Today is the landing dashboard). */}
      <Route element={<TopNavLayout />}>
        <Route path="/" element={<Dashboard />} />
        {/* The Faculty tab lands on the same day view, plus the Department
            Timetable container that carries the person into the timetable. */}
        <Route path="/faculty" element={<Dashboard variant="faculty" />} />
        <Route path="/campus" element={<FacultyPlaceholder title="Campus" />} />
        <Route path="/employee" element={<FacultyPlaceholder title="Employee" />} />
        <Route path="/head" element={<FacultyPlaceholder title="Head" />} />
      </Route>

      {/* Faculty workspace: top header + left side nav. Curriculum and Timetable
          render inline so the nav stays put. */}
      <Route path="/faculty" element={<FacultyLayout />}>
        <Route path="courses" element={<FacultyPlaceholder title="Courses" />} />
        <Route path="projects" element={<FacultyPlaceholder title="Projects" />} />
        <Route path="schedule" element={<FacultyPlaceholder title="Schedule" />} />
        <Route path="students" element={<FacultyPlaceholder title="All Students" />} />
        <Route path="curriculum" element={<Curriculum />} />
      </Route>

      {/* Timetable lands on the planner's Master Timetable, embedded in the
          My IITB faculty chrome (its own full-height shell). */}
      <Route path="/faculty/timetable" element={<FacultyTimetable />} />

      {/* The planner entry (legacy IITB Experience shell) + full-screen editors. */}
      <Route element={<Layout />}>
        <Route path="/experience" element={<MasterFlow />} />
      </Route>
      <Route path="/planner" element={<Workspace />} />
      <Route path="/slot-system" element={<SlotSystemEditor />} />
      <Route path="/slot-grid" element={<SlotGridEditor />} />
      <Route path="/aero-slot-grid" element={<AeroSlotGrid />} />

      {/* Legacy redirects → the Faculty workspace. */}
      <Route path="/curriculum" element={<LegacyRedirect to="/faculty/curriculum" />} />
      <Route path="/timetables" element={<LegacyRedirect to="/faculty/timetable" />} />
    </Routes>
  )
}
