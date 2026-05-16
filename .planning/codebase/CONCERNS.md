# Codebase Concerns

**Analysis Date:** 2026-05-16

## Security Issues

### Hardcoded Default JWT Secret Key

**Risk:** Critical - Allows token forgery and authentication bypass

**Files:** `pepper-farm/backend/utils/jwt.py` (line 10)

**Details:**
```python
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
```

The JWT secret key defaults to `"dev-secret-key"` in production if `SECRET_KEY` environment variable is not set. This hardcoded fallback allows any attacker knowing this string to forge valid JWT tokens and impersonate any user.

**Current Mitigation:** None. The code will fail silently if the env var is missing.

**Recommendations:**
- Remove the fallback default value
- Require `SECRET_KEY` to be explicitly set in `.env`
- Raise an exception at startup if `SECRET_KEY` is missing
- Rotate `SECRET_KEY` if production was ever deployed with this value

---

### Overly Permissive CORS Configuration

**Risk:** High - Cross-site request forgery and unauthorized API access

**Files:** `pepper-farm/backend/main.py` (lines 39-45)

**Details:**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

CORS is configured to accept requests from all origins (`"*"`). While `allow_credentials=False` prevents some CSRF attacks, the wildcard origin still allows:
- Cross-site API calls from any website
- Potential for credential leakage via headers
- No protection against CSRF in GET requests with side effects

**Recommendations:**
- Whitelist only the specific frontend domain(s): `allow_origins=["https://yourdomain.com"]`
- If multiple domains needed, use environment variable: `os.getenv("CORS_ORIGINS", "").split(",")`
- Consider enabling `allow_credentials=True` only for authenticated endpoints if needed

---

### Weak Password Requirements

**Risk:** Medium - Accounts vulnerable to brute force

**Files:** `pepper-farm/backend/schemas/user.py`

**Details:**
Minimum password length is only 6 characters:
```python
def validate_password(cls, v: str) -> str:
    if len(v) < 6:
        raise ValueError("Password must be at least 6 characters.")
```

Industry standard is minimum 12 characters. 6 characters can be brute-forced in milliseconds.

**Recommendations:**
- Increase minimum to 12-16 characters
- Add complexity requirements (uppercase, lowercase, numbers, symbols)
- Implement password history (prevent reuse of last 3-5 passwords)
- Consider requiring complexity validation in the validator

---

### JWT Tokens Stored in Browser localStorage

**Risk:** High - Vulnerable to XSS attacks

**Files:**
- `pepper-farm/frontend/src/services/inventory.ts` (line 8)
- `pepper-farm/frontend/src/services/reports.ts` (line 100)
- `pepper-farm/frontend/src/services/api.ts` (line 74)

**Details:**
JWT access tokens are stored in `localStorage`, which is accessible to any JavaScript on the page:
```typescript
function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}
```

An XSS vulnerability allows stealing the token and impersonating the user. There is no HttpOnly flag, same-site protection, or secure flag enforcement.

**Current Mitigation:** None.

**Recommendations:**
- Move tokens to HttpOnly cookies (immune to XSS)
- Set `Secure` flag (HTTPS only)
- Set `SameSite=Strict` for CSRF protection
- Backend should set cookies in login response
- Frontend should not store tokens in JavaScript-accessible storage

---

### Duplicate and Inconsistent Imports

**Risk:** Low - Code maintainability and confusion

**Files:** `pepper-farm/backend/main.py` (lines 4, 6, 21)

**Details:**
```python
from routers import tasks, users, auth, peppers, plants, products, inventory, sensor_readings
from routers import tasks, users, auth, peppers, plants, products, inventory, sensors, zones,spray
from routers import peppers, plants, zones
```

Same modules imported multiple times with different subsets. This indicates incomplete refactoring and could cause subtle import errors.

**Recommendations:**
- Consolidate all imports into a single statement at the top
- Remove duplicate imports
- Use a single consistent import style

---

### Missing File Size Validation for Image Uploads

**Risk:** Medium - Denial of service / resource exhaustion

**Files:** `pepper-farm/backend/routers/peppers.py` (lines 50-74)

**Details:**
```python
async def upload_pepper_image(file: UploadFile = File(...)):
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
    if file.content_type not in allowed_types:
        raise HTTPException(...)

    # No size check here
    content = await file.read()  # Can read arbitrarily large files
    buffer.write(content)
```

Content-Type is validated but file size is not. An attacker can upload multi-gigabyte files to fill disk space or exhaust server memory.

**Recommendations:**
- Set max file size limit (e.g., 10MB for images)
- Add size check before reading: `if file.size > MAX_SIZE: raise HTTPException(413)`
- Set FastAPI's global upload limit in main.py
- Implement rate limiting per user/IP

---

## Tech Debt

