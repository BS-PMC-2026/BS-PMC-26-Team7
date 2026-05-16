# Technology Stack

**Analysis Date:** 2026-05-16

## Languages

**Primary:**
- TypeScript 5 - Frontend components and pages in `pepper-farm/frontend/src`
- Python 3.14.0 - Backend API and services in `pepper-farm/backend`

**Secondary:**
- JavaScript - Frontend build configuration
- SQL - Database schema in `pepper-farm/database/schema`

## Runtime

**Environment:**
- Node.js v24.5.0 - Frontend development and build
- Python 3.14.0 - Backend API server

**Package Manager:**
- npm - JavaScript/TypeScript dependencies (root and `pepper-farm/frontend`)
- pip - Python dependencies in `pepper-farm/backend`
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Next.js 15.3.6 - React-based frontend framework in `pepper-farm/frontend`
- FastAPI 0.135.3 - Python async web framework for REST API in `pepper-farm/backend`

**Testing:**
- Jest 30.3.0 - Frontend unit tests, configured in `pepper-farm/frontend/jest.config.ts`
- pytest 9.0.3 - Backend tests in `pepper-farm/backend/tests`
- Vitest 4.1.5 - Alternative test runner (also listed in root devDependencies)

**Build/Dev:**
- Tailwind CSS 4.2.2 - Utility-first CSS framework in `pepper-farm/frontend`
- PostCSS 8.5.10 - CSS transformation
- TypeScript compiler - Type checking for frontend

## Key Dependencies

**Frontend UI:**
- React 19.0.0 - UI library
- React DOM 19.0.0 - React web rendering
- Lucide React 1.11.0 - Icon components
- Framer Motion 12.38.0 - Animation library
- Recharts 3.8.1 - Chart/data visualization library

**Frontend Data & Export:**
- html2canvas 1.4.1 - Screenshot/canvas export
- jspdf 4.2.1 - PDF generation
- xlsx 0.18.5 - Excel file export

**Frontend Styling:**
- Tailwind CSS 4.2.2 - Utility CSS
- Lightning CSS 1.32.0 - CSS compiler with platform-specific builds

**Backend Database:**
- SQLAlchemy 2.0.49 - Python ORM for database abstraction in `pepper-farm/backend`
- pyodbc 5.3.0 - ODBC driver for SQL Server/Azure SQL Database

**Backend HTTP/API:**
- httpx 0.28.1 - Async HTTP client for external APIs (Atomation) in `pepper-farm/backend/services/atomation_service.py`
- requests 2.32.3 - Additional HTTP client library
- Uvicorn 0.44.0 - ASGI server for FastAPI in `pepper-farm/backend`

**Backend Authentication:**
- python-jose 3.5.0 - JWT token creation/validation in `pepper-farm/backend/utils/jwt.py`
- passlib 1.7.4 - Password hashing library
- bcrypt 4.0.1 - Cryptographic hashing
- python-multipart 0.0.26 - Form data parsing

**Backend Utilities:**
- pydantic 2.12.5 - Data validation and settings management
- python-dotenv 1.2.2 - Environment variable loading
- email-validator 2.3.0 - Email validation
- APScheduler 3.11.2 - Task scheduling for sensor sync in `pepper-farm/backend/services/sensor_auto_sync_service.py`
- sse-starlette 3.4.3 - Server-sent events (websocket-like streaming)
- cryptography 43.0.3 - Cryptographic operations

**Testing Libraries:**
- @testing-library/react 16.3.2 - React component testing
- @testing-library/jest-dom 6.9.1 - Jest DOM matchers
- @testing-library/user-event 14.6.1 - User event simulation
- jest-environment-jsdom 30.3.0 - DOM environment for Jest
- ts-jest 29.4.9 - TypeScript support for Jest

## Configuration

**Frontend Environment:**
- `.env.local` / `.env*` files in `pepper-farm/frontend/` - Frontend configuration
- Key vars: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:8000`)

**Backend Environment:**
- `.env` file in `pepper-farm/backend/` - Backend configuration loaded by `python-dotenv`
- Critical vars: `DATABASE_URL`, `ATOMATION_EMAIL`, `ATOMATION_PASSWORD`, `SECRET_KEY`, `SMTP_*` variables

**Build:**
- `pepper-farm/frontend/next.config.ts` - Next.js configuration with API rewrites to backend
- `pepper-farm/frontend/tsconfig.json` - TypeScript compiler options (target ES2017, path alias `@/*`)
- `pepper-farm/backend/requirements.txt` - Python dependencies

## Platform Requirements

**Development:**
- Node.js v24.5.0 (or compatible)
- Python 3.14.0 (or compatible 3.x)
- npm or equivalent package manager

**Database:**
- SQL Server or compatible database (referenced as DATABASE_URL with SQL Server syntax)
- ODBC driver installation required on system for pyodbc connection

**Production:**
- Frontend: Static Next.js build deployable to any Node.js hosting
- Backend: Python ASGI server (Uvicorn) on port 8000
- Environment: Linux/macOS/Windows with Python 3.x and database connectivity

---

*Stack analysis: 2026-05-16*
