import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import MasterFlow from './pages/MasterFlow.jsx'
import Curriculum from './pages/Curriculum.jsx'
import DepartmentTimetable from './pages/DepartmentTimetable.jsx'
import Workspace from './pages/Workspace.jsx'
import SlotGridEditor from './pages/SlotGridEditor.jsx'
import SlotSystemEditor from './pages/SlotSystemEditor.jsx'

export default function App() {
  return (
    <Routes>
      {/* IITB Experience home (global sidebar). "Department Timetable" opens the planner. */}
      <Route element={<Layout />}>
        <Route path="/" element={<MasterFlow />} />
        <Route path="/experience" element={<MasterFlow />} />
        <Route path="/curriculum" element={<Curriculum />} />
        {/* Department Timetable landing: a clean index of every year's timetable. */}
        <Route path="/timetables" element={<DepartmentTimetable />} />
      </Route>
      {/* The planner: a full-screen workspace with its own stepper navigation. */}
      <Route path="/planner" element={<Workspace />} />
      {/* The institute slot system editor — same chrome as the planner. */}
      <Route path="/slot-system" element={<SlotSystemEditor />} />
      {/* The direct-manipulation week grid — opens in its own state-synced tab. */}
      <Route path="/slot-grid" element={<SlotGridEditor />} />
    </Routes>
  )
}
