# Change Manual

## Entry Points

- Page: `app/page.tsx`
- Global styles: `app/globals.css`
- Layout: `app/layout.tsx`
- Logo assets: `public/logo`

## Workflow State Model

Recommended product flow:

```text
empty
  -> uploaded
  -> validating
  -> warning
  -> generating
  -> review
  -> exported
```

Rules:

- `empty`: no files uploaded.
- `uploaded`: DOCX/XLSX uploaded, user can start validation or replace files.
- `validating`: Agent Thinking runs validation actions.
- `warning`: validation finished with warning issues; user must decide.
- `generating`: warnings accepted, Agent Thinking runs generation actions.
- `review`: generation completed, Word/package visible, expert review starts automatically.
- `exported`: core delivery artifacts are ready.

## Conversation Rules

- Main conversation leads the workflow.
- Keep main messages short and decision-oriented.
- Do not show long artifact lists in the main conversation.
- Do not show raw tool calls by default.
- Do not expose full manifest by default.
- Do not claim Agent review equals human approval.
- Do not call warning acceptance a scientific conclusion signature.

## Thinking Rules

- Header label: `Thinking...`
- Running state shows animated BioAZ logo.
- Completed state shows a compact summary with elapsed time.
- Click completed Thinking to expand business action steps.
- Technical details are second-level disclosure.

## Warning Decision Rules

Warning UI should offer:

- per-row: accept this risk
- per-row: preview icon for validation preview
- bottom action: accept all and generate
- bottom action: return to replace files

Rejecting warning should not open a new window. It returns the current task to the uploaded-file state so the user can remove or replace files in the existing workspace.

## Expert Review Decision Rules

Expert review should mirror the warning decision pattern.

Per-row actions:

- confirm this module
- preview evidence icon

Bottom actions:

- confirm all
- supplement inquiry

Do not expose "request recompute" or "return modification" as first-level actions until the real backend workflow exists. Use supplement inquiry as the lightweight bridge for questions, evidence requests, and unclear objections.

Expert names may be shown in blue with a hover preview containing:

- role
- responsibility scope
- final finding summary

The expert team is a decision source, not the protagonist of the workflow.

## Validation Preview Rules

Use a modal with:

- left section navigation
- right table / detail surface

Default sections:

- recognized results
- validation issues
- QA checklist
- analysis context

Avoid full manifest display unless a later role-based technical view is added.

## Generation Artifact Rules

Main conversation should show:

- Word report
- report package

Right inspector may show grouped artifact categories:

- Prism sources, 4 files
- Figure images, 5 files
- QC report
- audit / manifest summary

Detailed filenames may be shown after expansion, not as first-level main conversation content.

## Right Inspector Rules

- Appears on right-edge hover.
- Can be pinned.
- No close X.
- If unpinned, mouse leave hides it.
- If pinned, clicking pin again unpins it.
- Pinning may shrink the main conversation.

## Visual Rules

- White canvas.
- Hairline borders.
- Black primary buttons.
- Low-saturation status color only.
- Use lucide-react icons.
- Avoid decorative gradients, excessive shadows, colorful tags, marketing hero layouts, and chat bubble clutter.
