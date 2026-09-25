import type {
  ButtonElementAppearance,
  CounterElementAppearance,
  TextElementAppearance,
} from "@/lib/terrains";
import type { ThemeColorPair } from "@/lib/theme-colors";
import { palette } from "@/site.config";

const CREAM: ThemeColorPair = { light: palette.cream, dark: palette.cream };
const BROWN_DARK: ThemeColorPair = { light: palette.brownDark, dark: palette.brownDark };

export const DEFAULT_TEXT_ELEMENT_APPEARANCE: Required<TextElementAppearance> = {
  color: CREAM,
};

export const DEFAULT_BUTTON_ELEMENT_APPEARANCE: Required<ButtonElementAppearance> = {
  main: BROWN_DARK,
  text: CREAM,
  edge: CREAM,
};

/** Burnt-orange face for a featured (primary CTA) button. */
export const FEATURED_BUTTON_FACE_COLOR = "#a13a00";

export const DEFAULT_COUNTER_ELEMENT_APPEARANCE: Required<CounterElementAppearance> = {
  // Warm Nixie amber glow + a dim ember tube tint behind each digit.
  glow: { light: "#ff7a18", dark: "#ff7a18" },
  glass: { light: "#3a1d10", dark: "#3a1d10" },
};

export const DEFAULT_COUNTER_DIGITS = 6;
