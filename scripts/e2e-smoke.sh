#!/usr/bin/env bash
# RELAY Attendance — end-to-end smoke test against a RUNNING backend.
#
# Exercises a full real-user journey: admin creates an engineer → assigns a site
# → engineer check-in (live-photo multipart) → duplicate blocked → check-out →
# history/summary → leave apply → manager approve → balance check → HR reports.
#
# Usage:   bash scripts/e2e-smoke.sh          (expects http://localhost:4000)
#          BASE=http://localhost:4005 bash scripts/e2e-smoke.sh
#
# Safe against the demo DB: creates a throwaway SMOKE-* user, deactivates it at
# the end. Exit code 0 = all checks passed.

set -u
BASE="${BASE:-http://localhost:4000}"
PASS=0
FAIL=0
SUFFIX="$(date +%s)"

ok()   { PASS=$((PASS+1)); echo "  [PASS] $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  [FAIL] $1"; }
check(){ case "$2" in *"$3"*) ok "$1";; *) bad "$1 — expected to contain '$3', got: $(printf '%s' "$2" | head -c 220)";; esac; }

jqp() { # JSON value at dotted path, e.g.  echo "$json" | jqp '.user.id'
  node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const j=JSON.parse(s);let v;try{v=eval("j"+process.argv[1])}catch(e){v=undefined}console.log(v===undefined?"":(typeof v==="object"?JSON.stringify(v):v))});' "$1"
}

lenok() { # $1 label, $2 string, $3 min length (default 40)
  if [ "${#2}" -gt "${3:-40}" ]; then ok "$1 (${#2} chars)"; else bad "$1 — expected >${3:-40} chars, got ${#2}: $(printf '%s' "$2" | head -c 120)"; fi
}

login() { # $1 identifier, $2 password -> prints accessToken
  curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
    -d "{\"identifier\":\"$1\",\"password\":\"$2\"}" | jqp '.accessToken'
}

echo "RELAY Attendance E2E smoke — $BASE"
echo

# ── 1. Health ────────────────────────────────────────────────────────────────
echo "1) Health"
check "API is up" "$(curl -s -m 10 "$BASE/api/health")" '"status":"ok"'

# ── 2. Admin creates throwaway engineer + assigns site ───────────────────────
echo "2) Admin: create engineer + assign site"
ADMIN_TOKEN="$(login admin@relay.local 'Relay@123')"
lenok "admin login" "$ADMIN_TOKEN"

EMAIL="smoke-$SUFFIX@relay.local"
EMPID="SMOKE-$SUFFIX"
CREATED=$(curl -s -X POST "$BASE/api/users" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke Test\",\"email\":\"$EMAIL\",\"employeeId\":\"$EMPID\",\"password\":\"Smoke@123\",\"role\":\"ENGINEER\"}")
check "engineer created" "$CREATED" '"role":"ENGINEER"'
UID_="$(printf '%s' "$CREATED" | jqp '.id')"

SITES=$(curl -s "$BASE/api/sites" -H "Authorization: Bearer $ADMIN_TOKEN")
# Pick a site that manager1 actually manages (Skyline).
SITE_JSON=$(printf '%s' "$SITES" | jqp '.find(s=>s.name.indexOf("Skyline")>=0)')
SITE_ID=$(printf '%s' "$SITE_JSON" | jqp '.id')
SITE_LAT=$(printf '%s' "$SITE_JSON" | jqp '.lat')
SITE_LNG=$(printf '%s' "$SITE_JSON" | jqp '.lng')
check "site assignment" "$(curl -s -X POST "$BASE/api/sites/$SITE_ID/assignments" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "{\"userId\":\"$UID_\"}")" "$UID_"

# ── 3. Engineer: check-in with live-photo multipart ─────────────────────────
echo "3) Engineer: check-in / duplicate / check-out"
SMOKE_TOKEN="$(login "$EMAIL" 'Smoke@123')"
lenok "engineer login (email)" "$SMOKE_TOKEN"

PHOTO=".e2e-photo-$$.png"
printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' | base64 -d > "$PHOTO"
IN_LAT=$(node -e "console.log(($SITE_LAT + 0.00015).toFixed(6))")
IN_LNG=$(node -e "console.log(($SITE_LNG + 0.00010).toFixed(6))")

CHECKIN=$(curl -s -X POST "$BASE/api/attendance/check-in" -H "Authorization: Bearer $SMOKE_TOKEN" \
  -F "photo=@$PHOTO" -F "lat=$IN_LAT" -F "lng=$IN_LNG" -F "accuracy=10" \
  -F "clientTimestamp=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" \
  -F "deviceId=e2e-smoke-$SUFFIX" -F "mocked=false" -F "captureSource=camera" -F "siteId=$SITE_ID")
check "check-in recorded" "$CHECKIN" '"checkIn":'
check "distance computed server-side" "$CHECKIN" '"distanceMeters":'

DUP=$(curl -s -X POST "$BASE/api/attendance/check-in" -H "Authorization: Bearer $SMOKE_TOKEN" \
  -F "photo=@$PHOTO" -F "lat=$IN_LAT" -F "lng=$IN_LNG" -F "accuracy=10" \
  -F "clientTimestamp=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" \
  -F "deviceId=e2e-smoke-$SUFFIX" -F "mocked=false" -F "captureSource=camera" -F "siteId=$SITE_ID")
