/**
 * PowerShell helpers shared by the Windows implementations.
 */

/** PowerShell flags for safe, non-interactive execution */
export const PS_FLAGS = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command'];

/**
 * Script preamble that switches stdout to UTF-8 (without BOM).
 * Windows PowerShell 5.1 otherwise writes in the OEM console codepage (e.g. 850),
 * which Node decodes as UTF-8 and turns umlauts into U+FFFD.
 */
export const PS_UTF8_OUTPUT = '[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false\n';

/**
 * Escape a string for use inside PowerShell single-quoted strings.
 * PowerShell also accepts the typographic quotes U+2018..U+201B as single quotes,
 * so a title like "Viktor’s" would otherwise end the literal and inject code.
 */
export function escapePowerShell(str: string): string {
  return str.replace(/['‘’‚‛]/g, (q) => q + q);
}
