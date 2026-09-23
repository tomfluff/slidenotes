import { useEffect, useRef } from 'react';
import { MARKER_COLOURS, useSettings, type BadgeSize, type FontChoice, type FrameStyle, type MarkerStyle, type StrokeWeight, type Theme } from './settings';
import { IconClose } from './icons';
import { RegionShape } from '@/features/review/Markers';

interface Props {
  open: boolean;
  onClose: () => void;
}

const THEMES: { id: Theme; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];
const FONTS: { id: FontChoice; label: string }[] = [
  { id: 'atkinson', label: 'Atkinson Hyperlegible' },
  { id: 'system', label: 'System font' },
  { id: 'dyslexic', label: 'OpenDyslexic' },
];
const STROKES: { id: StrokeWeight; label: string }[] = [
  { id: 'thin', label: 'Thin' },
  { id: 'regular', label: 'Regular' },
  { id: 'thick', label: 'Thick' },
];
const BADGES: { id: BadgeSize; label: string }[] = [
  { id: 's', label: 'Small' },
  { id: 'm', label: 'Regular' },
  { id: 'l', label: 'Large' },
];
const STYLES: { id: MarkerStyle; label: string; hint: string }[] = [
  { id: 'solid', label: 'Solid', hint: 'Tinted fill with an outline. Strongest.' },
  { id: 'outline', label: 'Outline', hint: 'Outline only; nothing covers the slide.' },
  { id: 'corners', label: 'Corners', hint: 'Four corner brackets, like a viewfinder. Quietest.' },
];
const HALO: { id: 'on' | 'off'; label: string }[] = [
  { id: 'off', label: 'Subtle, one colour' },
  { id: 'on', label: 'Contrastive, white halo' },
];
const FRAMES: { id: FrameStyle; label: string }[] = [
  { id: 'mat', label: 'Mat' },
  { id: 'thin', label: 'Thin' },
  { id: 'none', label: 'Border only' },
];

function Seg<T extends string>({ id, options, value, onChange }: { id: string; options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="group" aria-labelledby={id}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Scale({ id, label, value, min, max, reset, onChange }: { id: string; label: string; value: number; min: number; max: number; reset: number; onChange: (v: number) => void }) {
  return (
    <div className="srow">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="range" min={min} max={max} step={5} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-valuetext={`${value} percent`} />
      <span className="val num">
        {value}%{' '}
        {value !== reset && (
          <button type="button" className="btn ghost small" onClick={() => onChange(reset)} aria-label={`Reset ${label.toLowerCase()}`}>
            Reset
          </button>
        )}
      </span>
    </div>
  );
}

/** Native dialog: focus trapped and restored by the browser, Escape closes. Instant apply. */
export function SettingsDialog({ open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const s = useSettings();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  const colour = MARKER_COLOURS.find((c) => c.id === s.marker);
  const preview = { x: 14, y: 22, w: 58, h: 52 };

  return (
    <dialog ref={ref} className="settings" aria-labelledby="settings-title" onClose={onClose} onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <div className="dialog-head">
        <h2 id="settings-title">Settings</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close settings">
          <IconClose />
        </button>
      </div>
      <div className="dialog-body">
        <fieldset>
          <legend>Reviewer</legend>
          <div className="srow">
            <label htmlFor="set-author">Your name</label>
            <input id="set-author" type="text" value={s.author} placeholder="Optional, stamped on new comments" onChange={(e) => s.set({ author: e.target.value })} autoComplete="name" />
            <span className="val" />
          </div>
        </fieldset>

        <fieldset>
          <legend>Appearance</legend>
          <div className="srow">
            <span id="lbl-theme">Theme</span>
            <Seg id="lbl-theme" options={THEMES} value={s.theme} onChange={(theme) => s.set({ theme })} />
            <span className="val" />
          </div>
          <Scale id="set-comment" label="Comment text" value={s.commentScale} min={100} max={200} reset={100} onChange={(commentScale) => s.set({ commentScale })} />
          <div className="srow">
            <label htmlFor="set-font">Font</label>
            <select id="set-font" value={s.font} onChange={(e) => s.set({ font: e.target.value as FontChoice })}>
              {FONTS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <span className="val" />
          </div>
          <div className="srow">
            <span id="lbl-frame">Slide frame</span>
            <Seg id="lbl-frame" options={FRAMES} value={s.frame} onChange={(frame) => s.set({ frame })} />
            <span className="val" />
          </div>
          <label className="check">
            <input type="checkbox" checked={s.contrast === 'more'} onChange={(e) => s.set({ contrast: e.target.checked ? 'more' : 'system' })} />
            Increase contrast
          </label>
          <p className="note">Sizes are relative, so browser zoom (Ctrl and +) scales the whole tool; this slider grows the comments only.</p>
        </fieldset>

        <fieldset>
          <legend>Markers on slides</legend>
          <div className="marker-preview" aria-hidden="true">
            <svg className="overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
              <RegionShape rect={preview} />
            </svg>
            <div className="pin-layer">
              <span className="pin mono" style={{ left: `${preview.x}%`, top: `${preview.y}%` }}>
                1
              </span>
            </div>
          </div>
          <div className="srow">
            <span id="lbl-colour">Marker colour</span>
            <div className="swatches" role="group" aria-labelledby="lbl-colour">
              {MARKER_COLOURS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="swatch"
                  style={{ background: c.hex }}
                  aria-label={c.name}
                  aria-pressed={s.marker === c.id}
                  onClick={() => s.set({ marker: c.id })}
                />
              ))}
            </div>
            <span className="val">{colour?.name}</span>
          </div>
          <div className="srow">
            <span id="lbl-style">Style</span>
            <Seg id="lbl-style" options={STYLES} value={s.markerStyle} onChange={(markerStyle) => s.set({ markerStyle })} />
            <span className="val" />
          </div>
          <p className="note">{STYLES.find((st) => st.id === s.markerStyle)?.hint} Exports use the same style and colour.</p>
          <div className="srow">
            <span id="lbl-halo">Outline</span>
            <Seg id="lbl-halo" options={HALO} value={s.halo ? 'on' : 'off'} onChange={(v) => s.set({ halo: v === 'on' })} />
            <span className="val" />
          </div>
          <div className="srow">
            <span id="lbl-stroke">Line weight</span>
            <Seg id="lbl-stroke" options={STROKES} value={s.stroke} onChange={(stroke) => s.set({ stroke })} />
            <span className="val" />
          </div>
          <div className="srow">
            <span id="lbl-badge">Number badges</span>
            <Seg id="lbl-badge" options={BADGES} value={s.badge} onChange={(badge) => s.set({ badge })} />
            <span className="val" />
          </div>
          <label className="check">
            <input type="checkbox" checked={s.pulse} onChange={(e) => s.set({ pulse: e.target.checked })} />
            Pulse the region when its comment is hovered
          </label>
        </fieldset>

      </div>
      <div className="dialog-foot">
        <button type="button" className="btn ghost" onClick={s.reset}>
          Reset all
        </button>
        <button type="button" className="btn primary" onClick={onClose}>
          Done
        </button>
      </div>
    </dialog>
  );
}
