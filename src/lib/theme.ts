// D&S brand palette and type, copied from the website's globals.css so the app
// matches the web admin panel exactly. Sizes below are Tailwind's (1px on the
// web = 1pt here).
export const colors = {
  background: '#fbf6ef',
  foreground: '#221d19',
  surface: '#ffffff',
  surfaceMuted: '#f2e9dc',
  primary: '#c8102e',
  primaryDark: '#8c0b20',
  accent: '#b8712b',
  accentLight: '#d99a4e',
  border: '#e7dcc9',
  white: '#ffffff',
  // Kept for older screens; same as foreground/60.
  muted: 'rgba(34,29,25,0.6)',
  emerald: '#059669',
};

// Tailwind's `text-foreground/NN` etc.
export function fg(opacity: number) {
  return `rgba(34,29,25,${opacity})`;
}
export function primaryA(opacity: number) {
  return `rgba(200,16,46,${opacity})`;
}
export function accentA(opacity: number) {
  return `rgba(184,113,43,${opacity})`;
}

// Tailwind palette colors the admin uses for status pills.
export const tw = {
  emerald100: '#d1fae5',
  emerald50: '#ecfdf5',
  emerald300: '#6ee7b7',
  emerald600: '#059669',
  emerald700: '#047857',
  amber100: '#fef3c7',
  amber700: '#b45309',
  violet100: '#ede9fe',
  violet700: '#6d28d9',
  red50: '#fef2f2',
  red100: '#fee2e2',
  red300: '#fca5a5',
  red700: '#b91c1c',
  blue100: '#dbeafe',
  blue700: '#1d4ed8',
};

// Fonts loaded in the root layout: Bebas Neue for headings (`font-display`),
// Geist for everything else (the website's body font).
export const fonts = {
  display: 'BebasNeue_400Regular',
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
  mono: 'Menlo',
};

// Tailwind text sizes with their default line heights.
export const text = {
  xs10: { fontSize: 10, lineHeight: 14 },
  xs11: { fontSize: 11, lineHeight: 16 },
  xs: { fontSize: 12, lineHeight: 16 },
  sm: { fontSize: 14, lineHeight: 20 },
  base: { fontSize: 16, lineHeight: 24 },
  lg: { fontSize: 18, lineHeight: 28 },
  xl: { fontSize: 20, lineHeight: 28 },
  '2xl': { fontSize: 24, lineHeight: 32 },
  '3xl': { fontSize: 30, lineHeight: 36 },
};

// `tracking-wide` (0.025em) for the display font.
export function trackingWide(fontSize: number) {
  return fontSize * 0.025;
}

export const WEBSITE_URL = 'https://dsfoodreviews.com';
