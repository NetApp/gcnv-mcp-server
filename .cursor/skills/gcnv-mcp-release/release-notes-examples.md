# Release notes examples (gcnv-mcp-server)

Copied from past GitHub releases. Prefer the **v1.2.0** style for patch releases.

## v1.2.0 (patch/minor — preferred for small releases)

```markdown
## What's Changed

- Expanded setup documentation for Cursor, Claude Code, Codex CLI, Gemini CLI, and Antigravity/AGY clients.
- Added per-request Google access token support for HTTP/SSE transports, including configurable auth header support with `GCNV_AUTH_HEADER`.
- Added optional ONTAP Knowledge Graph discovery integration via `ONTAP_KG_URL`, with fallback to the bundled ONTAP API index.
- Removed delete tools for GCNV and ONTAP resources.
```

## v1.2.1 draft (template for schema-validation patch)

```markdown
## What's Changed

- Fixed MCP output schema validation for backup, replication, snapshot, storage pool, and quota rule tools so structured responses match declared Zod schemas.
- Hardened protobuf timestamp formatting to reject missing or invalid `seconds` values instead of emitting Unix epoch timestamps.
- Scoped npm audit override for `brace-expansion` to the `glob → minimatch` dependency chain only.
```

## v1.1.0 (minor with highlights)

```markdown
## v1.1.0 - ONTAP Mode Support

This release adds ONTAP Expert Mode support for Google Cloud NetApp Volumes MCP Server.

### Highlights

- Added support for creating FLEX Unified storage pools with `mode: ONTAP`.
- Added ONTAP Expert Mode tools for supported ONTAP REST operations through the GCNV control plane.
- Added `ontap_discover` to search bundled ONTAP REST endpoints before execution.
- Added `ontap_execute` for discovered ONTAP REST API calls.
```

## v1.0.2 (feature-heavy minor)

Uses `## Overview` paragraph, then `## New Features` with `###` subsections and **Tools:** lines naming affected MCP tools.

## v1.0.1 / v1.0.0

v1.0.1 was one line. v1.0.0 used a full first-release overview with `## What's included` tool categories.
