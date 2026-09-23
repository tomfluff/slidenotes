import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Theme = 'system' | 'light' | 'dark';
export type FontChoice = 'atkinson' | 'system' | 'dyslexic';
export type Contrast = 'system' | 'more';
export type BadgeSize = 's' | 'm' | 'l';
export type StrokeWeight = 'thin' | 'regular' | 'thick';
/** How a marked region is drawn. Solid: fill + outline. Outline: no fill. Corners: viewfinder brackets. */
export type MarkerStyle = 'solid' | 'outline' | 'corners';
/** The frame around the slide: a padded mat, a thin mat, or a bare border. */
export type FrameStyle = 'mat' | 'thin' | 'none';

/** Marker colours are named for screen readers: a hex code tells a low-vision user nothing. */
export const MARKER_COLOURS: { id: string; name: string; hex: string; ink: string }[] = [
  { id: 'purple', name: 'Purple', hex: '#7b2cbf', ink: '#ffffff' },
  { id: 'orange', name: 'Orange', hex: '#c9421a', ink: '#ffffff' },
  { id: 'red', name: 'Red', hex: '#c8102e', ink: '#ffffff' },
  { id: 'blue', name: 'Blue', hex: '#0b57d0', ink: '#ffffff' },
  { id: 'green', name: 'Green', hex: '#0f7b4f', ink: '#ffffff' },
  { id: 'black', name: 'Black', hex: '#111111', ink: '#ffffff' },
];

export interface Settings {
  theme: Theme;
  font: FontChoice;
  /** Comment text scale for cards, composer and sheet, 100 to 200 percent. */
  commentScale: number;
  contrast: Contrast;
  marker: string;
  markerStyle: MarkerStyle;
  /** Contrastive: a white halo under the outline and around badges. Subtle: one colour. */
  halo: boolean;
  /** Pulse the region on the slide while its comment is hovered. Deliberately ignores reduced-motion. */
  pulse: boolean;
  stroke: StrokeWeight;
  badge: BadgeSize;
  frame: FrameStyle;
  /** Filmstrip and comment panel widths in pixels; null means the default. */
  railWidth: number | null;
  panelWidth: number | null;
  /** The first-run hint above the slide was dismissed. */
  hintDismissed: boolean;
  /** Free text reviewer name, stamped on new comments. */
  author: string;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  font: 'atkinson',
  commentScale: 100,
  contrast: 'system',
  marker: 'purple',
  markerStyle: 'solid',
  halo: true,
  pulse: true,
  stroke: 'regular',
  badge: 'm',
  frame: 'thin',
  railWidth: null,
  panelWidth: null,
  hintDismissed: false,
  author: '',
};

interface SettingsStore extends Settings {
  set: (patch: Partial<Settings>) => void;
  reset: () => void;
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
      reset: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'slidenotes-settings',
      storage: createJSONStorage(() => localStorage),
      version: 4,
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Omit<Partial<Settings>, 'markerStyle'> & { textScale?: number; uiScale?: number; motion?: string; markerStyle?: string };
        // v1 scaled the root font; v2 split it; v3 keeps only the comment text scale;
        // v4 drops the motion toggle and the underline marker style.
        if (version < 2 && typeof p.textScale === 'number') p.commentScale = p.textScale;
        delete p.textScale;
        delete p.uiScale;
        delete p.motion;
        if (p.markerStyle === 'edge') p.markerStyle = 'outline';
        return { ...DEFAULT_SETTINGS, ...(p as unknown as Partial<Settings>) };
      },
      partialize: (s) => ({
        theme: s.theme, font: s.font, commentScale: s.commentScale, contrast: s.contrast,
        marker: s.marker, markerStyle: s.markerStyle, halo: s.halo, pulse: s.pulse, stroke: s.stroke, badge: s.badge,
        frame: s.frame, railWidth: s.railWidth, panelWidth: s.panelWidth, hintDismissed: s.hintDismissed, author: s.author,
      }),
    },
  ),
);

const STROKE_PX: Record<StrokeWeight, string> = { thin: '1px', regular: '2px', thick: '3.5px' };
const BADGE_REM: Record<BadgeSize, string> = { s: '1.125rem', m: '1.375rem', l: '1.75rem' };

/** Mirrors settings onto the root element so CSS tokens follow them. */
export function applySettings(s: Settings): void {
  const root = document.documentElement;
  root.dataset.theme = s.theme === 'system' ? '' : s.theme;
  if (!root.dataset.theme) delete root.dataset.theme;
  root.dataset.font = s.font;
  // "System" means no attribute at all, so the OS preference media queries stay in charge.
  if (s.contrast === 'more') root.dataset.contrast = 'more';
  else delete root.dataset.contrast;
  // A multiplier on the comment text tokens; the root font size is never touched, so
  // browser zoom keeps scaling the whole tool on top of it.
  root.style.setProperty('--comment-scale', String(s.commentScale / 100));
  root.dataset.markerStyle = s.markerStyle;
  root.dataset.halo = s.halo ? 'on' : 'off';
  root.dataset.pulse = s.pulse ? 'on' : 'off';
  root.dataset.frame = s.frame;
  root.style.setProperty('--rail-w', s.railWidth ? `${s.railWidth}px` : '');
  root.style.setProperty('--panel-w', s.panelWidth ? `${s.panelWidth}px` : '');
  const colour = MARKER_COLOURS.find((c) => c.id === s.marker) ?? MARKER_COLOURS[0]!;
  root.style.setProperty('--mark', colour.hex);
  root.style.setProperty('--mark-ink', colour.ink);
  root.style.setProperty('--mark-stroke', STROKE_PX[s.stroke]);
  root.style.setProperty('--badge', BADGE_REM[s.badge]);
}

export function markerHex(id: string): string {
  return (MARKER_COLOURS.find((c) => c.id === id) ?? MARKER_COLOURS[0]!).hex;
}