check "duplicate check-in blocked" "$DUP" 'ALREADY_CHECKED_IN'

MOCKED=$(curl -s -X POST "$BASE/api/attendance/check-in" -H "Authorization: Bearer $SMOKE_TOKEN" \
  -F "photo=@$PHOTO" -F "lat=$IN_LAT" -F "lng=$IN_LNG" -F "accuracy=10" \
  -F "clientTimestamp=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" \
  -F "deviceId=e2e-smoke-$SUFFIX" -F "mocked=true" -F "captureSource=camera" -F "siteId=$SITE_ID")
check "mocked GPS rejected" "$MOCKED" 'MOCKED_LOCATION'

CHECKOUT=$(curl -s -X POST "$BASE/api/attendance/check-out" -H "Authorization: Bearer $SMOKE_TOKEN" \
  -F "photo=@$PHOTO" -F "lat=$IN_LAT" -F "lng=$IN_LNG" -F "accuracy=10" \
  -F "clientTimestamp=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" \
  -F "deviceId=e2e-smoke-$SUFFIX" -F "mocked=false" -F "captureSource=camera")
check "check-out recorded" "$CHECKOUT" '"checkOut":'

rm -f "$PHOTO"

# ── 4. History / summary ─────────────────────────────────────────────────────
echo "4) Engineer: history + monthly summary"
check "history contains today's record" "$(curl -s "$BASE/api/attendance/me" -H "Authorization: Bearer $SMOKE_TOKEN")" '"total":1'
MONTH=$(date -u +%Y-%m)
SUMMARY=$(curl -s "$BASE/api/attendance/me/summary?month=$MONTH" -H "Authorization: Bearer $SMOKE_TOKEN")
check "summary has worked minutes" "$SUMMARY" '"totalWorkedMinutes"'

# ── 5. Leave: apply → manager approves → balance moves ──────────────────────
echo "5) Leave: apply → approve → balance"
TYPES=$(curl -s "$BASE/api/leave/types" -H "Authorization: Bearer $SMOKE_TOKEN")
CASUAL_ID=$(printf '%s' "$TYPES" | jqp '.find(t=>t.code==="CASUAL").id')
TOMORROW=$(date -u -d '+1 day' +%F 2>/dev/null || date -u -v+1d +%F)

APPLIED=$(curl -s -X POST "$BASE/api/leave/requests" -H "Authorization: Bearer $SMOKE_TOKEN" \
  -F "leaveTypeId=$CASUAL_ID" -F "fromDate=$TOMORROW" -F "toDate=$TOMORROW" \
  -F "isHalfDay=false" -F "reason=E2E smoke test leave")
check "leave applied (PENDING)" "$APPLIED" '"status":"PENDING"'
REQ_ID=$(printf '%s' "$APPLIED" | jqp '.id')

MGR_TOKEN="$(login manager1@relay.local 'Relay@123')"
lenok "manager login" "$MGR_TOKEN"
check "manager approves" "$(curl -s -X POST "$BASE/api/leave/requests/$REQ_ID/approve" -H "Authorization: Bearer $MGR_TOKEN" -H 'Content-Type: application/json' -d '{"comment":"E2E ok"}')" '"status":"APPROVED"'
check "balance reflects approval (12 → 11 available)" "$(curl -s "$BASE/api/leave/balances/me" -H "Authorization: Bearer $SMOKE_TOKEN")" '"available":11'

# ── 6. HR reports ────────────────────────────────────────────────────────────
echo "6) HR: reports (CSV + PDF)"
HR_TOKEN="$(login hr@relay.local 'Relay@123')"
lenok "hr login" "$HR_TOKEN"
CSV=$(curl -s "$BASE/api/reports/attendance?month=$MONTH&format=csv" -H "Authorization: Bearer $HR_TOKEN")
case "$CSV" in *"$EMPID"*) ok "CSV contains the smoke user";; *) bad "CSV missing smoke user";; esac
curl -s "$BASE/api/reports/attendance?month=$MONTH&format=pdf" -H "Authorization: Bearer $HR_TOKEN" -o ".e2e-report-$$.pdf"
PDFHDR=$(head -c 5 ".e2e-report-$$.pdf" 2>/dev/null || echo "none")
check "PDF magic bytes" "$PDFHDR" '%PDF-'
rm -f ".e2e-report-$$.pdf"

# ── 7. Photo access control ─────────────────────────────────────────────────
echo "7) Photo streaming + signed URLs"
REC_ID=$(printf '%s' "$CHECKIN" | jqp '.record.id')
SIGNED=$(curl -s -X POST "$BASE/api/uploads/signed-url" -H "Authorization: Bearer $SMOKE_TOKEN" -H 'Content-Type: application/json' -d "{\"path\":\"/api/attendance/$REC_ID/photo/in\"}")
SIGNED_URL=$(printf '%s' "$SIGNED" | jqp '.url')
SIGNED_PATH=$(printf '%s' "$SIGNED_URL" | sed 's|^https\?://[^/]*||')
check "signed URL streams the photo" "$(curl -s "$BASE$SIGNED_PATH" | head -c 4 | od -An -tx1 | tr -d ' \n')" '89504e47'

# ── 8. Deactivate the throwaway user ────────────────────────────────────────
echo "8) Cleanup"
check "smoke user deactivated" "$(curl -s -X PATCH "$BASE/api/users/$UID_" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"isActive":false}')" '"isActive":false'

echo
echo "Result: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
