# ONTAP KG Discover Protocol (`ontap-kg/1`)

This document defines the query-only contract between `gcnv-mcp-server` and an optional external ONTAP knowledge service.

## Scope

- Query-only mode.
- MCP sends one request per `ontap_discover` call.
- KG service returns ranked endpoint candidates in a normalized envelope.
- On failure or contract mismatch, MCP falls back to bundled `src/resources/ontap-api-index.json`.

## Endpoint

`POST ${ONTAP_KG_URL}`

Set `ONTAP_KG_URL` to the full discover endpoint URL (for example `https://kg.example/discover`).

Optional auth header from MCP:

`Authorization: Bearer ${ONTAP_KG_AUTH_TOKEN}`

## Request

```json
{
  "schemaVersion": "ontap-kg/1",
  "kind": "search",
  "search": "legal hold on volume",
  "max_results": 5,
  "context": {
    "user_intent": "Apply legal hold to vol1 for eDiscovery",
    "client": { "name": "gcnv-mcp", "version": "1.1.0" },
    "session_id": "optional-session-id"
  }
}
```

Fields:

- `schemaVersion` (required): must be `ontap-kg/1`
- `kind` (required): `categories | resource | search`
- `resource` (optional): required by caller when `kind=resource`
- `search` (optional): required by caller when `kind=search`
- `max_results` (optional): requested top-N cap
- `context` (optional): advisory metadata for reranking

## Response

```json
{
  "schemaVersion": "ontap-kg/1",
  "kind": "search",
  "endpoints": [
    {
      "resource": "litigation",
      "method": "POST",
      "path": "/api/storage/litigations",
      "pathParams": [],
      "description": "Apply a legal hold to files on a volume.",
      "hint": "Look up volume UUID first.",
      "keywords": ["legal", "hold", "litigation"],
      "body": {
        "name": "<hold-name>",
        "volume": { "uuid": "<uuid>" },
        "operation": "begin"
      },
      "requiredBody": [["name"], ["volume", "uuid"], ["operation"]],
      "operationId": "litigation_create",
      "score": 0.94,
      "related": [
        {
          "relationship": "requires",
          "operationId": "volume_get",
          "why": "Need volume UUID before creating a hold."
        }
      ],
      "extensions": {
        "docs_url": "https://example.internal/runbooks/legal-hold"
      }
    }
  ],
  "synonyms": {
    "legal_hold": ["legal hold", "litigation", "ebr"]
  },
  "provenance": {
    "source": "ingestion-pipeline",
    "generatedAt": "2026-06-17T07:00:00Z"
  }
}
```

## Validation and Fallback Rules

- Required core fields must exist and be typed correctly.
- `kind` must match request intent.
- Optional fields may be dropped when malformed.
- Unknown fields are ignored.
- Any transport/parse/schema error triggers fallback to bundled index.

## Notes for Integrators

- Return stable endpoint `method/path/body/requiredBody` values that map directly to `ontap_execute`.
- Keep `hint` and `keywords` concise for LLM ranking quality.
- Use `extensions` for customer-specific metadata; MCP passes it through.
