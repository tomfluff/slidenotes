import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { detectScripts } from '@/features/deck/pptx';

const load = (name: string) => new File([readFileSync(`tests/e2e/fixtures/${name}`)], name);

describe('detectScripts', () => {
  it('finds no CJK script in a Latin deck', async () => {
    expect([...(await detectScripts(load('two-slides.pptx')))]).toEqual([]);
  });
  it('finds Japanese from kana', async () => {
    expect([...(await detectScripts(load('japanese.pptx')))]).toEqual(['ja']);
  });
  it('finds Korean and Chinese, using language tags for Han characters', async () => {
    const got = await detectScripts(load('korean-chinese.pptx'));
    expect([...got].sort()).toEqual(['ko', 'zh']);
  });
  it('asks for every font when the file cannot be inspected', async () => {
    const got = await detectScripts(new File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0])], 'old.ppt'));
    expect([...got].sort()).toEqual(['ja', 'ko', 'zh']);
  });
  it('reads chart text and numeric character references too', async () => {
    const zip = new JSZip();
    zip.file('ppt/slides/slide1.xml', '<p:sld><a:t>Revenue</a:t></p:sld>');
    zip.file('ppt/charts/chart1.xml', '<c:chartSpace><a:t>&#x9500;&#21806;</a:t></c:chartSpace>');
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    expect([...(await detectScripts(new File([bytes as BlobPart], 'chart.pptx')))]).toEqual(['zh']);
  });
});
