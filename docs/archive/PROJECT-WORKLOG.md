# Project Worklog

## 2026-07-06

### Context

This prototype is the final Next.js workbench direction for the Pengli tumor report Agent. It lives under:

```text
G:\实习\澎立肿瘤报告项目\prototype-agent-workbench
```

The product is an Agent-first report workflow for tumor efficacy reports. The interface should feel like a restrained Codex / Claude Code style workbench, not a marketing page and not a traditional admin dashboard.

### Current Design Direction

- Left sidebar keeps the BioAZ workspace / project / conversation hierarchy.
- Main surface is a conversation-led Agent workspace.
- Right inspector appears from the right edge on hover and can be pinned.
- Main conversation only keeps key information and user decisions.
- Thinking shows business actions, not raw chain-of-thought.
- Technical job ids, function names, digests, traces, and manifests are secondary details.
- Visual style is restrained: white canvas, black primary actions, hairline borders, minimal color, lucide icons.

### Implemented

- Created a standalone Next.js prototype project.
- Added `lucide-react` for high-quality minimal line icons.
- Built the empty upload state.
- Built file upload chips and bottom composer.
- Built validation thinking flow.
- Built warning confirmation cards.
- Built right-edge hover inspector with pin behavior.
- Built artifact cards for Word report and package.
- Added BioAZ logo motion for running thinking state.
- Verified TypeScript with `npm run typecheck`.
- Verified browser render and interactions with Playwright screenshots.

### Product Corrections From Grill-Me Session

- Warning confirmation needs more than "accept":
  - Accept all warnings and continue.
  - Reject / return to re-upload.
  - View validation preview.
- Validation preview should open as a secondary modal with:
  - left navigation
  - right table/detail view
  - recognized results
  - validation issues
  - QA checklist
  - analysis context
- Do not expose full manifest by default; keep only user-readable audit context if needed.
- After warning acceptance, the flow must enter Generation, not directly Module Review.
- Generation creates intermediate artifacts:
  - Word report
  - report package
  - Prism sources
  - figure images
  - QC report
  - audit / manifest summary
- Main conversation should show only Word report and package as core output cards.
- Intermediate artifacts belong in Thinking and right inspector.
- After Generation, expert Agent review starts automatically.
- Expert Agents inspect and produce suggestions, but humans decide.
- Right inspector should not have a close X. It disappears on mouse leave unless pinned.
- Thinking should be labeled `Thinking...`.
- Completed Thinking should collapse into a minimal box showing elapsed time; click to expand.

### Known Implementation Notes

- `next build` previously hit a local Windows / Next package filesystem issue. `next dev` works.
- If the page appears as incomplete HTML, clear the subproject `.next` folder and restart dev server.
- Current reliable dev command:

```powershell
npm --prefix "G:\实习\澎立肿瘤报告项目\prototype-agent-workbench" run dev -- --port 4196
```

### 2026-07-06 Decision List Refinement

- Warning confirmation and expert review were aligned into a shared decision-list pattern.
- Per-row actions are intentionally minimal:
  - warning row: accept this risk + preview icon
  - review row: confirm this module + preview evidence icon
- Task-level actions live at the bottom:
  - warning: accept all and generate / return to replace files
  - review: confirm all / supplement inquiry
- Supplement inquiry writes a draft question into the fixed composer instead of opening another modal.
- Expert names use restrained blue hover previews to show role and finding without making the expert team the main focus.
- Left sidebar was density-tuned from 300px to 284px and compacted while keeping workspace / project / conversation permanently expanded.
