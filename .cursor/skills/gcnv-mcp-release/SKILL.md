---
name: gcnv-mcp-release
description: >-
  Release gcnv-mcp-server to npm via GitHub releases. Covers version bump draft
  PRs, release notes from past GitHub format, pre-release MCP/Gemini testing,
  publishing workflow, and post-release verification. Use when the user asks to
  release, bump version, publish to npm, or cut a gcnv-mcp-server tag.
---

# gcnv-mcp-server Release

End-to-end release for [NetApp/gcnv-mcp-server](https://github.com/NetApp/gcnv-mcp-server).

**Hard rule:** Never commit or push directly to `main`. Always use draft PRs.

## Quick checklist

```
- [ ] Decide version (semver; patch for fixes, minor for features)
- [ ] Draft PR: bump package.json + package-lock.json version
- [ ] CI green on PR; get review if required
- [ ] Merge version-bump PR to main
- [ ] Draft release notes (see template below)
- [ ] Create GitHub release (tag vX.Y.Z, publish — triggers npm)
- [ ] Verify npm + GitHub Actions publish job
```

## How publishing works

- Workflow: `.github/workflows/release-publish.yml`
- Trigger: GitHub **Release published** (not draft → published)
- Action: checks out the release tag, runs `npm publish --access public --provenance`
- **Tag must match version:** tag `v1.2.1` ↔ `"version": "1.2.1"` in `package.json` on that tag

## Step 1 — Gather changes since last release

```bash
gh release view --repo NetApp/gcnv-mcp-server  # latest tag
gh pr list --repo NetApp/gcnv-mcp-server --state merged --base main --limit 20
gh log vPREVIOUS..origin/main --oneline
```

Summarize **user-facing** changes only (tools, config, docs, breaking removals).

## Step 2 — Version bump (draft PR)

Branch from latest `origin/main`:

```bash
git fetch origin main
git checkout -b release/X.Y.Z origin/main
npm version X.Y.Z --no-git-tag-version
npm run build && npm test
git add package.json package-lock.json
git commit -m "chore: bump version to X.Y.Z"
git push -u origin release/X.Y.Z
gh pr create --draft --base main --title "chore: release X.Y.Z" --body "$(cat <<'EOF'
## Summary
- Bump version to X.Y.Z for npm release

## Test plan
- [ ] CI passes (lint, build, tests, security audit)
- [ ] Version in package.json matches intended tag vX.Y.Z

EOF
)"
```

Mark PR ready for review when CI is green; merge after approval.

## Step 3 — Release notes

Match recent patch/minor style: `## What's Changed` + bullet list (see [release-notes-examples.md](release-notes-examples.md)).

**Patch (x.y.Z):** short bullets, no long overview sections.

**Minor (x.Y.0):** optional title line + Highlights subsection (v1.1.0 style).

Draft notes in the PR body or paste into GitHub when creating the release.

## Step 4 — Create GitHub release

After the version-bump PR merges to `main`:

```bash
gh release create vX.Y.Z \
  --repo NetApp/gcnv-mcp-server \
  --target main \
  --title "vX.Y.Z" \
  --notes "$(cat <<'EOF'
## What's Changed

- ...
EOF
)"
```

Use `--draft` first if the user wants to review before publishing. **Publishing** (non-draft) triggers npm.

## Step 5 — Verify

```bash
gh run list --repo NetApp/gcnv-mcp-server --workflow "Publish on release" --limit 3
npm view gcnv-mcp-server version
gh release view vX.Y.Z --repo NetApp/gcnv-mcp-server
```

## Pre-release testing (recommended)

Run when the release includes MCP schema/handler changes.

### Cursor MCP

- Local build: `npm run build`
- Point `~/.cursor/mcp.json` at repo `build/index.js`
- Test affected tools against a GCNV project (e.g. list/get for backup, snapshot, replication, storage pool)

### Gemini CLI (Vertex AI)

Personal OAuth often fails; use gcloud ADC + Vertex:

```bash
export GEMINI_CLI_HOME=/tmp/gemini-vertex-home
export GOOGLE_GENAI_USE_VERTEXAI=true
export GOOGLE_CLOUD_PROJECT=<project>
export GOOGLE_CLOUD_LOCATION=us-central1
# settings: selectedType vertex-ai, model gemini-2.5-flash
gemini  # invoke MCP tools from PR test plan
```

### CI security audit

If `npm audit` fails on transitive deps, prefer **scoped** overrides in `package.json` (e.g. under `glob → minimatch → brace-expansion`), not global overrides.

## Version guidance

| Change type | Bump | Example |
|-------------|------|---------|
| Bug fix, schema fix, audit override | patch | 1.2.0 → 1.2.1 |
| New tools or features | minor | 1.2.0 → 1.3.0 |
| Breaking API/tool removal | major | 1.x → 2.0.0 |

## Additional resources

- Past release note formats: [release-notes-examples.md](release-notes-examples.md)
