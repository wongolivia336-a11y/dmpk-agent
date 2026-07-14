# DMPK Quotation Agent Prototype

Clickable Next.js prototype for a DMPK quotation agent workspace.

This prototype adapts the approved tumor report workbench visual system to a quotation flow:

```text
Recognize DMPK / assay type
-> Collect missing quotation parameters
-> Validate pricing-critical fields
-> Preview and confirm parameters
-> Generate Word quotation and Excel detail files
-> Verify page / Word / Excel amount consistency
```

## Key UX Decisions

- Left sidebar follows the tumor report workspace pattern: project groups with multiple chats.
- Center conversation remains the primary workflow surface.
- Missing fields are collected through warning-style task cards, grouped by business stage.
- Selected values are written to composer parameter tabs first; the right panel updates only after the user sends.
- Right panel is always visible and preserves the beta parameter form as the submitted parameter ledger.
- After generation, the right panel can switch to artifacts / versions.
- Final confirmation happens in the main conversation, with a detailed modal preview before generation.
- Activity chains are retained for both lightweight parameter updates and full quotation generation.

## Main Files

- `app/page.tsx`
  Renders the DMPK quotation prototype.

- `components/DmpkQuotationWorkbench.tsx`
  Main prototype screen and local mock interaction state.

- `app/globals.css`
  Reuses the tumor report visual system and adds DMPK-specific layout styles.

## Run

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Validation Note

Dependency install was not run during this handoff because the workspace rules prohibit running dependency installs from `G:\实习` without explicit user approval.
