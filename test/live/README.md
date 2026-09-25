# Live MCP tests

See **[VERIFICATION.md](./VERIFICATION.md)** for full step-by-step input/output proof (Cursor + Gemini stdio).

Captured JSON artifacts are in **`artifacts/`**:

| File | Client / transport | Result |
|------|-------------------|--------|
| `cursor-prefix.json` | Cursor MCP, pre-fix | FAIL |
| `cursor-postfix.json` | Cursor MCP, post-fix | PASS |
| `prefix-stdio.json` | stdio (Gemini path), pre-fix | FAIL |
| `postfix-stdio.json` | stdio (Gemini path), post-fix | PASS |

Run:

```bash
npm run build
npm run test:live
```
