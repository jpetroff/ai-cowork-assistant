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

## Commands

- Use `bun` as node environment and `bunx` to run commands: `bunx tsc --noEmit`, `bunx prettier --write path/to/file.tsx`, `bunx eslint --fix path/to/file.tsx` and etc
- DO NOT use npm
- Use `uv` as python package manager and run commands with `uvx`
- DO NOT use `pip`

## Project structure

Refer to ./openspec/specs/project/spec.md for detailed project specifications

## MCPs

- Prefer serena MCP for advenced code search: it uses language server for searching symbols and imports when doing refactoring work.
- Use Context7 MCP to get latest up-to-date documentation about framework and libraries

## Good and bad examples

- avoid class based components like `Admin.tsx`
- use functional components with hooks like `Projects.tsx`

## Design system

- use shadcn with baseUI for any frontend component
- use tailwind to change component styles only if required styles are not provided by default
