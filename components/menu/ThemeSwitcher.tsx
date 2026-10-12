import type { ThemePreference } from "@/theme.config";

// ---------------------------------------------------------------------------
// Inline icon components (no external icon library in this project)
// ---------------------------------------------------------------------------

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2"  x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="4.22"  y1="4.22"  x2="6.34"  y2="6.34" />
      <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
      <line x1="2"  y1="12" x2="5"  y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.22"  y1="19.78" x2="6.34"  y2="17.66" />
      <line x1="17.66" y1="6.34"  x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SystemIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.5" y="3.5" width="19" height="13" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="16.5" x2="12" y2="21" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Switcher
// ---------------------------------------------------------------------------

interface ModeOption {
  mode: ThemePreference;
  label: string;
  Icon: React.FC<{ className?: string }>;
}

const MODES: ModeOption[] = [
  { mode: "light",  label: "Light mode",         Icon: SunIcon },
  { mode: "dark",   label: "Dark mode",          Icon: MoonIcon },
  { mode: "system", label: "Match system theme", Icon: SystemIcon },
];

interface Props {
  themePreference: ThemePreference;
  onThemePreferenceChange: (preference: ThemePreference) => void;
  /** When true, the switcher fades + slides out (overlay open). */
  hidden?: boolean;
}

/**
 * Glass light / dark / system theme switcher — a vertical frosted-pill
 * radiogroup in the top-right corner. Styling lives in globals.css
 * (.theme-switcher*). Pure-CSS :has() drives the sliding highlight pill;
 * MenuShell owns the state (session-only, seeded from theme.config.ts).
 */
export function ThemeSwitcher({
  themePreference,
  onThemePreferenceChange,
  hidden,
}: Props) {
  return (
    <fieldset
      className={`theme-switcher${hidden ? " theme-switcher--hidden" : ""}`}
    >
      <legend className="theme-switcher__legend">Theme</legend>

      {MODES.map(({ mode, label, Icon }) => (
        <label key={mode} className="theme-switcher__option">
          <input
            type="radio"
            name="site-theme"
            className="theme-switcher__input"
            value={mode}
            checked={themePreference === mode}
            onChange={() => onThemePreferenceChange(mode)}
            aria-label={label}
          />
          <Icon className="theme-switcher__icon" />
        </label>
      ))}
    </fieldset>
  );
}
