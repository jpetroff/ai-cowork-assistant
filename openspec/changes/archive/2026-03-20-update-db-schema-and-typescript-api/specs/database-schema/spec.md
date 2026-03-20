## ADDED Requirements

### Requirement: Prisma schema acts as TypeScript-side peer to the Rust migration
The system SHALL maintain `prisma/schema.prisma` as the TypeScript-side peer definition of the schema defined in `src-tauri/src/db.rs`. A comment header in each file SHALL reference the other file as the peer definition, establishing a documented parity contract.

#### Scenario: Cross-reference comments present
- **WHEN** a developer opens `prisma/schema.prisma`
- **THEN** a comment at the top references `src-tauri/src/db.rs` as the Rust peer

#### Scenario: Cross-reference comments present in Rust
- **WHEN** a developer opens `src-tauri/src/db.rs`
- **THEN** a comment references `prisma/schema.prisma` as the TypeScript peer

### Requirement: prisma generate is integrated into the build workflow
The system SHALL invoke `prisma generate` as part of the frontend build and dev scripts so that TypeScript types are always up to date before compilation.

#### Scenario: Types generated on dev start
- **WHEN** the developer runs `npm run dev` (or equivalent)
- **THEN** `prisma generate` runs and produces updated types before Vite starts

#### Scenario: Types generated on production build
- **WHEN** `npm run build` is executed
- **THEN** `prisma generate` runs before TypeScript compilation
