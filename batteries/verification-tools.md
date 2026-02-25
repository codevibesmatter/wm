# Verification Tools — Project Configuration

Fill in this file with YOUR project's specific verification setup.
The verification agent reads this before executing any Verification Plan.

## Project Dev Server

```bash
# Command to start the dev server (background it with &)
{dev_server_command}

# Health/readiness endpoint to poll before running VP steps
{dev_server_health}

# Port the dev server listens on
{port}
```

## API Base URL

```
{base_url}
# e.g., http://localhost:3000/api
```

## Authentication

```bash
# How to get a test auth token (if APIs require auth)
# e.g., curl -s -X POST http://localhost:3000/api/auth/login \
#   -H "Content-Type: application/json" \
#   -d '{"email": "test@example.com", "password": "test123"}' | jq -r '.token'
{auth_command}
```

## Database Access

```bash
# How to query the database directly (for state verification)
# e.g., sqlite3 data/app.db "SELECT ..."
# e.g., psql postgresql://localhost/mydb -c "SELECT ..."
{db_command}
```

## Key Endpoints / Pages

List the main routes the verification agent may need to hit:

| Route | Method | Purpose |
|-------|--------|---------|
| {/api/health} | {GET} | {Health check} |
| {/api/...} | {GET/POST/...} | {Description} |

## Project-Specific Notes

{Anything else the verification agent needs to know — seed data, environment
variables, services that must be running, ports to avoid, etc.}

---

<!-- DELETE everything below this line once filled in. It's reference only. -->

# Reference Patterns

## Dev Server Wait Loop

```bash
# Start server and wait for health
npm run dev &
DEV_PID=$!
for i in $(seq 1 30); do
  curl -sf http://localhost:3000/health && break
  sleep 1
done
```

## API Testing with curl

```bash
# GET with status check
STATUS=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:3000/api/users)
[ "$STATUS" = "200" ] && echo "PASS" || echo "FAIL: got $STATUS"

# POST with JSON body
curl -s -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "email": "test@example.com"}'

# JSON field check with jq
VALUE=$(curl -s http://localhost:3000/api/users/1 | jq -r '.name')
[ "$VALUE" = "Test" ] && echo "PASS" || echo "FAIL: got $VALUE"

# Error case (expect 404)
STATUS=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:3000/api/users/99999)
[ "$STATUS" = "404" ] && echo "PASS" || echo "FAIL: got $STATUS"
```

## Browser / UI Testing

```
# Page content check
WebFetch(url="http://localhost:3000/dashboard", prompt="Does this page show a user table?")

# HTML inspection
curl -s http://localhost:3000/ | grep -q 'data-testid="main-content"'
```

## CLI Testing

```bash
# Output + exit code
OUTPUT=$(node dist/index.js my-command 2>&1)
echo "$OUTPUT" | grep -q "expected text" && echo "PASS" || echo "FAIL"
```

## Database Checks

```bash
# SQLite
sqlite3 data.db "SELECT count(*) FROM users"

# PostgreSQL
psql -c "SELECT name FROM users LIMIT 1" postgres://localhost/mydb
```

## Evidence File Format

Write to `.kata/verification-evidence/vp-{phaseId}-{issueNumber}.json`:

```json
{
  "phaseId": "p1",
  "issueNumber": 123,
  "timestamp": "2026-02-25T12:00:00.000Z",
  "steps": [
    {"id": "VP1", "description": "Health returns 200", "passed": true, "actual": "200 OK"},
    {"id": "VP2", "description": "Create user", "passed": false, "actual": "500", "expected": "201"}
  ],
  "allStepsPassed": false
}
```

Rules:
- Record EVERY step, not just failures
- Include actual response/output
- Timestamp must be current (staleness check uses it)
