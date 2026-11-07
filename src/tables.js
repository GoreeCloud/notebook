// Small, bounded, dependency-free Markdown table renderer.
// Only simple pipe-bounded rows are supported. All cell content is escaped.
import { escapeHtml } from "./model.js";
const MAX_COLS = 8;
const MAX_ROWS = 64;

function cellsOf(line) {
  if (typeof line !== "string") return null;
  const value = line.trim();
  if (!value.startsWith("|") || !value.endsWith("|")) return null;
  const fields = value.slice(1, -1).split("|").map(cell => cell.trim());
  return fields.length >= 2 && fields.length <= MAX_COLS ? fields : null;
}

/** Return {html, endIndex} for an actual Markdown table or null.
 * endIndex includes the divider row. Input is never mutated. */
export function parseMarkdownTable(lines, startIndex) {
  if (!Array.isArray(lines) || !Number.isSafeInteger(startIndex) || startIndex < 0) {
    throw new TypeError("Invalid Markdown table source");
  }
  if (startIndex + 1 >= lines.length) return null;
  const columns = cellsOf(lines[startIndex]);
  const separator = cellsOf(lines[startIndex + 1]);
  if (!columns || !separator || columns.length !== separator.length ||
      !separator.every(part => /^:?-{3,}:?$/.test(part))) return null;
  const rows = [];
  let next = startIndex + 2;
  while (next < lines.length && rows.length < MAX_ROWS) {
    const row = cellsOf(lines[next]);
    if (!row || row.length !== columns.length) break;
    rows.push(row);
    next++;
  }
  const th = columns.map(cell => '<th scope="col">' + escapeHtml(cell) + "</th>").join("");
  const body = rows.map(row =>
    "<tr>" + row.map(cell => "<td>" + escapeHtml(cell) + "</td>").join("") + "</tr>"
  ).join("");
  return {
    html: '<div class="preview-table-scroll" role="region" aria-label="Note table" tabindex="0">' +
      '<table class="preview-table"><thead><tr>' + th + "</tr></thead><tbody>" + body +
      "</tbody></table></div>",
    endIndex: next - 1
  };
}
