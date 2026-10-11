// Oops Academy: pulls real snippets out of the game's source files (between `// #region name` and
// `// #endregion name` markers) and colours them. Because the snippets come from the real files at build time,
// they can never go out of date.

const SOURCES = import.meta.glob(['../sim/*.ts', '../game/**/*.ts', '../../tests/bot.ts'], {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;

/** Short file name → source text. e.g. 'sim/world.ts' */
const FILES = new Map<string, string>();
for (const [path, text] of Object.entries(SOURCES)) FILES.set(path.replace(/^(\.\.\/)+/, ''), text);

export function sourceOf(file: string): string {
  const s = FILES.get(file);
  if (!s) throw new Error(`Academy: unknown source file ${file}`);
  return s;
}

/** The lines between the region markers, with the shared indentation removed. Also returns the start line number. */
export function region(file: string, name: string): { code: string; line: number } {
  const lines = sourceOf(file).split('\n');
  const start = lines.findIndex(l => l.trim() === `// #region ${name}`);
  if (start < 0) throw new Error(`Academy: no region "${name}" in ${file}`);
  let end = lines.findIndex((l, i) => i > start && (l.trim() === `// #endregion ${name}` || l.trim() === '// #endregion'));
  if (end < 0) end = lines.length;
  const body = lines.slice(start + 1, end);
  const indent = Math.min(...body.filter(l => l.trim()).map(l => l.match(/^ */)![0].length));
  return { code: body.map(l => l.slice(indent)).join('\n'), line: start + 2 };
}

const KEYWORDS = new Set([
  'const', 'let', 'var', 'if', 'else', 'for', 'while', 'return', 'function', 'class', 'private', 'readonly', 'this',
  'new', 'true', 'false', 'null', 'undefined', 'of', 'in', 'switch', 'case', 'break', 'continue', 'export', 'import',
  'interface', 'type', 'from', 'as', 'void', 'number', 'boolean', 'string',
]);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A tiny syntax highlighter: comments, strings, numbers, keywords. Good enough for teaching snippets. */
export function highlight(code: string): string {
  let out = '', i = 0;
  while (i < code.length) {
    const c = code[i], rest = code.slice(i);
    let m: RegExpMatchArray | null;
    if (rest.startsWith('//')) {
      const e = code.indexOf('\n', i);
      const j = e < 0 ? code.length : e;
      out += `<span class="c">${esc(code.slice(i, j))}</span>`;
      i = j;
    } else if (rest.startsWith('/*')) {
      const e = code.indexOf('*/', i + 2);
      const j = e < 0 ? code.length : e + 2;
      out += `<span class="c">${esc(code.slice(i, j))}</span>`;
      i = j;
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < code.length && code[j] !== c) j += code[j] === '\\' ? 2 : 1;
      out += `<span class="s">${esc(code.slice(i, j + 1))}</span>`;
      i = j + 1;
    } else if ((m = rest.match(/^\d+(\.\d+)?(e-?\d+)?/)) && !/[\w$]/.test(code[i - 1] ?? '')) {
      out += `<span class="n">${m[0]}</span>`;
      i += m[0].length;
    } else if ((m = rest.match(/^[A-Za-z_$][\w$]*/))) {
      const w = m[0];
      out += KEYWORDS.has(w) ? `<span class="k">${w}</span>` : /^[A-Z]/.test(w) ? `<span class="t">${w}</span>` : w;
      i += w.length;
    } else {
      out += esc(c);
      i++;
    }
  }
  return out;
}

/** HTML for a code block with line numbers starting at `line`. */
export function codeBlock(code: string, file?: string, line = 1): string {
  const rows = highlight(code).split('\n').map((l, k) => `<span class="ln">${line + k}</span>${l || ' '}`).join('\n');
  return `<figure class="code">${file ? `<figcaption>📄 ${file}${line > 1 ? ` (line ${line})` : ''}</figcaption>` : ''}<pre>${rows}</pre></figure>`;
}
