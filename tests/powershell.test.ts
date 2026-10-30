import { describe, it, expect } from 'vitest';
import { escapePowerShell } from '../src/modules/powershell.js';

describe('escapePowerShell', () => {
  it('should double ASCII single quotes', () => {
    expect(escapePowerShell("it's")).toBe("it''s");
  });

  // PowerShell treats these as single quotes too; unescaped they end the string literal
  it.each(['‘', '’', '‚', '‛'])('should double the quote variant %s', (q) => {
    expect(escapePowerShell(`Viktor${q}s`)).toBe(`Viktor${q}${q}s`);
  });

  it('should leave other text untouched', () => {
    expect(escapePowerShell('Fällige Tätigkeiten "x"')).toBe('Fällige Tätigkeiten "x"');
  });
});
