# AGENTS.md

## Do

- use shadcn with baseUI for React UI components and frontend
- use Tailwind for styling
- default to small components
- always use bun package manager to check or install dependencies
- always check Context7 MCP for up-to-date knowledge about libraries and packages used in this project
- use minimal JSDoc for type declarations (@property tags only), comprehensive JSDoc for store/method implementations inside create()

## Don't

- do not hard code colors
- do not use divs if we have a component already
- do not add new heavy dependencies without approval
- do not introduce new migrations to tauri SQLite database, always keep one SQL migration in development;
  - if you need to modify SQL schema, do that and ask if database was deleted in chat so that it initializes again with new schema

## Commands

- Use `bun` as node environment and `bunx` to run commands: `bunx tsc --noEmit`, `bunx prettier --write path/to/file.tsx`, `bunx eslint --fix path/to/file.tsx` and etc
- DO NOT use npm
- Use `uv` as python package manager and run commands with `uvx`
- DO NOT use `pip`

## MCPs

- **Always use Serena MCP first** for any code exploration, search, or refactoring — do not default to grep/glob/read when Serena tools can answer the question more precisely.
  - Use `get_symbols_overview` to understand a file's structure before reading it
  - Use `find_symbol` with `include_body=true` to read a specific function/class without loading the whole file
  - Use `find_referencing_symbols` to find all callers/usages of a symbol (more accurate than text search)
  - Use `replace_symbol_body` / `rename_symbol` for safe, LSP-aware edits and renames
- Use Context7 MCP to get latest up-to-date documentation about framework and libraries

## Good and bad examples

- avoid class based components like `Admin.tsx`
- use functional components with hooks like `Projects.tsx`

## Design system

- use shadcn with baseUI for any frontend component
- use tailwind to change component styles only if required styles are not provided by default
