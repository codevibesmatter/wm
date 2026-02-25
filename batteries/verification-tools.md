# Verification Tools Reference

This document tells the verification agent exactly how to use each tool category
when executing a Verification Plan against a real running system.

## Dev Server Management

### Starting the dev server

Check `wm.yaml` for `project.dev_server_command`. If not configured, check the
VP steps or the project's `package.json` scripts.

```bash
# Common patterns
npm run dev &                    # Node/Next/Vite/Remix
npm run dev -- --port 3000 &     # With explicit port
bun run dev &                    # Bun projects
python manage.py runserver &     # Django
cargo run &                      # Rust

# Background the process and capture PID
DEV_PID=$!
```

### Waiting for readiness

Always wait for the server to be ready before running VP steps:

```bash
# Poll health endpoint (preferred — use dev_server_health from wm.yaml)
for i in $(seq 1 30); do
  curl -sf http://localhost:3000/health && break
  sleep 1
done

# Poll any endpoint (fallback)
for i in $(seq 1 30); do
  curl -sf http://localhost:3000/ > /dev/null 2>&1 && break
  sleep 1
done

# Check if port is listening (last resort)
for i in $(seq 1 30); do
  lsof -i :3000 -sTCP:LISTEN > /dev/null 2>&1 && break
  sleep 1
done
```

### Stopping the dev server

```bash
kill $DEV_PID 2>/dev/null
# Or kill by port if PID was lost
lsof -ti :3000 | xargs kill 2>/dev/null
```

## API Testing

### curl basics

```bash
# GET with status code check
curl -sf -o /dev/null -w "%{http_code}" http://localhost:3000/api/users
# Expected: 200

# GET with response body
curl -s http://localhost:3000/api/users | jq .
# Expected: JSON array

# POST with JSON body
curl -s -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "email": "test@example.com"}'
# Expected: 201 with created user

# PUT/PATCH
curl -s -X PATCH http://localhost:3000/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name"}'

# DELETE
curl -s -X DELETE http://localhost:3000/api/users/1 \
  -o /dev/null -w "%{http_code}"
# Expected: 204

# With authentication
curl -s http://localhost:3000/api/protected \
  -H "Authorization: Bearer $TOKEN"

# Follow redirects
curl -sL http://localhost:3000/old-path
```

### Checking responses

```bash
# Status code only
STATUS=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:3000/api/endpoint)
[ "$STATUS" = "200" ] && echo "PASS" || echo "FAIL: got $STATUS"

# Response body contains expected string
BODY=$(curl -s http://localhost:3000/api/health)
echo "$BODY" | grep -q '"status":"ok"' && echo "PASS" || echo "FAIL: $BODY"

# JSON field check with jq
VALUE=$(curl -s http://localhost:3000/api/users/1 | jq -r '.name')
[ "$VALUE" = "Test User" ] && echo "PASS" || echo "FAIL: got $VALUE"

# Response header check
curl -sI http://localhost:3000/api/data | grep -i "content-type: application/json"

# Array length check
COUNT=$(curl -s http://localhost:3000/api/items | jq 'length')
[ "$COUNT" -gt 0 ] && echo "PASS" || echo "FAIL: empty array"
```

### Error cases

```bash
# Should return 404
STATUS=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:3000/api/users/99999)
[ "$STATUS" = "404" ] && echo "PASS" || echo "FAIL: got $STATUS"

# Should return 400 for invalid input
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"invalid": true}')
[ "$STATUS" = "400" ] && echo "PASS" || echo "FAIL: got $STATUS"

# Should return 401 without auth
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/protected)
[ "$STATUS" = "401" ] && echo "PASS" || echo "FAIL: got $STATUS"
```

## Browser / UI Testing

### Using WebFetch for page content

```
WebFetch(url="http://localhost:3000/dashboard", prompt="Does this page contain a user list table?")
WebFetch(url="http://localhost:3000/login", prompt="Is there a login form with email and password fields?")
```

