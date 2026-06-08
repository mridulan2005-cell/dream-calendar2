# Department Timetable Maker

Draft department timetable maker for IITB (IDC), modelled on the *IITB Experience*
admin portal and the Figma design. Built to match the existing **instiapp-admin**
stack: Vite + React 18 + React Router + Tailwind + lucide-react.

## The workflow

1. **Running Courses List** — the course list + faculty handed over to the
   department is finalised (`/courses`).
2. **Allotment** — the dept TTC assigns **faculty**, **slots**, and **venues** to
   each course (`/allotment/faculty | slot | venue`). Progress counters and the
   green "done" state are derived from the data.
3. **Generate Timetable** — enabled once every course has a slot. Produces the
   draft grid (`/draft`).
4. **Draft grid** — slot × column grid, pivotable by **Student / Faculty / Venue**.
   Click any course to edit slots, duration, split date-ranges, venue, faculty.
5. **Change requests** — faculty raise requests; the TTC accepts (the structured
   change is applied to the course and conflicts re-checked) or rejects them.
6. **Publish** — locked until all change requests are resolved and there are no
   slot conflicts. **Share access** manages Editor/Viewer/Owner roles.

## The logic (`src/logic/timetable.js`)

- **Conflict detection** — two courses clash when they share a slot *and* share a
  cohort, a faculty member, or a venue. Drives the red highlighting and the
  publish lock.
- **View pivots** — one underlying timetable re-pivoted to cohort / faculty / venue
  columns.
- **Change-request engine** — `applyOp` applies `reslot` / `addSlot` / `split` /
  `venue` / `addFaculty` operations immutably.
- **Progress** — `progress()` derives the "X of N courses" counters from the data.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

State is in-memory (`src/store/AppContext.jsx`) seeded from `src/data/seed.js`;
refreshing resets it. Light/dark theme toggle is in the sidebar.
