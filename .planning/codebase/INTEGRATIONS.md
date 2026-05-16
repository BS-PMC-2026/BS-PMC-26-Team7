# External Integrations

**Analysis Date:** 2026-05-16

## APIs & External Services

**Atomation (Agricultural IoT Platform):**
- Service: Sensor data aggregation and management API
- What it's used for: Fetching historical sensor readings from IoT devices
- SDK/Client: httpx (async HTTP client) in `pepper-farm/backend/services/atomation_service.py`
- Auth: Email/password credentials stored in env vars
  - `ATOMATION_EMAIL` - Account email
  - `ATOMATION_PASSWORD` - Account password
  - `ATOMATION_BEARER_TOKEN` - Optional cached JWT token
- Base URL: `https://atapi.atomation.net/api/v1/s2s/v1_0` (configurable via `ATOMATION_API_BASE_URL`)
- API Version: Atomation S2S API v1.0
- Key operations: `get_sensor_readings` endpoint for fetching historical data with pagination
- Token handling: Automatic login with cached token refresh on expiry

**Google Maps:**
- Service: Location mapping and coordinates
- What it's used for: Converting lat/lng coordinates to map URLs for sensor location viewing
- Implementation: Simple URL format in `pepper-farm/frontend/src/app/manager/sensors/page.tsx`
- Format: `https://maps.google.com/?q={lat},{lng}`

## Data Storage

**Databases:**
- SQL Server / Azure SQL Database
  - Connection: `DATABASE_URL` environment variable (ODBC connection string)
  - Client: SQLAlchemy 2.0.49 with pyodbc driver
  - ORM: SQLAlchemy declarative models in `pepper-farm/backend/models/`
  - Location: Database configuration in `pepper-farm/backend/database.py`
  - Schema: SQL scripts in `pepper-farm/database/schema/` with tables for Users, Plants, Sensors, Tasks, Products, Inventory, Peppers, SprayReports, etc.

**File Storage:**
- Local filesystem
  - Upload directory: `pepper-farm/backend/uploads/` (created at runtime)
  - Subdirectories: `pepper-farm/backend/uploads/pepper_images/` for pepper photos
  - Served via: Static file mounting at `/uploads` route
  - Frontend references: Image URLs can be HTTP/HTTPS or `/uploads/` paths

**Caching:**
- In-memory token caching
  - Atomation API bearer token cached in `AtomationService._cached_token` (class variable)
  - Token refresh triggered on 401 or JWT expiry detection

## Authentication & Identity

**Auth Provider:**
- Custom implementation with JWT
- Implementation approach:
  - User registration/login via `pepper-farm/backend/routers/auth.py`
  - Password hashing with bcrypt in `pepper-farm/backend/services/auth_service.py`
  - JWT tokens created with `python-jose` in `pepper-farm/backend/utils/jwt.py`
  - Algorithm: HS256 with `SECRET_KEY` from environment
  - Token expiry: 60 minutes (EXPIRE_MINUTES)
  - Role-based access control via JWT payload (`role` claim)

**Authorization:**
- Role-based: FarmManager, Worker, Visitor defined in database
- Dependency injection: `get_current_user()`, `require_role()`, `require_any_role()` in `pepper-farm/backend/utils/jwt.py`
- Token validation: JWT decoded and validated on each protected endpoint

## Monitoring & Observability

**Error Tracking:**
- None detected - standard HTTP exception handling

**Logs:**
- Standard output via logging (Python default)
- Database health check endpoint: `GET /api/health/db` in `pepper-farm/backend/main.py`

**Sensor Alerts:**
- Alert model in `pepper-farm/backend/models/sensor.py`
- Frontend notifications via `AnomalyNotificationContext` in `pepper-farm/frontend/src/context/AnomalyNotificationContext.tsx`

## CI/CD & Deployment

**Hosting:**
- Not detected in codebase (infrastructure as code not present)
- Local development: Frontend on `http://localhost:3000` (Next.js dev server), Backend on `http://127.0.0.1:8000` (Uvicorn)

**CI Pipeline:**
- None detected in codebase

**Deployment Scripts:**
- Data backfill script: `pepper-farm/backend/scripts/backfill_par.py` for database initialization
- Setup scripts in root `package.json`:
  - `setup` - Installs all dependencies
  - `setup:frontend` - npm install in frontend
  - `setup:backend` - pip install Python requirements
- Development: `dev` command runs both frontend and backend concurrently

## Environment Configuration

**Required env vars - Backend (`pepper-farm/backend/.env`):**
- `DATABASE_URL` - CRITICAL: Database connection string (ODBC format)
- `ATOMATION_EMAIL` - CRITICAL: Atomation API account email
- `ATOMATION_PASSWORD` - CRITICAL: Atomation API account password
- `SECRET_KEY` - CRITICAL: JWT signing key (defaults to "dev-secret-key" if missing)
- `ATOMATION_BEARER_TOKEN` (optional) - Pre-cached JWT token to avoid login
- `ATOMATION_API_BASE_URL` (optional) - Custom Atomation API endpoint
- `ATOMATION_APP_VERSION` (optional) - API version string (defaults to "3.3.6 + 118")
- `ATOMATION_ACCESS_TYPE` (optional) - API access type (defaults to "5")
- `SMTP_HOST` (optional) - SMTP server for email export
- `SMTP_PORT` (optional) - SMTP port (defaults to 587)
- `SMTP_USER` (optional) - SMTP authentication username
- `SMTP_PASSWORD` (optional) - SMTP authentication password
- `SMTP_FROM` (optional) - Sender email address (defaults to SMTP_USER)

**Required env vars - Frontend (`pepper-farm/frontend/.env.local`):**
- `NEXT_PUBLIC_API_URL` (optional) - Backend API URL (defaults to `http://localhost:8000`)
- `NEXT_PUBLIC_API_BASE_URL` (optional) - Alternative backend URL (defaults to `http://127.0.0.1:8000`)

**Secrets location:**
- Backend: `.env` file in `pepper-farm/backend/` (loaded by `python-dotenv` in `atomation_service.py`)
- Frontend: `.env.local` or `.env*` files in `pepper-farm/frontend/`
- Version control: Both `.env*` files should be in `.gitignore`

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- Email export notifications: SMTP-based email sending in `pepper-farm/backend/routers/sensors.py`
  - Endpoint: POST `/api/sensors/export/email`
  - Payload: Base64-encoded file attachments and recipient email
- Server-sent events: sse-starlette integration for real-time notifications (dependency present, specific endpoints not confirmed)

---

*Integration audit: 2026-05-16*
