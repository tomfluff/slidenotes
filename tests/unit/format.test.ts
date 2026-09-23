import { describe, expect, it } from 'vitest';
import { escapeHtml, fileStem } from '@/lib/format';

describe('format', () => {
  it('makes safe file stems, keeping non-Latin letters', () => {
    expect(fileStem('ASSETS 2026: Final!')).toBe('assets-2026-final');
    expect(fileStem('発表スライド v2')).toBe('発表スライド-v2');
    expect(fileStem('!!!')).toBe('slide-review');
  });
  it('escapes html', () => {
    expect(escapeHtml('<a href="x">&\'</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  });
});
