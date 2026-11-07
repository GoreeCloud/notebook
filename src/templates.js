// Bundled, opt-in starter documents. Templates are never loaded from a server,
// automatically installed into a workspace, or mixed with user-owned note data.
import { makeNote, MAX_BODY_LENGTH } from "./model.js";

export const BUILTIN_TEMPLATES = Object.freeze([
  Object.freeze({
    id: "project-plan", icon: "▣", title: "Project plan",
    description: "Define your goal, scope, milestones, and next actions.",
    type: "note", tags: Object.freeze(["project", "planning"]),
    body: "## Overview\n[What are you creating, and why?]\n\n## Goals\n- [ ] Define scope and success criteria\n- [ ] Identify the first deliverable\n\n## Milestones\n- Planning — [dates]\n- Development — [dates]\n- Review — [dates]\n\n## Next steps\n- [ ] [First action]\n\n## Notes and ideas\n- [Additional context]"
  }),
  Object.freeze({
    id: "meeting", icon: "▤", title: "Meeting notes",
    description: "Capture an agenda, decisions, and action items.",
    type: "meeting", tags: Object.freeze(["meeting"]),
    body: "## Purpose\n[What is this meeting for?]\n\n## Participants\n- [Names]\n\n## Agenda\n- [Topic]\n\n## Decisions\n- [Decision and rationale]\n\n## Action items\n- [ ] [Owner] — [Action] — [Due date]\n\n## Follow-up\n[Next check-in]"
  }),
  Object.freeze({
    id: "journal", icon: "◷", title: "Daily journal",
    description: "Reflect privately and keep meaningful moments together.",
    type: "journal", tags: Object.freeze(["journal"]),
    body: "## Today\n[What stood out?]\n\n## Gratitude\n- [Something worth remembering]\n\n## What I learned\n[Reflections]\n\n## Tomorrow\n- [ ] [One small next step]"
  }),
  Object.freeze({
    id: "reading", icon: "▥", title: "Reading notes",
    description: "Collect key ideas, references, and your own reflections.",
    type: "research", tags: Object.freeze(["reading"]),
    body: "## Source\nTitle: [Book or article]\nAuthor: [Author]\nLink: [Optional URL]\n\n## Main ideas\n- [Key insight]\n\n## Notes\n> [Quote or reflection]\n\n## Questions\n- [What to explore next?]\n\n## Next actions\n- [ ] [Optional follow-up]"
  })
]);

export function createNoteFromTemplate(templateId, newId) {
  const template = BUILTIN_TEMPLATES.find(item => item.id === templateId);
  if (!template) throw new RangeError("Unknown Notebook template");
  if (template.body.length > MAX_BODY_LENGTH) throw new RangeError("Template body exceeds note limit");
  const note = makeNote({ id: newId, title: template.title, type: template.type });
  note.body = template.body;
  note.tags = [...template.tags];
  return note;
}