### N+1 Query Pattern in Inventory Service

**Risk:** Medium - Performance degrades with large datasets

**Files:** `pepper-farm/backend/services/inventory_service.py` (lines 91-133)

**Details:**
```python
def get_inventory_by_variety(db: Session) -> list[dict]:
    varieties = db.query(PepperVariety).filter(...).all()  # Query 1

    results: list[dict] = []
    for v in varieties:
        plants = db.query(Plant).filter(...).all()  # Query N (one per variety)
        total_qty = db.query(func.coalesce(...)).join(...).filter(...).scalar()  # Query N
```

For every variety, the code executes 2 additional queries. With 100 varieties, this becomes 200+ queries instead of 3.

**Impact:** API response times increase linearly with data volume. Scalability breaks at ~500 varieties.

**Fix Approach:**
- Use SQLAlchemy `.joinedload()` or `.contains_eager()` to fetch plants in one query
- Pre-aggregate warehouse quantities in a single join instead of looping
- Consider adding database indexes on (PepperId, IsActive)

---

### Inconsistent Error Handling Patterns

**Risk:** Medium - Hard to debug, difficult to maintain

**Files:** Across all routers (`pepper-farm/backend/routers/*.py`)

**Details:**
Some endpoints use structured error returns:
```python
def auth_service():
    return None, "error message"
```

Others throw HTTPException immediately:
```python
raise HTTPException(status_code=400, detail="error message")
```

Others catch all exceptions generically:
```python
except Exception:
    raise HTTPException(status_code=500, detail="Unexpected server error.")
```

This inconsistency makes it hard to:
- Add logging/monitoring
- Handle errors consistently
- Provide meaningful error details to clients

**Recommendations:**
- Create a custom exception class: `class ValidationError(Exception): ...`
- Use a global exception handler middleware
- Always include structured error responses with error codes
- Never catch bare `Exception` - catch specific exception types

---

### Large Frontend Components with Multiple Responsibilities

**Risk:** Medium - Hard to test, prone to bugs

**Files:**
- `pepper-farm/frontend/src/app/manager/sensors/page.tsx` (976 lines)
- `pepper-farm/frontend/src/app/manager/peppers/edit/[id]/page.tsx` (498 lines)
- `pepper-farm/frontend/src/app/manager/peppers/create/page.tsx` (467 lines)

**Details:**
The sensors page combines:
1. Data fetching and state management
2. Table rendering with sorting/filtering
3. Chart rendering
4. Modal dialogs
5. Export functionality

All in a single 976-line component. This makes it:
- Difficult to unit test individual features
- Hard to reuse components
- Slow to render with many state updates

**Recommendations:**
- Extract table into separate component
- Extract chart into separate component
- Extract modal logic into custom hook
- Create service layer for data fetching
- Aim for <200 lines per component

---

## Performance Bottlenecks

### Synchronous Image File I/O

**Risk:** Medium - Request blocking during upload

**Files:** `pepper-farm/backend/routers/peppers.py` (line 67-69)

**Details:**
```python
async def upload_pepper_image(file: UploadFile = File(...)):
    # ... async function but...
    with open(file_path, "wb") as buffer:  # Synchronous blocking I/O
        content = await file.read()
        buffer.write(content)
```

Writes to disk are synchronous and block the async event loop. With many concurrent uploads, the server becomes unresponsive.

**Recommendations:**
- Use `aiofiles` for async file operations
- Move large file processing to background queue (Celery, RQ)
- Implement streaming upload with progress tracking

---

### Missing Database Indexes

**Risk:** Medium - Query performance degrades with data volume

**Files:** Database schema (not visible in code)

**Details:**
Queries frequently filter by:
- `Plant.PepperId` (multiple queries in inventory_service.py)
- `Plant.IsActive` (used in get_inventory_by_variety)
- `Inventory.ProductId` (outerjoin in get_inventory_list)
- `SensorAssignment.SensorId` (in anomaly detection)

Without indexes, these become full table scans at scale.

**Recommendations:**
- Add composite index: `(PepperId, IsActive)`
- Add index on ProductId
- Add index on foreign keys (usually auto-indexed)
- Run EXPLAIN ANALYZE on slow queries to verify index usage

---

## Test Coverage Gaps

### Missing Tests for Critical Services

**Risk:** Medium - Untested code paths can hide bugs

**Services without dedicated test files:**
- `product_service.py` - No `test_product_service.py`
- `sensor_service.py` - No `test_sensor_service.py` (has API tests but not service unit tests)
- `spray_service.py` - Has API tests but gaps in service layer

**Test to Service Ratio:**
- 29 test files for 13 service files (2:1 ratio is acceptable)
- But tests are unevenly distributed (some services have comprehensive tests, others have none)

