import { Routes, Route, Navigate } from 'react-router-dom'
import TopNavLayout from './components/TopNavLayout.jsx'
import FacultyLayout from './components/FacultyLayout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import FacultyPlaceholder from './pages/FacultyPlaceholder.jsx'
import FacultyTimetable from './pages/FacultyTimetable.jsx'
import Curriculum from './pages/Curriculum.jsx'
import SlotGridEditor from './pages/SlotGridEditor.jsx'
import AeroSlotGrid from './pages/AeroSlotGrid.jsx'

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

      {/* Full-screen slot-grid editors — opened in their own tab from the Slot
          Allotment step (window.open), so they carry no app chrome. */}
      <Route path="/slot-grid" element={<SlotGridEditor />} />
      <Route path="/aero-slot-grid" element={<AeroSlotGrid />} />

      {/* Anything else → the landing dashboard. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
