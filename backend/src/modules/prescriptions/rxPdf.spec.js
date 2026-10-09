'use strict';

const { wrap } = require('./rxPdf');

describe('Rezept-PDF: Zeilenumbruch', () => {
  test('bricht an Wortgrenzen, respektiert Absätze und zerlegt überlange Wörter', () => {
    expect(wrap('eins zwei drei vier', 9)).toEqual(['eins zwei', 'drei vier']);
    expect(wrap('a\nb', 10)).toEqual(['a', 'b']);
    expect(wrap('x'.repeat(25), 10)).toEqual(['x'.repeat(10), 'x'.repeat(10), 'xxxxx']);
    expect(wrap('kurz', 10)).toEqual(['kurz']);
    for (const l of wrap('Lorem ipsum dolor sit amet consectetur adipiscing elit sed do', 20)) expect(l.length).toBeLessThanOrEqual(20);
  });
});
