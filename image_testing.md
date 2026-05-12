# Image Integration Test Playbook

## Rules
- Use base64-encoded images only.
- Accepted formats: JPEG, PNG, WEBP only.
- Do not use blank/uniform images. Image must contain real visual features.
- Resize large images.

## Endpoint
`POST /api/analyze-receipt`
Body: `{ "image_base64": "<base64>", "mime_type": "image/jpeg" }`
Auth: required (Bearer token).

Response shape:
```json
{
  "title": "Supermercado",
  "amount": 18.09,
  "category": "Alimentación",
  "type": "expense",
  "month": "2026-02"
}
```

## Test snippet (curl)
```bash
B64=$(base64 -w0 receipt.jpg)
curl -X POST "$EXPO_BACKEND_URL/api/analyze-receipt" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"image_base64\":\"$B64\",\"mime_type\":\"image/jpeg\"}"
```