### Using curl for HTML inspection

```bash
# Check page renders (not 500)
STATUS=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:3000/dashboard)
[ "$STATUS" = "200" ] && echo "PASS" || echo "FAIL: got $STATUS"

# Check for specific HTML content
curl -s http://localhost:3000/dashboard | grep -q 'data-testid="user-table"'

# Check page title
curl -s http://localhost:3000/ | grep -o '<title>[^<]*</title>'

# Check meta tags (SSR/SEO)
curl -s http://localhost:3000/about | grep -o '<meta name="description"[^>]*>'
```

### Form submission

```bash
# Submit a form (URL-encoded)
curl -s -X POST http://localhost:3000/login \
  -d "email=test@example.com&password=secret123" \
  -c cookies.txt -L

# Use cookies from login for authenticated pages
curl -s http://localhost:3000/dashboard -b cookies.txt
```

### Static assets

```bash
# Check CSS/JS bundles load
curl -sf -o /dev/null http://localhost:3000/assets/main.css && echo "CSS PASS"
curl -sf -o /dev/null http://localhost:3000/assets/main.js && echo "JS PASS"
```

## CLI Testing

### Running CLI commands

```bash
# Direct invocation with output capture
OUTPUT=$(node dist/index.js my-command --flag 2>&1)
echo "$OUTPUT"
# Expected: specific output text

# Exit code check
node dist/index.js valid-command; echo "Exit: $?"
# Expected: Exit: 0

node dist/index.js bad-command 2>/dev/null; echo "Exit: $?"
# Expected: Exit: 1

# Stderr capture (many CLIs output to stderr)
STDERR=$(node dist/index.js command 2>&1 1>/dev/null)
echo "$STDERR" | grep -q "expected message"
```

### File output verification

```bash
# Command creates expected file
node dist/index.js generate --output out.json
[ -f out.json ] && echo "PASS: file created" || echo "FAIL: no output"
cat out.json | jq .  # Verify valid JSON

# Command modifies existing file
BEFORE=$(cat config.yaml)
node dist/index.js update-config --key value
AFTER=$(cat config.yaml)
[ "$BEFORE" != "$AFTER" ] && echo "PASS: file changed" || echo "FAIL: no change"
```

## Database / State Verification

### SQLite

```bash
sqlite3 data.db "SELECT count(*) FROM users WHERE created_at > datetime('now', '-1 minute')"
# Expected: 1 (new user was created)
```

### PostgreSQL

```bash
psql -c "SELECT name FROM users WHERE email='test@example.com'" postgres://localhost/mydb
```

### File-based state

```bash
# Check JSON state file
cat .data/state.json | jq '.users | length'
# Expected: > 0

# Check log file for expected entries
grep "User created" logs/app.log | tail -1
```

### Redis / KV stores

```bash
redis-cli GET "session:abc123"
redis-cli HGETALL "user:1"
```

## Evidence Recording

After executing VP steps, the verification agent writes an evidence file:

```
Path: .kata/verification-evidence/vp-{phaseId}-{issueNumber}.json
```

Format:
```json
{
  "phaseId": "p1",
  "issueNumber": 123,
  "timestamp": "2026-02-25T12:00:00.000Z",
  "steps": [
    {
      "id": "VP1",
      "description": "Health endpoint returns 200",
      "passed": true,
      "actual": "HTTP 200, body: {\"status\":\"ok\"}"
    },
    {
      "id": "VP2",
      "description": "Create user returns 201",
      "passed": false,
      "actual": "HTTP 500, body: Internal Server Error",
      "expected": "HTTP 201 with user object"
    }
  ],
  "allStepsPassed": false
}
```

Rules:
- Record EVERY step, not just failures
- Include the actual response/output in `actual`
- Set `allStepsPassed` based on whether ALL steps passed
- Timestamp must be current (used for staleness check)
