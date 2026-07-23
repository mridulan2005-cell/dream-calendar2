// En / Hi — a two-state language switch, the active side in the header's teal.
// Wireframe-only: the app has no translations yet, so this holds the position
// the design gives it without pretending to switch anything.
export default function LanguageToggle() {
  return (
    <div
      className="text-body2-medium flex items-center gap-1.5 tracking-[-0.3px]"
      title="Language — English (Hindi not available in this wireframe)"
    >
      <span className="text-subheading">En</span>
      <span className="h-3 w-px bg-slate-200 dark:bg-slate-700" />
      <span className="text-idle">Hi</span>
    </div>
  )
}
