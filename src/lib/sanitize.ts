export const MAX_NAME = 14;
export const MAX_MESSAGE = 120;

/**
 * Names and messages arrive from other people's phones, so they are treated as
 * untrusted input: control characters stripped, whitespace collapsed, length
 * capped. Rendering always goes through React's text escaping, never HTML.
 */
function clean(input: unknown, maxLength: number): string {
  if (typeof input !== 'string') return '';
  return Array.from(input)
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      // Drop C0/C1 control ranges and the bidi/zero-width block used for spoofing.
      if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return false;
      if (code >= 0x200b && code <= 0x200f) return false;
      if (code >= 0x202a && code <= 0x202e) return false;
      return true;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export const cleanName = (input: unknown): string => clean(input, MAX_NAME);
export const cleanMessage = (input: unknown): string => clean(input, MAX_MESSAGE);

export const initials = (name: string): string => {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
};