**Recommendations:**
- Write unit tests for `product_service.py` covering CRUD operations
- Add integration tests for `sensor_service` auto-sync logic
- Test error cases (validation failures, duplicate keys, etc.)
- Add tests for concurrent operations (race conditions)
- Target >80% code coverage for critical paths

---

### No End-to-End Tests for Core Workflows

**Risk:** High - Complete user flows may break unnoticed

**Details:**
Frontend has one E2E test: `e2e/test_edit_pepper_flow.spec.ts`

Missing E2E coverage for:
1. User registration → login → create pepper → assign tasks
2. Sensor reading ingestion → anomaly detection → alert creation
3. Inventory management → allocation → product tracking
4. Task assignment → completion → reporting

**Recommendations:**
- Add E2E tests for all major workflows (Playwright is already set up)
- Test cross-user interactions (manager assigns task to worker)
- Test data consistency (inventory quantity changes propagate correctly)
- Run E2E tests before each deployment

---

## Fragile Code Areas

### Anomaly Detection Logic - Complex State Management

**Risk:** Medium - Changes to thresholds or logic can break silently

**Files:** `pepper-farm/backend/services/anomaly_detection_service.py`

**Details:**
The anomaly detection flow is complex:
1. Fetch sensor reading
2. Find SensorAssignment for that sensor
3. Fetch all active Plants in that zone
4. For each distinct PepperId, fetch thresholds from PepperVariety
5. Apply rule-based checks
6. Create/deduplicate alerts

Multiple data dependencies and implicit assumptions:
- If SensorAssignment is missing, alerts silently don't trigger
- If PepperVariety is inactive, behavior changes
- Deduplication logic relies on (ReadingId, MetricName, PepperId)

**Safe Modification Approach:**
- Add comprehensive logging at each step
- Add validation checks with clear error messages
- Write tests for each edge case (missing assignment, inactive variety, etc.)
- Document assumptions in comments

---

### Task Service - Hard-Coded Plant ID in Description

**Risk:** Medium - Data stored in wrong format, fragile parsing

**Files:** `pepper-farm/backend/services/task_service.py` (lines 69-74)

**Details:**
```python
if assignment.PlantId is not None:
    plant_tag = f"PlantId:{assignment.PlantId}"
    if description:
        if plant_tag not in description:
            description = f"{description}\n{plant_tag}"
```

PlantId is embedded in the Description field as "PlantId:123" text. This is fragile:
- Parsing description text for data is error-prone
- Description changes can break the parsing
- No database constraint enforces this relationship

**Recommendations:**
- Add a `PlantId` column to Task model (proper foreign key)
- Migrate existing data: parse Plant ID from descriptions
- Remove ad-hoc parsing logic
- Update API to accept PlantId as dedicated field

---

## Missing Critical Features

### No Rate Limiting

**Risk:** High - API is vulnerable to brute force and DoS

**Details:**
- No rate limiting on login endpoint (brute force password attacks)
- No rate limiting on registration (account enumeration)
- No rate limiting on API endpoints (resource exhaustion)
- No per-user rate limits (privilege escalation via flooding)

**Recommendations:**
- Use `slowapi` or `limits` library
- Implement: 10 requests/minute per IP for login
- Implement: 1 registration/hour per IP
- Implement: 100 requests/minute per authenticated user for general APIs
- Add Redis for distributed rate limiting

---

### No Audit Logging

**Risk:** High - Cannot track who changed what or detect unauthorized access

**Details:**
No audit trail for:
- User role changes
- Sensitive data modifications (inventory, products)
- Failed login attempts
- API access logs

**Recommendations:**
- Add `AuditLog` model tracking: `(user_id, action, resource_type, resource_id, timestamp, change_details)`
- Log on every data modification
- Log failed authentication attempts
- Archive audit logs regularly (separate from operational logs)
- Add API endpoint for managers to view audit logs

---

### No Input Validation for Numeric Ranges

**Risk:** Medium - Invalid data can corrupt business logic

**Files:** Throughout schemas, e.g., `pepper-farm/backend/schemas/pepper.py`

**Details:**
Numeric fields lack range validation:
- `HeatLevelScovilleMin`, `HeatLevelScovilleMax` - no bounds
- `WarehouseQuantity` - no upper limit
- `PAR` values - no validation of realistic ranges

This allows storing invalid data that breaks calculations and reports.

**Recommendations:**
- Add `Field(..., ge=0, le=max_value)` constraints to all numeric fields
- Define realistic ranges based on domain knowledge
- Validate relationships: `OptimalTempMinC <= OptimalTempMaxC`
- Add business rule validators (e.g., cannot allocate more than warehouse stock)

---

### No Graceful Degradation for External Services

**Risk:** Medium - Atomation API outage breaks core features

**Files:** `pepper-farm/backend/services/atomation_service.py`

