import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
  ...p,
});

export const IconCaret = (p: P) => (
  <svg {...base(p)}><path d="M5 8l5 5 5-5" /></svg>
);
export const IconSheet = (p: P) => (
  <svg {...base(p)}><rect x="3" y="3" width="14" height="14" rx="2" /><path d="M6.5 7.5h7M6.5 10.5h7M6.5 13.5h4" /></svg>
);
export const IconBack = (p: P) => (
  <svg {...base(p)}><path d="M12 4l-6 6 6 6" /></svg>
);
export const IconZoomIn = (p: P) => (
  <svg {...base(p)}><circle cx="9" cy="9" r="5.5" /><path d="M13.5 13.5L17 17M9 6.5v5M6.5 9h5" /></svg>
);
export const IconZoomOut = (p: P) => (
  <svg {...base(p)}><circle cx="9" cy="9" r="5.5" /><path d="M13.5 13.5L17 17M6.5 9h5" /></svg>
);
export const IconTrash = (p: P) => (
  <svg {...base(p)}><path d="M4 6h12M8 6V4.5a1 1 0 011-1h2a1 1 0 011 1V6m-7 0l.6 9.4A1.5 1.5 0 007.1 17h5.8a1.5 1.5 0 001.5-1.6L15 6" /></svg>
);
export const IconEdit = (p: P) => (
  <svg {...base(p)}><path d="M4 16h3.5L16 7.5a1.8 1.8 0 00-2.5-2.5L5 13.5V16z" /><path d="M12 6.5l2.5 2.5" /></svg>
);
export const IconCheck = (p: P) => (
  <svg {...base(p)}><path d="M4 10.5l4 4 8-8" /></svg>
);
export const IconUndo = (p: P) => (
  <svg {...base(p)}><path d="M7 5L3.5 8.5 7 12" /><path d="M3.5 8.5H12a4 4 0 010 8H9" /></svg>
);
export const IconSettings = (p: P) => (
  <svg {...base(p)}>
    <circle cx="10" cy="10" r="2.4" />
    <path d="M8.6 2.5h2.8l.4 2.1a5.7 5.7 0 0 1 1.5.9l2-.7 1.4 2.4-1.6 1.4a5.8 5.8 0 0 1 0 1.8l1.6 1.4-1.4 2.4-2-.7a5.7 5.7 0 0 1-1.5.9l-.4 2.1H8.6l-.4-2.1a5.7 5.7 0 0 1-1.5-.9l-2 .7-1.4-2.4 1.6-1.4a5.8 5.8 0 0 1 0-1.8L3.3 7.2l1.4-2.4 2 .7a5.7 5.7 0 0 1 1.5-.9z" />
  </svg>
);
export const IconHelp = (p: P) => (
  <svg {...base(p)}><circle cx="10" cy="10" r="7.2" /><path d="M7.8 8a2.2 2.2 0 1 1 3.1 2c-.7.4-.9.8-.9 1.5" /><circle cx="10" cy="14.2" r=".5" fill="currentColor" /></svg>
);
export const IconSave = (p: P) => (
  <svg {...base(p)}><path d="M10 3v9m0 0l-3.5-3.5M10 12l3.5-3.5" /><path d="M4 14v2a1 1 0 001 1h10a1 1 0 001-1v-2" /></svg>
);
export const IconUpload = (p: P) => (
  <svg {...base(p)}><path d="M10 13V4m0 0L6.5 7.5M10 4l3.5 3.5" /><path d="M4 14v2a1 1 0 001 1h10a1 1 0 001-1v-2" /></svg>
);
export const IconFolder = (p: P) => (
  <svg {...base(p)}><path d="M3 6a1 1 0 011-1h4l2 2h6a1 1 0 011 1v7a1 1 0 01-1 1H4a1 1 0 01-1-1V6z" /></svg>
);
export const IconPlus = (p: P) => (
  <svg {...base(p)}><path d="M10 4v12M4 10h12" /></svg>
);
export const IconRegion = (p: P) => (
  <svg {...base(p)}><rect x="4" y="4" width="12" height="12" rx="1.5" strokeDasharray="2.5 1.8" /></svg>
);
export const IconShield = (p: P) => (
  <svg {...base(p)}><path d="M10 2.5l6 2.2v4.6c0 3.6-2.6 6.4-6 7.9-3.4-1.5-6-4.3-6-7.9V4.7l6-2.2z" /><path d="M7.5 10l1.8 1.8L12.8 8.3" /></svg>
);
export const IconClose = (p: P) => (
  <svg {...base(p)}><path d="M5 5l10 10M15 5L5 15" /></svg>
);
export const IconPrint = (p: P) => (
  <svg {...base(p)}><path d="M6 7V3.5h8V7" /><rect x="3" y="7" width="14" height="7" rx="1.5" /><path d="M6 12h8v4.5H6z" /></svg>
);
export const IconDoc = (p: P) => (
  <svg {...base(p)}><path d="M5 3h6.5L15 6.5V17H5z" /><path d="M11.5 3v3.5H15" /></svg>
);
export const IconBrand = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...p}>
    <rect x="2" y="4" width="20" height="16" rx="3" fill="var(--accent)" />
    <rect x="6" y="8" width="8" height="5" rx="1" fill="none" stroke="var(--accent-ink)" strokeWidth="1.6" />
    <circle cx="16.5" cy="14.5" r="2.6" fill="var(--accent-ink)" />
  </svg>
);
