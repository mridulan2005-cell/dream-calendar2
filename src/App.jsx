import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import MasterFlow from './pages/MasterFlow.jsx'
import Curriculum from './pages/Curriculum.jsx'
import Workspace from './pages/Workspace.jsx'
import SlotGridEditor from './pages/SlotGridEditor.jsx'

export default function App() {
  return (
    <Routes>
      {/* IITB Experience home (global sidebar). "Department Timetable" opens the planner. */}
      <Route element={<Layout />}>
        <Route path="/" element={<MasterFlow />} />
        <Route path="/experience" element={<MasterFlow />} />
        <Route path="/curriculum" element={<Curriculum />} />
      </Route>
      {/* The planner: a full-screen workspace with its own stepper navigation. */}
      <Route path="/planner" element={<Workspace />} />
      {/* The direct-manipulation week grid — opens in its own state-synced tab. */}
      <Route path="/slot-grid" element={<SlotGridEditor />} />
    </Routes>
  )
}
