// Pure, local Markdown editing operations. No HTML execution or remote services.
// All commands act on the selection in the existing textarea, not an external editor.
import { MAX_BODY_LENGTH } from "./model.js";
const markers = {
  bold: ["**", "**", "bold text"],
  italic: ["*", "*", "italic text"],
  code: ["`", "`", "code"]
};
const prefixes = { heading: "## ", bullet: "- ", checklist: "- [ ] ", quote: "> " };
export function formatMarkdownSelection(source, start, end, command) {
  if (typeof source !== "string" ||
      !Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
      start < 0 || end < start || end > source.length) throw new TypeError("Invalid text selection");
  if (command !== "table" && !Object.hasOwn(markers, command) && !Object.hasOwn(prefixes, command)) {
    throw new TypeError("Unknown formatting command");
  }
  let before, replacement, after, rangeStart, rangeEnd;
  if (command === "table") {
    // Append a starter table at the selection's end, preserving any selected text.
    // This avoids destructive replacement of existing content when inserting a block.
    const at = end;
    before = source.slice(0, at);
    after = source.slice(at);
    const prefix = before && !before.endsWith("\n") ? "\n\n" : "";
    const suffix = after && !after.startsWith("\n") ? "\n\n" : "";
    const table = "| Phase | Status | Timeline |\n| --- | --- | --- |\n| Planning | Not started | [Dates] |";
    replacement = prefix + table + suffix;
    rangeStart = at + prefix.length + 2;
    rangeEnd = rangeStart + "Phase".length;
  } else if (Object.hasOwn(markers, command)) {
    const [open, close, placeholder] = markers[command];
    const selected = source.slice(start, end);
    // Highlight a meaningful placeholder if nothing was selected.
    const text = selected || placeholder;
    before = source.slice(0, start);
    replacement = open + text + close;
    after = source.slice(end);
    rangeStart = start + open.length;
    rangeEnd = rangeStart + text.length;
  } else {
    const prefix = prefixes[command];
    const lineStart = start === 0 ? 0 : source.lastIndexOf("\n", start - 1) + 1;
    // Exclude an additional line when selection ends exactly at its beginning.
    const selectionEnd = end > start && source[end - 1] === "\n" ? end - 1 : end;
    const following = source.indexOf("\n", selectionEnd);
    const lineEnd = following === -1 ? source.length : following;
    const segment = source.slice(lineStart, lineEnd);
    const lines = segment.split("\n");
    const firstPrefix = command === "heading" ? prefix : null;
    replacement = lines.map((line, i) => {
      if (firstPrefix && i > 0) return line;
      if (line.startsWith(prefix)) return line;
      return prefix + line;
    }).join("\n");
    before = source.slice(0, lineStart);
    after = source.slice(lineEnd);
    rangeStart = lineStart + (replacement.startsWith(prefix) ? prefix.length : 0);
    rangeEnd = source.length === 0 || start === end ? rangeStart : lineStart + replacement.length;
  }
  const value = before + replacement + after;
  if (value.length > MAX_BODY_LENGTH) throw new RangeError("Formatted note would exceed the local note size limit");
  return { value, start: rangeStart, end: rangeEnd };
}

/** Toggle exactly one Markdown checklist line; no mutations or broad text rewrites. */
export function toggleMarkdownChecklist(source, lineIndex, checked) {
  if (typeof source !== "string" || !Number.isSafeInteger(lineIndex) ||
      lineIndex < 0 || typeof checked !== "boolean") throw new TypeError("Invalid checklist update");
  const lines = source.split("\n");
  if (lineIndex >= lines.length || !/^- \[([ xX])\] /.test(lines[lineIndex])) {
    throw new RangeError("Checklist item was not found");
  }
  lines[lineIndex] = lines[lineIndex].replace(/^- \[([ xX])\] /, checked ? "- [x] " : "- [ ] ");
  return lines.join("\n");
}