**Details:**
When Atomation API is down:
- Sensor auto-sync fails completely
- No fallback or retry logic visible
- No circuit breaker pattern
- Service crashes instead of degrading

**Recommendations:**
- Implement circuit breaker (stop retrying after N failures)
- Add exponential backoff for retries
- Degrade gracefully: skip Atomation sync but continue with local sensors
- Cache last successful Atomation sync
- Send alerts to operators instead of crashing

---

## Dependency Risks

### Outdated or Vulnerable Dependencies

**Risk:** Medium - May contain known security vulnerabilities

**Files:** `pepper-farm/backend/requirements.txt`

**Key Concerns:**
- `passlib==1.7.4` (very old, from 2017 era)
- `python-jose==3.5.0` (last updated 2019)
- `APScheduler==3.11.2` (may have race condition issues with concurrent jobs)

**Recommendations:**
- Upgrade to latest patch versions: `passlib>=1.8.0`, `python-jose>=3.5.0`
- Run `pip-audit` or `safety check` in CI/CD pipeline
- Set up Dependabot or Renovate to auto-update dependencies
- Add version constraints: `passlib>=1.8.0,<2.0.0` to allow patches but prevent major breaks

---

### Missing Validation on Atomation Credentials

**Risk:** Medium - Silent failure if credentials are invalid

**Files:** `pepper-farm/backend/services/atomation_service.py` (lines 22-30)

**Details:**
```python
self.email = os.getenv("ATOMATION_EMAIL")
self.password = os.getenv("ATOMATION_PASSWORD")
```

If these env vars are missing or invalid, the service loads silently and fails later during token generation.

**Recommendations:**
- Validate credentials at service initialization
- Test Atomation API connection on startup
- Raise exception immediately if credentials are invalid
- Log clear error message for operators

---

## Missing Observability

### No Structured Logging

**Risk:** Medium - Difficult to debug production issues

**Details:**
Codebase uses `print()` and default exception handling. There's no:
- Structured logging format (JSON)
- Log levels (DEBUG, INFO, WARN, ERROR)
- Request tracing (correlation IDs)
- Performance metrics

**Recommendations:**
- Use `loguru` or `structlog` for structured logging
- Add logging at entry/exit of all service methods
- Log all errors with stack traces
- Use correlation IDs to trace requests across services
- Set up log aggregation (ELK Stack, Datadog, etc.)

---

### No Performance Monitoring

**Risk:** Medium - Cannot detect slowdowns until users complain

**Details:**
No metrics for:
- API response times
- Database query duration
- Memory/CPU usage
- Queue depths (APScheduler jobs)

**Recommendations:**
- Add timing middleware: measure request duration
- Log slow queries (>1 second)
- Use Prometheus for metrics collection
- Set up dashboards for capacity planning

---

## Scaling Limits

### Single-threaded Sensor Sync Scheduler

**Risk:** Medium - Cannot handle many sensors without delays

**Files:** `pepper-farm/backend/services/sensor_auto_sync_service.py`

**Details:**
APScheduler runs sensor sync in a single thread. If sensor list grows, sync interval extends and real-time monitoring suffers.

**Recommendations:**
- Switch to concurrent.futures for parallel sensor syncing
- Make sync interval configurable per sensor
- Use message queue (Celery) for truly scalable sync
- Monitor sync job duration and alert if exceeds interval

---

### Frontend State Management at Component Level

**Risk:** Medium - Cannot efficiently handle large data volumes

**Details:**
Frontend stores all data in component state (useState). With thousands of records:
- Rendering becomes slow
- Memory usage grows
- Re-renders are expensive
- Filtering/sorting runs in-memory on full dataset

**Recommendations:**
- Implement server-side pagination
- Add virtual scrolling for large lists
- Use React Query or SWR for data caching
- Consider Redux/Zustand for global state

---

## Summary: Priority Recommendations

### Critical (Fix Immediately)
1. **Remove hardcoded JWT secret** - allows account takeover
2. **Restrict CORS origins** - prevents cross-site attacks
3. **Move JWT tokens to HttpOnly cookies** - prevents XSS token theft

### High Priority (Next Sprint)
1. **Add rate limiting** to login/registration/APIs
2. **Add audit logging** for compliance
3. **Implement E2E tests** for core workflows
4. **Add file upload size limits**

### Medium Priority (Next 2 Sprints)
1. **Fix N+1 queries** in inventory service
2. **Consolidate error handling** patterns
3. **Refactor large components** (sensors page)
4. **Upgrade vulnerable dependencies**
5. **Improve weak password requirements**

### Low Priority (Ongoing)
1. **Add structured logging** across codebase
2. **Optimize database indexes**
3. **Refactor hard-coded plant ID in task description**
4. **Add graceful degradation** for Atomation API

---

*Concerns audit: 2026-05-16*
