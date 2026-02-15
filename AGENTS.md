# AGENTS.md

## Do

- use shadcn with baseUI for React UI components and frontend
- use Zustand package for global app state management
- use Tailwind for styling
- default to small components
- always use bun package manager to check or install dependencies
- always check Context7 MCP for up-to-date knowledge about libraries and packages used in this project

## Don't

- do not hard code colors
- do not use divs if we have a component already
- do not add new heavy dependencies without approval

## Commands

### file scoped checks preferred

bunx tsc --noEmit
bunx prettier --write path/to/file.tsx
bunx eslint --fix path/to/file.tsx

### full build when explicitly requested

bun tauri build

### to run a dev server with vite and bun

bun tauri dev

## Safety and permissions

Allowed without prompt:

- read files, list files
- tsc single file, prettier, eslint,
- vitest single test
- creating a folder for components, pages, fragments inside ./src

Ask first:

- package installs,
- git push
- deleting files, chmod
- running full build or end to end suites

## Project structure

- ./src contains all UI and application source code of the project
- ./src-tauri source of Tauri backend for desktop application (use @hypothesi/tauri-mcp-server for details on how to use this directory)
- ./src-python source of python sidecar with FastAPI for the application
- ./src/components/ui should contain all shadcn + baseUI components
- ./src/components should contain higher level components, widgets or mini-apps that are composed of basic components from shadcn + baseUI
- ./src/pages should contain React router pages for this single-page application
- ./src/lib should contain any reusable helper functions

## Good and bad examples

- avoid class based components like `Admin.tsx`
- use functional components with hooks like `Projects.tsx`

## When stuck

- ask a clarifying question, propose a short plan, or open a draft PR with notes

## Design system

- use shadcn with baseUI for any frontend component
- use tailwind to change component styles only if required styles are not provided by default
