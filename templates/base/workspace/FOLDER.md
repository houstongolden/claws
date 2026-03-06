# FOLDER.md

> The folder contract for this workspace. Read before any file operation.

## Root Layout

./
├── FOLDER.md
├── PROJECT.md
├── tasks.md
├── prompt/
├── identity/
├── notes/
├── areas/
├── projects/
├── clients/
├── content/
├── fitness/
├── drafts/
├── final/
├── assets/
├── skills/
└── agents/

## Rules

- Only write inside approved top-level directories.
- Do not create new top-level folders unless explicitly requested.
- Use lowercase-kebab-case for new names.
- `drafts/` is editable scratch space.
- `final/` requires explicit finalize intent.
- `prompt/` is read-only unless user-approved.
- `identity/` is read-mostly; prefer append-only updates.
- `notes/` is append-only unless cleanup is requested.
- Never write secrets into workspace markdown files.
