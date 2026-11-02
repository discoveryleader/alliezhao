# Work Journal

A private work journal for designers, built from the "Designer's Work Journal — Phase 1" design canvas.

Capture what happened in your work, turn hard calls into decision records with evidence, and see how your thinking evolved over a project.

## Run it

No build step and no dependencies. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000. It also works as-is on GitHub Pages.

## What's in it

| Screen | Route |
| --- | --- |
| Home: quick capture, continue writing, recent projects and decisions | `#/` |
| All projects (grid/list, filter, search, archive) | `#/projects` |
| New project / edit details | `#/projects/new`, `#/p/:id/edit` |
| Project overview: context, entries, decisions, evidence, story coverage | `#/p/:id` |
| First entry after creating a project | `#/p/:id/first` |
| Journal entry editor (quick note → structured reflection, evidence, tags) | `#/entry/:id` |
| Decision record (status, options, rationale, evidence, history) | `#/decision/:id` |
| Project timeline (grouped by week, filters, search, milestones) | `#/p/:id/timeline` |
| Search and Settings (backup/restore, reminders, reset) | `#/search`, `#/settings` |

Shortcuts: `⌘/Ctrl J` for a new entry, `⌘/Ctrl K` to search, `⌘/Ctrl ↵` to save.

## Data

Everything is stored in your browser's `localStorage`. Nothing is sent anywhere. The first visit loads sample projects from the design. Use **Settings** to download a JSON backup, restore one, export Markdown, or start empty. Screenshots are resized before they're saved, but browser storage is limited (about 5 MB), so keep backups.

## Files

- `index.html`: entry point
- `assets/styles.css`: design tokens and components
- `assets/store.js`: data model, sample data, persistence
- `assets/app.js`: router, screens and interactions
