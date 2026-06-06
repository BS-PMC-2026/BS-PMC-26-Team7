# PROJECT_CONTEXT.md

> Navigation map for the Pepper Farm Management System. Read this before touching any file.
> Auto-generated sections are wrapped in `<!-- AUTO-GENERATED-START/END -->` markers.
> Everything outside those markers is manually maintained — do not overwrite.

---

## 1. Project Overview

A full-stack farm management system for a pepper-growing operation. It lets **Farm Managers** monitor IoT sensors in real time, detect anomalies, assign tasks to workers, and manage inventory/products/peppers. **Workers** view their assigned tasks, complete checklists, and submit pesticide spray reports. A public **Visitor** landing page presents farm products.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| Backend | FastAPI, SQLAlchemy 2.0, Uvicorn |
| Database | Microsoft SQL Server (Azure SQL) via pyodbc |
| IoT | Atomation sensor API (external) |
| Real-time | Server-Sent Events (SSE) via `sse-starlette` |
| Scheduler | APScheduler (sensor auto-sync) |
| Auth | JWT (`python-jose`), `passlib`/`bcrypt` |
| Email | SMTP (Gmail) |
| Testing (BE) | pytest |
| Testing (FE) | Jest + `@testing-library/react`, Playwright (E2E) |
| Deployment | Azure App Service (backend) + Azure Web Apps (frontend) |
| Charts | Recharts |
| Export | html2canvas, jsPDF, xlsx |
| Animations | Framer Motion |

---

## 3. Repository Structure

```
BS-PMC-26-Team7/
├── package.json                     # Root scripts: setup, dev, dev:frontend, dev:backend
├── PROJECT_CONTEXT.md               # This file
├── scripts/
│   └── generate_project_context.py  # Auto-updates AUTO-GENERATED sections below
├── pepper-farm/
│   ├── backend/                     # FastAPI application
│   │   ├── main.py                  # App entry point, router registration, CORS
│   │   ├── database.py              # SQLAlchemy engine + session factory
│   │   ├── models/                  # SQLAlchemy ORM models (one file per domain)
│   │   ├── schemas/                 # Pydantic request/response schemas
│   │   ├── routers/                 # FastAPI route handlers (one file per domain)
│   │   ├── services/                # Business logic layer
│   │   ├── utils/                   # JWT helpers, auth decorators
│   │   ├── tests/                   # pytest test files
│   │   └── requirements.txt
│   ├── frontend/                    # Next.js application
│   │   ├── src/
│   │   │   ├── app/                 # Next.js App Router pages + layouts
│   │   │   ├── components/          # Reusable React components
│   │   │   ├── services/            # API client functions (one file per domain)
│   │   │   ├── types/               # TypeScript interfaces
│   │   │   ├── context/             # React Context (global state)
│   │   │   ├── lib/                 # Utility helpers (alertToTask, constants, etc.)
│   │   │   └── i18n/               # Internationalization config
│   │   ├── tests/                   # Jest unit/integration tests
│   │   ├── e2e/                     # Playwright E2E tests
│   │   └── package.json
│   └── database/
│       ├── schema/                  # CREATE TABLE SQL files
│       ├── migrations/              # Alembic migration files
│       ├── seed/                    # Initial seed data scripts
│       └── procedures/              # SQL stored procedures
```

---

## 4. Frontend Map

| Route | File | Purpose | Key API Calls | Main Components |
|---|---|---|---|---|
| `/` | `src/app/page.tsx` | Visitor landing page | Products, Peppers | LandingNavbar, hero sections |
| `/login` | `src/app/login/page.tsx` | Login | `POST /api/auth/login` | LoginForm |
| `/register` | `src/app/register/page.tsx` | Registration | `POST /api/auth/register` | RegisterForm |
| `/visitor` | `src/app/visitor/page.tsx` | Visitor homepage | Products, Peppers | LandingNavbar |
| `/manager` | `src/app/manager/page.tsx` | Manager dashboard | anomalies summary, zones, trends, tasks | AnomalySummaryCards, RecentAlerts, zone health |
| `/manager/anomalies` | `src/app/manager/anomalies/page.tsx` | Alert management | `/api/manager/anomalies/*` | AnomalySummaryCards, RecentAlerts, SSE stream |
| `/manager/sensors` | `src/app/manager/sensors/page.tsx` | Sensor monitoring | `/api/sensors/*` | SensorCard, SensorMap |
| `/manager/tasks` | `src/app/manager/tasks/page.tsx` | Task management | `/api/tasks/*` | TaskCard, TaskForm, TaskFilters, CompletedTasksHistory |
| `/manager/inventory` | `src/app/manager/inventory/page.tsx` | Inventory management | `/api/inventory/*` | InventoryReport |
| `/manager/map` | `src/app/manager/map/page.tsx` | Farm map (plant assignment) | Zones, Plants | FarmMap |
| `/manager/spray-map` | `src/app/manager/spray-map/page.tsx` | **US28** Spray safety map — zone spray status, last spray date, re-entry windows | `GET /api/spray-reports/zone-map` | SprayZoneMap |
| `/manager/peppers` | `src/app/manager/peppers/page.tsx` | Pepper variety CRUD | `/api/peppers/*` | PepperCard, PepperForm, DeletePepperModal |
| `/manager/products` | `src/app/manager/products/page.tsx` | Product catalog | `/api/products/*` | ProductCard (shared across all catalog screens) |
| `/manager/products/create` | `src/app/manager/products/create/page.tsx` | **US38** Create product — includes discount controls: active toggle, percentage input, optional start/end datetime | `POST /api/products` | discount fields section |
| `/manager/products/[id]/edit` | `src/app/manager/products/[productId]/edit/page.tsx` | **US38** Edit product — same discount controls; existing discount dates loaded and displayed in local time | `GET /api/products/{id}`, `PUT /api/products/{id}` | discount fields section |
| `/manager/reports` | `src/app/manager/reports/page.tsx` | Reports & export | `/api/tasks/report`, `/api/inventory/report` | ExportModal |
| `/manager/users` | `src/app/manager/users/page.tsx` | User role management | `/api/users/*` | UserRoleTable |
| `/worker` | `src/app/worker/page.tsx` | **US37** Worker Dashboard — three-column layout: task panel with overdue/due-soon/normal urgency groups + modal, farm map with Tasks/Sprays/Planting mode selector (sectionColors fill override), notifications panel (unread-only, per-item dismiss via `PUT /read`), analytics row. Planting mode includes an inline Plants Registry: map popups show plant ID/code/status, workers can update plant status, add plants to Nursery, and transfer healthy Nursery plants to greenhouses. Sprays mode shows a spray overview above the map, an entry-status legend strip between map and Zone Entry Details, and the collapsible Zone Entry Details table. | `/api/tasks/my`, `/api/notifications`, `PUT /api/notifications/{id}/read`, `PUT /api/notifications/mark-all-read`, `/api/spray-reports/restricted-zones`, `/api/worker/analytics`, `GET /api/inventory/by-variety`, `GET /api/zones`, `POST /api/plants`, `PUT /api/plants/{id}/status`, `PUT /api/plants/{id}/location` | FarmMap (`sectionColors` prop), TaskDetailModal, Plants Registry |
| `/worker/inventory` | `src/app/worker/inventory/page.tsx` | View inventory | `/api/inventory/*` | InventoryReport (read-only) |
| `/visitor/products` | `src/app/visitor/products/page.tsx` | **US38** Public product catalog — shows discount badge, strikethrough original price, discounted price, expiry or "unlimited offer" label for each active discount | `GET /api/products` | ProductCard |
| `/worker/products` | `src/app/worker/products/page.tsx` | **US38** Worker product catalog — same discount display as visitor catalog | `GET /api/products` | ProductCard |
| `/profile` | `src/app/profile/page.tsx` | **US40** Email subscription toggle for authenticated users — shows current consent status, checkbox to enable/disable marketing emails | `GET/PUT /api/email-consent/me` | ProfilePage (inline) |
| `/unsubscribe` | `src/app/unsubscribe/page.tsx` | **US40** Public one-click unsubscribe — validates token, calls backend, shows success/already/invalid states | `GET /api/email-consent/unsubscribe?token=` | UnsubscribePage (inline), Suspense |
| `/manager/newsletter` | `src/app/manager/newsletter/page.tsx` | **US39** Manager newsletter template manager — list/create/edit/preview/send templates, view email logs. Structured content blocks (heading, paragraph, image, button, divider). Templates saved without SMTP; send uses existing email service. | `GET/POST /api/newsletter-templates`, `GET/PUT/DELETE /api/newsletter-templates/{id}`, `GET /api/newsletter-templates/{id}/preview`, `POST /api/newsletter-templates/{id}/send`, `GET /api/emails/logs` | NewsletterPage (inline), BlockEditor (inline) |
| `/manager/spray-alerts` | `src/app/manager/spray-alerts/page.tsx` | **US30** Redirect only — immediately sends to `/manager/spray-map#spray-alerts` (keeps old bookmarks working) | — | — |
| `/manager/spray-map` _(extended)_ | `src/app/manager/spray-map/page.tsx` | **US28 + US30 + US32** Spray safety map (zones) + Spray Alert History + Overdue Spray Alerts section (`id="overdue-spray-alerts"`) with assign-task modal | `GET /api/spray-reports/zone-map`, `GET /api/spray-reports/alerts`, `GET /api/spray-reports/overdue-alerts`, `POST /api/spray-reports/overdue-alerts/{id}/assign` | SprayZoneMap, spray-alerts table, overdue-alerts table, AssignModal |
| `/worker/spray-restrictions` | `src/app/worker/spray-restrictions/page.tsx` | **US31 + US33** Read-only spray restriction map for workers — shows which zones are restricted + explicit entry permission status (allowed / restricted / caution / planned_warning / no_data) | `GET /api/spray-reports/restricted-zones` | SprayZoneMap, restriction banner, entry permission column, zone table |
| `/visitor/spray-restrictions` | `src/app/visitor/spray-restrictions/page.tsx` | **US31 + US33** Read-only spray restriction map — **publicly accessible, no login required**. Public safety information: which zones are restricted after spraying + entry permission status | `GET /api/spray-reports/public-restricted-zones` _(no auth)_ | SprayZoneMap, restriction banner, entry permission column, zone table |

**Proxy architecture:** The frontend calls `/api/...` relative paths. `next.config.ts` rewrites these to `API_PROXY_TARGET` (localhost:8000 in dev, Azure in prod), eliminating CORS.

---

## 5. Backend Map

| Domain | Router | Service | Model | Schema | Prefix |
|---|---|---|---|---|---|
| Auth | `routers/auth.py` | `services/auth_service.py` | `models/user.py` | `schemas/user.py` | `/api/auth` |
| Emails | `routers/emails.py` | `services/email_service.py` | `models/email_log.py` | `schemas/email.py` | `/api/emails` |
| Newsletter Templates | `routers/newsletter_templates.py` | `services/newsletter_template_service.py` | `models/newsletter_template.py` | `schemas/newsletter_template.py` | `/api/newsletter-templates` |
| Email Consent | `routers/email_consent.py` | `services/email_unsubscribe.py` | _(raw SQL on Users)_ | `schemas/email_consent.py` | `/api/email-consent` |
| In-App Notifications | `routers/notifications.py` | _(inline)_ | `models/notification.py` | `schemas/notification.py` | `/api/notifications` |
| Users | `routers/users.py` | `services/user_service.py` | `models/user.py` | `schemas/user.py` | `/api/users` |
| Tasks | `routers/tasks.py` | `services/task_service.py` | `models/task.py` | `schemas/task.py` | `/api/tasks` |
| Peppers | `routers/peppers.py` | `services/pepper_service.py` | `models/pepper.py` | `schemas/pepper.py` | `/api/peppers` |
| Plants | `routers/plants.py` | `services/plant_service.py` | `models/plant.py` | `schemas/plant.py` | `/api/plants` |
| Products | `routers/products.py` | `services/product_service.py` | `models/product.py` | `schemas/product.py` | `/api/products` |
| Inventory | `routers/inventory.py` | `services/inventory_service.py` | `models/inventory.py` | `schemas/inventory.py` | `/api/inventory` |
| Zones | `routers/zones.py` | _(inline)_ | `models/farm_zone.py` | — | `/api/zones` |
| Sensors | `routers/sensors.py` | `services/sensor_service.py` + `atomation_service.py` | `models/sensor.py` | `schemas/sensor.py` | `/api/sensors` |
| Sensor Readings | `routers/sensor_readings.py` | `services/anomaly_detection_service.py` | `models/sensor_reading.py` | `schemas/sensor_reading.py` | `/api/sensor-readings` |
| Anomalies | `routers/anomalies.py` | `services/recurrence_detection_service.py` | `models/sensor_alert.py` | `schemas/sensor.py` | `/api/manager/anomalies` |
| Sensor Alerts | `routers/anomalies.py` | — | `models/sensor_alert.py` | — | `/api/sensor-alerts` |
| Spray Reports / Map | `routers/spray.py` | `services/spray_service.py` | `models/spray.py` | `schemas/spray.py` | `/api/spray-reports` |
| Health | `main.py` | — | — | — | `/api/health` |
| Worker Analytics | `routers/worker_dashboard.py` | `services/worker_dashboard_service.py` | `models/task.py` | `schemas/worker_dashboard.py` | `/api/worker` |

---

## 6. API Endpoint Index

<!-- AUTO-GENERATED-START:endpoints -->
| Method | Path | Router File | Purpose |
|---|---|---|---|
| GET | `/api/analytics/product-statistics` | `pepper-farm/backend/routers/analytics.py` |  |
| GET | `/api/analytics/task-statistics` | `pepper-farm/backend/routers/analytics.py` |  |
| POST | `/api/auth/login` | `pepper-farm/backend/routers/auth.py` |  |
| POST | `/api/auth/register` | `pepper-farm/backend/routers/auth.py` |  |
| POST | `/api/auth/token` | `pepper-farm/backend/routers/auth.py` |  |
| DELETE | `/api/cart/clear` | `pepper-farm/backend/routers/cart.py` |  |
| DELETE | `/api/cart/items/{cart_item_id}` | `pepper-farm/backend/routers/cart.py` |  |
| PUT | `/api/cart/items/{cart_item_id}` | `pepper-farm/backend/routers/cart.py` |  |
| POST | `/api/cart/items` | `pepper-farm/backend/routers/cart.py` |  |
| GET | `/api/cart` | `pepper-farm/backend/routers/cart.py` |  |
| POST | `/api/chatbot` | `pepper-farm/backend/routers/chatbot.py` |  |
| POST | `/api/checkout/pay` | `pepper-farm/backend/routers/checkout.py` |  |
| POST | `/api/checkout/preview` | `pepper-farm/backend/routers/checkout.py` |  |
| POST | `/api/coupons/validate` | `pepper-farm/backend/routers/coupons.py` |  |
| DELETE | `/api/coupons/{coupon_id}` | `pepper-farm/backend/routers/coupons.py` |  |
| PUT | `/api/coupons/{coupon_id}` | `pepper-farm/backend/routers/coupons.py` |  |
| GET | `/api/coupons` | `pepper-farm/backend/routers/coupons.py` |  |
| POST | `/api/coupons` | `pepper-farm/backend/routers/coupons.py` |  |
| GET | `/api/email-consent/me` | `pepper-farm/backend/routers/email_consent.py` |  |
| PUT | `/api/email-consent/me` | `pepper-farm/backend/routers/email_consent.py` |  |
| GET | `/api/email-consent/unsubscribe` | `pepper-farm/backend/routers/email_consent.py` |  |
| GET | `/api/emails/logs` | `pepper-farm/backend/routers/emails.py` |  |
| POST | `/api/emails/send-newsletter` | `pepper-farm/backend/routers/emails.py` |  |
| DELETE | `/api/employee-discounts/overrides/{override_id}` | `pepper-farm/backend/routers/employee_discount.py` |  |
| GET | `/api/employee-discounts/overrides` | `pepper-farm/backend/routers/employee_discount.py` |  |
| POST | `/api/employee-discounts/overrides` | `pepper-farm/backend/routers/employee_discount.py` |  |
| GET | `/api/employee-discounts/settings` | `pepper-farm/backend/routers/employee_discount.py` |  |
| PUT | `/api/employee-discounts/settings` | `pepper-farm/backend/routers/employee_discount.py` |  |
| GET | `/api/health/db` | `pepper-farm/backend/main.py` |  |
| GET | `/api/inventory/by-variety` | `pepper-farm/backend/routers/inventory.py` |  |
| GET | `/api/inventory/report` | `pepper-farm/backend/routers/inventory.py` |  |
| GET | `/api/inventory/{inventory_id}` | `pepper-farm/backend/routers/inventory.py` |  |
| PUT | `/api/inventory/{inventory_id}` | `pepper-farm/backend/routers/inventory.py` |  |
| GET | `/api/inventory` | `pepper-farm/backend/routers/inventory.py` |  |
| POST | `/api/inventory` | `pepper-farm/backend/routers/inventory.py` |  |
| GET | `/api/manager/anomalies/by-zone` | `pepper-farm/backend/routers/anomalies.py` |  |
| GET | `/api/manager/anomalies/recent` | `pepper-farm/backend/routers/anomalies.py` |  |
| GET | `/api/manager/anomalies/recurrence-config` | `pepper-farm/backend/routers/anomalies.py` |  |
| PATCH | `/api/manager/anomalies/recurrence-config` | `pepper-farm/backend/routers/anomalies.py` |  |
| GET | `/api/manager/anomalies/stream` | `pepper-farm/backend/routers/anomalies.py` |  |
| GET | `/api/manager/anomalies/summary` | `pepper-farm/backend/routers/anomalies.py` |  |
| GET | `/api/manager/anomalies/trends` | `pepper-farm/backend/routers/anomalies.py` |  |
| POST | `/api/manager/weather/ai-recommendation` | `pepper-farm/backend/routers/weather.py` |  |
| GET | `/api/manager/weather` | `pepper-farm/backend/routers/weather.py` |  |
| POST | `/api/newsletter-templates/upload-image` | `pepper-farm/backend/routers/newsletter_templates.py` |  |
| GET | `/api/newsletter-templates/{template_id}/preview` | `pepper-farm/backend/routers/newsletter_templates.py` |  |
| POST | `/api/newsletter-templates/{template_id}/send` | `pepper-farm/backend/routers/newsletter_templates.py` |  |
| DELETE | `/api/newsletter-templates/{template_id}` | `pepper-farm/backend/routers/newsletter_templates.py` |  |
| GET | `/api/newsletter-templates/{template_id}` | `pepper-farm/backend/routers/newsletter_templates.py` |  |
| PUT | `/api/newsletter-templates/{template_id}` | `pepper-farm/backend/routers/newsletter_templates.py` |  |
| GET | `/api/newsletter-templates` | `pepper-farm/backend/routers/newsletter_templates.py` |  |
| POST | `/api/newsletter-templates` | `pepper-farm/backend/routers/newsletter_templates.py` |  |
| POST | `/api/notifications/announce` | `pepper-farm/backend/routers/notifications.py` |  |
| POST | `/api/notifications/broadcast` | `pepper-farm/backend/routers/notifications.py` |  |
| PUT | `/api/notifications/mark-all-read` | `pepper-farm/backend/routers/notifications.py` |  |
| GET | `/api/notifications/unread-count` | `pepper-farm/backend/routers/notifications.py` |  |
| PUT | `/api/notifications/{notification_id}/read` | `pepper-farm/backend/routers/notifications.py` |  |
| GET | `/api/notifications` | `pepper-farm/backend/routers/notifications.py` |  |
| GET | `/api/orders/all` | `pepper-farm/backend/routers/orders.py` |  |
| GET | `/api/orders/{order_id}` | `pepper-farm/backend/routers/orders.py` |  |
| GET | `/api/orders` | `pepper-farm/backend/routers/orders.py` |  |
| POST | `/api/payments/paypal/capture-order` | `pepper-farm/backend/routers/payments.py` |  |
| GET | `/api/payments/paypal/config` | `pepper-farm/backend/routers/payments.py` |  |
| POST | `/api/payments/paypal/create-order` | `pepper-farm/backend/routers/payments.py` |  |
| POST | `/api/peppers/upload-image` | `pepper-farm/backend/routers/peppers.py` |  |
| DELETE | `/api/peppers/{pepper_id}` | `pepper-farm/backend/routers/peppers.py` |  |
| GET | `/api/peppers/{pepper_id}` | `pepper-farm/backend/routers/peppers.py` |  |
| PUT | `/api/peppers/{pepper_id}` | `pepper-farm/backend/routers/peppers.py` |  |
| GET | `/api/peppers` | `pepper-farm/backend/routers/peppers.py` |  |
| POST | `/api/peppers` | `pepper-farm/backend/routers/peppers.py` |  |
| PUT | `/api/plants/{plant_id}/location` | `pepper-farm/backend/routers/plants.py` |  |
| PUT | `/api/plants/{plant_id}/status` | `pepper-farm/backend/routers/plants.py` |  |
| GET | `/api/plants/{plant_id}` | `pepper-farm/backend/routers/plants.py` |  |
| GET | `/api/plants` | `pepper-farm/backend/routers/plants.py` |  |
| POST | `/api/plants` | `pepper-farm/backend/routers/plants.py` |  |
| DELETE | `/api/products/{product_id}` | `pepper-farm/backend/routers/products.py` |  |
| GET | `/api/products/{product_id}` | `pepper-farm/backend/routers/products.py` |  |
| PUT | `/api/products/{product_id}` | `pepper-farm/backend/routers/products.py` |  |
| GET | `/api/products` | `pepper-farm/backend/routers/products.py` |  |
| POST | `/api/products` | `pepper-farm/backend/routers/products.py` |  |
| POST | `/api/sensor-readings` | `pepper-farm/backend/routers/sensor_readings.py` |  |
| POST | `/api/sensors/auto-sync/run-now` | `pepper-farm/backend/routers/sensors.py` |  |
| POST | `/api/sensors/export/email` | `pepper-farm/backend/routers/sensors.py` |  |
| POST | `/api/sensors/sync` | `pepper-farm/backend/routers/sensors.py` |  |
| GET | `/api/sensors/{sensor_id}/alerts` | `pepper-farm/backend/routers/sensors.py` |  |
| GET | `/api/sensors/{sensor_id}/latest` | `pepper-farm/backend/routers/sensors.py` |  |
| POST | `/api/sensors/{sensor_id}/live` | `pepper-farm/backend/routers/sensors.py` |  |
| GET | `/api/sensors/{sensor_id}/readings` | `pepper-farm/backend/routers/sensors.py` |  |
| POST | `/api/sensors/{sensor_id}/refresh` | `pepper-farm/backend/routers/sensors.py` |  |
| GET | `/api/sensors` | `pepper-farm/backend/routers/sensors.py` |  |
| PATCH | `/api/spray-reports/alerts/{alert_id}/read` | `pepper-farm/backend/routers/spray.py` |  |
| GET | `/api/spray-reports/alerts/{alert_id}` | `pepper-farm/backend/routers/spray.py` |  |
| GET | `/api/spray-reports/alerts` | `pepper-farm/backend/routers/spray.py` |  |
| POST | `/api/spray-reports/overdue-alerts/{alert_id}/assign` | `pepper-farm/backend/routers/spray.py` |  |
| PATCH | `/api/spray-reports/overdue-alerts/{alert_id}/read` | `pepper-farm/backend/routers/spray.py` |  |
| GET | `/api/spray-reports/overdue-alerts` | `pepper-farm/backend/routers/spray.py` |  |
| POST | `/api/spray-reports/overdue-check/run` | `pepper-farm/backend/routers/spray.py` |  |
| GET | `/api/spray-reports/pesticides` | `pepper-farm/backend/routers/spray.py` |  |
| GET | `/api/spray-reports/public-restricted-zones` | `pepper-farm/backend/routers/spray.py` |  |
| GET | `/api/spray-reports/restricted-zones` | `pepper-farm/backend/routers/spray.py` |  |
| GET | `/api/spray-reports/zone-map` | `pepper-farm/backend/routers/spray.py` |  |
| POST | `/api/spray-reports` | `pepper-farm/backend/routers/spray.py` |  |
| GET | `/api/tasks/completed` | `pepper-farm/backend/routers/tasks.py` |  |
| GET | `/api/tasks/my` | `pepper-farm/backend/routers/tasks.py` |  |
| GET | `/api/tasks/report` | `pepper-farm/backend/routers/tasks.py` |  |
| DELETE | `/api/tasks/{task_id}/checklist/{item_id}` | `pepper-farm/backend/routers/tasks.py` |  |
| PATCH | `/api/tasks/{task_id}/checklist/{item_id}` | `pepper-farm/backend/routers/tasks.py` |  |
| POST | `/api/tasks/{task_id}/checklist` | `pepper-farm/backend/routers/tasks.py` |  |
| DELETE | `/api/tasks/{task_id}` | `pepper-farm/backend/routers/tasks.py` |  |
| PATCH | `/api/tasks/{task_id}` | `pepper-farm/backend/routers/tasks.py` |  |
| GET | `/api/tasks` | `pepper-farm/backend/routers/tasks.py` |  |
| POST | `/api/tasks` | `pepper-farm/backend/routers/tasks.py` |  |
| GET | `/api/users/search` | `pepper-farm/backend/routers/users.py` |  |
| GET | `/api/users/workers` | `pepper-farm/backend/routers/users.py` |  |
| PUT | `/api/users/{user_id}/role` | `pepper-farm/backend/routers/users.py` |  |
| GET | `/api/users` | `pepper-farm/backend/routers/users.py` |  |
| GET | `/api/worker/analytics` | `pepper-farm/backend/routers/worker_dashboard.py` |  |
| GET | `/api/zones/{zone_code}` | `pepper-farm/backend/routers/zones.py` |  |
| GET | `/api/zones` | `pepper-farm/backend/routers/zones.py` |  |
<!-- AUTO-GENERATED-END:endpoints -->

---

## 7. Database / Models Map

<!-- AUTO-GENERATED-START:models -->
| Model | Table | File | Key Fields | Relationships |
|---|---|---|---|---|
| `CartItem` | `CartItems` | `pepper-farm/backend/models/cart.py` |  |  |
| `Coupon` | `Coupons` | `pepper-farm/backend/models/coupon.py` |  |  |
| `CouponRedemption` | `CouponRedemptions` | `pepper-farm/backend/models/coupon.py` |  |  |
| `EmailLog` | `EmailLogs` | `pepper-farm/backend/models/email_log.py` |  |  |
| `EmployeeDiscountSetting` | `EmployeeDiscountSettings` | `pepper-farm/backend/models/employee_discount.py` |  |  |
| `EmployeeDiscountProductOverride` | `EmployeeDiscountProductOverrides` | `pepper-farm/backend/models/employee_discount.py` |  |  |
| `FarmZone` | `FarmZones` | `pepper-farm/backend/models/farm_zone.py` |  |  |
| `Inventory` | `Inventory` | `pepper-farm/backend/models/inventory.py` |  |  |
| `NewsletterTemplate` | `NewsletterTemplates` | `pepper-farm/backend/models/newsletter_template.py` |  |  |
| `Notification` | `Notifications` | `pepper-farm/backend/models/notification.py` |  |  |
| `Order` | `Orders` | `pepper-farm/backend/models/order.py` |  |  |
| `OrderItem` | `OrderItems` | `pepper-farm/backend/models/order.py` |  |  |
| `PaymentRecord` | `PaymentRecords` | `pepper-farm/backend/models/payment.py` |  |  |
| `PepperEditLog` | `PepperEditLog` | `pepper-farm/backend/models/pepper_edit_log.py` |  |  |
| `PepperVariety` | `PepperVarieties` | `pepper-farm/backend/models/pepper_variety.py` |  |  |
| `Plant` | `Plants` | `pepper-farm/backend/models/plant.py` |  |  |
| `Product` | `Products` | `pepper-farm/backend/models/product.py` |  |  |
| `Role` | `Roles` | `pepper-farm/backend/models/role.py` |  |  |
| `Sensor` | `Sensors` | `pepper-farm/backend/models/sensor.py` |  |  |
| `SensorAssignment` | `SensorAssignments` | `pepper-farm/backend/models/sensor.py` |  |  |
| `SensorReading` | `SensorReadings` | `pepper-farm/backend/models/sensor.py` |  |  |
| `SensorSyncState` | `SensorSyncState` | `pepper-farm/backend/models/sensor.py` |  |  |
| `SensorAlert` | `SensorAlerts` | `pepper-farm/backend/models/sensor.py` |  |  |
| `RecurrenceConfig` | `RecurrenceConfig` | `pepper-farm/backend/models/sensor.py` |  |  |
| `Pesticide` | `Pesticides` | `pepper-farm/backend/models/spray.py` |  |  |
| `SprayReport` | `SprayReports` | `pepper-farm/backend/models/spray.py` |  |  |
| `SprayAlert` | `SprayAlerts` | `pepper-farm/backend/models/spray.py` |  |  |
| `OverdueSprayAlert` | `OverdueSprayAlerts` | `pepper-farm/backend/models/spray.py` |  |  |
| `Task` | `Tasks` | `pepper-farm/backend/models/task.py` |  |  |
| `TaskChecklistItem` | `TaskChecklistItems` | `pepper-farm/backend/models/task.py` |  |  |
| `User` | `Users` | `pepper-farm/backend/models/user.py` |  |  |
<!-- AUTO-GENERATED-END:models -->

---

## 8. External Interfaces

| Service | Purpose | Env Vars | Key Files |
|---|---|---|---|
| **Atomation IoT API** | Fetches sensor readings from physical devices | `ATOMATION_API_BASE_URL`, `ATOMATION_BEARER_TOKEN`, `ATOMATION_EMAIL`, `ATOMATION_PASSWORD`, `ATOMATION_APP_VERSION`, `ATOMATION_ACCESS_TYPE` | `services/atomation_service.py`, `routers/sensors.py` |
| **Azure SQL Database** | Production database (MSSQL) | `DATABASE_URL` | `database.py` |
| **Azure App Service** | Hosts FastAPI backend in production | — | `.github/workflows/` |
| **Gmail SMTP** | Sensor data export + discount notifications + manager newsletter (US39) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | `services/email_service.py` (reusable service), `routers/sensors.py` (original export/email), `routers/emails.py` (newsletter/logs), `routers/products.py` (discount trigger) |
| **Newsletter image uploads** | Newsletter images uploaded and served as static files | `BACKEND_BASE_URL` (e.g. `https://hadinerim.azurewebsites.net`) | `routers/newsletter_templates.py` (`POST /api/newsletter-templates/upload-image`), `uploads/newsletter_images/` |

**Atomation base URL:** `https://atapi.atomation.net/api/v1/s2s/v1_0`  
**Production backend URL:** `https://hadinerim.azurewebsites.net`

---

## 9. Environment Variables

<!-- AUTO-GENERATED-START:envvars -->
| Variable | Used In (sample) | Purpose |
|---|---|---|
| `API_PROXY_TARGET` | pepper-farm/frontend/next.config.ts |  |
| `ATOMATION_ACCESS_TYPE` | pepper-farm/backend/services/atomation_service.py |  |
| `ATOMATION_API_BASE_URL` | pepper-farm/backend/services/atomation_service.py |  |
| `ATOMATION_APP_VERSION` | pepper-farm/backend/services/atomation_service.py |  |
| `ATOMATION_BEARER_TOKEN` | pepper-farm/backend/services/atomation_service.py |  |
| `ATOMATION_EMAIL` | pepper-farm/backend/services/atomation_service.py |  |
| `ATOMATION_PASSWORD` | pepper-farm/backend/services/atomation_service.py |  |
| `BACKEND_BASE_URL` | pepper-farm/backend/routers/newsletter_templates.py |  |
| `DATABASE_URL` | pepper-farm/backend/database.py |  |
| `FARM_LATITUDE` | pepper-farm/backend/services/weather_service.py |  |
| `FARM_LONGITUDE` | pepper-farm/backend/services/weather_service.py |  |
| `FRONTEND_BASE_URL` | pepper-farm/backend/services/email_unsubscribe.py |  |
| `NEXT_PUBLIC_API_BASE_URL` | pepper-farm/frontend/next.config.ts, pepper-farm/frontend/src/lib/constants.ts |  |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | pepper-farm/frontend/src/app/checkout/page.tsx |  |
| `NEXT_PUBLIC_PAYPAL_CURRENCY` | pepper-farm/backend/routers/payments.py, pepper-farm/frontend/src/app/checkout/page.tsx |  |
| `OPENAI_API_KEY` | pepper-farm/backend/services/chatbot_service.py, pepper-farm/backend/services/weather_service.py |  |
| `OPENAI_MODEL` | pepper-farm/backend/services/chatbot_service.py, pepper-farm/backend/services/weather_service.py |  |
| `OPEN_METEO_BASE_URL` | pepper-farm/backend/services/weather_service.py |  |
| `PAYPAL_API_BASE` | pepper-farm/backend/services/paypal_service.py |  |
| `PAYPAL_CLIENT_ID` | pepper-farm/backend/routers/payments.py, pepper-farm/backend/services/paypal_service.py |  |
| `PAYPAL_CLIENT_SECRET` | pepper-farm/backend/services/paypal_service.py |  |
| `PAYPAL_MODE` | pepper-farm/backend/routers/payments.py |  |
| `SECRET_KEY` | pepper-farm/backend/utils/jwt.py |  |
| `SMTP_FROM` | pepper-farm/backend/routers/sensors.py, pepper-farm/backend/services/email_service.py |  |
| `SMTP_HOST` | pepper-farm/backend/routers/sensors.py, pepper-farm/backend/services/email_service.py |  |
| `SMTP_PASSWORD` | pepper-farm/backend/routers/sensors.py, pepper-farm/backend/services/email_service.py |  |
| `SMTP_PORT` | pepper-farm/backend/routers/sensors.py, pepper-farm/backend/services/email_service.py |  |
| `SMTP_USER` | pepper-farm/backend/routers/sensors.py, pepper-farm/backend/services/email_service.py |  |
<!-- AUTO-GENERATED-END:envvars -->

---

## 10. Known Project Rules / Decisions

> **Read this section before modifying any business logic.**

1. **Pepper thresholds live in `PepperVarieties`, not `PepperThresholds`.**  
   `PepperThresholds` table/model is deprecated and must not be used. All threshold comparisons in anomaly detection read from `PepperVarieties` (`OptimalTempMinC/MaxC`, `OptimalSoilMoistureMin/Max`, `OptimalPARMin/Max`).

2. **PAR fields exist on `PepperVarieties`.**  
   `OptimalPARMin` and `OptimalPARMax` are valid fields. They were intentionally added and must not be removed.

3. **UV/Sunlight fields must not be reintroduced.**  
   UV and Sunlight sensor fields were removed. Do not add them back.

4. **Atomation is the sole external sensor provider.**  
   All IoT data flows through `services/atomation_service.py`. Do not introduce alternative sensor APIs without updating this service.

5. **Manager sidebar must include a Sensors link.**  
   `ManagerNavbar` must always render a navigation item for `/manager/sensors`. Do not remove it.

6. **Task checklist items must be preserved on task update.**  
   `PATCH /api/tasks/{task_id}` must not delete checklist items as a side effect. Checklist management has its own dedicated endpoints.

7. **RTL/LTR layout must be preserved.**  
   The app supports Hebrew (RTL) and English (LTR). Any layout or CSS change must not break text direction switching.

8. **Authentication uses JWT stored in `localStorage`.**  
   The frontend `apiClient.ts` reads `localStorage.getItem('token')` and attaches it as `Authorization: Bearer`. Do not change the storage key without updating `apiClient.ts`.

9. **Role names are case-sensitive strings: `"Worker"` and `"FarmManager"`.**  
   Backend `require_role()` and frontend role checks compare against these exact strings.

10. **All backend API paths are prefixed with `/api/`.**  
    The Next.js rewrite rule matches `/api/:path*`. Adding non-prefixed routes will bypass the proxy.

11. **`apiFetch` in `src/services/apiClient.ts` is the single HTTP entry point.**  
    All frontend service files must use `apiFetch`, not raw `fetch` or `axios`. It handles deduplication, auth injection, and timeouts.

12. **Sensor auto-sync runs on a schedule via APScheduler.**  
    `services/sensor_auto_sync_service.py` is started in `main.py` lifespan. Do not create competing sync schedulers.

13. **Spray map data comes from `GET /api/spray-reports/zone-map` (FarmManager only).**  
    Safety status is computed live from the most-recent completed `SprayReport` per zone joined to `Pesticide.ReEntryIntervalHours` and `PreHarvestIntervalDays`. Do not duplicate this logic on the frontend. Status values: `safe | unsafe | requires_approval | pending | never_sprayed`.

14. **US28 spray map only colours sprayable zones.**  
    Zones with codes starting `GH-`, `GERM-`, or equal to `NURSERY` receive spray overlays. Non-sprayable zones (SHED-MAIN, VIS-CENTER, FACTORY) are shown in zone-type colour only. This intentionally matches the worker form's zone filter in `SprayReportForm.tsx`.

15. **US30: Every spray report submission generates exactly one `SprayAlert` (best-effort).**  
    `_generate_spray_alert()` is called inside `create_spray_report()` after the report is committed, wrapped in `try/except`. If `SprayAlerts` table is missing (DDL not yet run), the spray report still returns 201 — no crash. Severity: `high` = unverified pesticide, `medium` = completed + within REI window, `low` = planned or past REI.

16. **US30: `SprayAlert` is a separate model from `SensorAlert`.**  
    `SensorAlert` requires sensor-specific fields (SensorId, ReadingId, MetricName, ActualValue) that are incompatible with spray data. Do not merge or reuse `SensorAlert` for spray alerts.

17. **US30: Spray alerts are polled (not SSE) every 30 s via `AnomalyNotificationContext`.**  
    The context polls `GET /api/spray-reports/alerts` on a `sprayPollRef` interval. The bell-panel badge merges `unreadCount` (sensor alerts + tasks) with `sprayUnreadCount`. Do not add a separate SSE stream for spray alerts.

18. **US30: `SprayAlerts` table requires manual DDL in production.**  
    The project has no Alembic auto-migration. Run `pepper-farm/database/schema/SprayAlerts.sql` against the Azure SQL instance before deploying the US30 backend. If spray reports already exist without matching alerts, run `pepper-farm/database/schema/backfill_spray_alerts.sql` once to backfill them.

19. **US30: Spray alert UX lives in the Spray Map page, not a separate route.**  
    The bell-panel "View all" link and each spray-alert item link to `/manager/spray-map#spray-alerts`. The `/manager/spray-alerts` route is a client-side redirect to that anchor. The manager navbar has no separate "Spray Alerts" nav item — alerts are reached via the "Spray Map" link or the bell panel.

20. **US31: The visitor spray restriction map is public — no login required.**  
    Two endpoints exist for US31: `GET /api/spray-reports/public-restricted-zones` (no auth — used by `/visitor/spray-restrictions`) and `GET /api/spray-reports/restricted-zones` (JWT required — used by `/worker/spray-restrictions` and accessible to FarmManager/Worker/Visitor roles). Both call `get_zone_spray_map()`. The US28 manager-only `GET /api/spray-reports/zone-map` remains FarmManager-only. The Safety Map button on `/visitor` is always visible regardless of login state. The `SprayZoneMap` component is shared; neither page exposes spray-alert management UI. The legend uses "Caution — Safety unverified" (not "Requires approval") to avoid implying a US33 entry-approval workflow.

21. **US32: Overdue spray alerts are separate from US30 SprayAlerts.**  
    `OverdueSprayAlert` (table `OverdueSprayAlerts`) is a distinct model from `SprayAlert` (US30). US30 alerts are tied to a specific `SprayReport`; US32 overdue alerts exist precisely when there is NO recent spray report. DDL: `pepper-farm/database/schema/OverdueSprayAlerts.sql`. Run this script in production before deploying US32 backend.

22. **US32: Overdue check threshold is `DEFAULT_SPRAY_INTERVAL_DAYS = 30`.**  
    Defined in `services/overdue_spray_check_service.py`. A zone is overdue if its most-recent `SprayReport.CompletedAtUtc` is older than 30 days, or if never sprayed and created more than 30 days ago. Only sprayable zones (GH-*, GERM-*, NURSERY) are checked — matching the spray map filter (rule 14).

23. **US32: Duplicate overdue alerts are prevented at the application level.**  
    `check_overdue_spray_zones()` queries for existing active (unresolved) overdue alerts per zone and skips creating a new one if one already exists. The scheduler runs every 6 hours (`OVERDUE_CHECK_INTERVAL_HOURS`); it adds a job to the same `BackgroundScheduler` used by sensor auto-sync — no competing schedulers.

24. **US32: Completing a spray report auto-resolves overdue alerts for that zone.**  
    `create_spray_report()` calls `_resolve_overdue_alerts_for_zone()` (best-effort, wrapped in try/except) when a completed report is submitted. Planned reports do NOT resolve overdue alerts. Overdue alerts expose a `GET /api/spray-reports/overdue-alerts?active_only=true` filter to show only unresolved alerts.

25. **US32: Task assignment from overdue alert is idempotent.**  
    `POST /api/spray-reports/overdue-alerts/{id}/assign` returns the existing task if `AssignedTaskId` is already set, without creating a duplicate. The created task uses `taskType="spray"` and `priority="high"` via the existing `create_task()` service.

26. **US33: Entry permission is computed server-side in `get_zone_spray_map()` and exposed on every zone response.**
    Four new fields are added to `ZoneSprayStatusResponse` / `ZoneSprayStatusData`: `entryPermissionStatus` (`allowed | restricted | caution | planned_warning | no_data`), `entryAllowed` (bool), `entryMessage` (str), `remainingRestrictionMinutes` (int | null). The computation helper `_compute_entry_permission()` in `spray_service.py` derives these from `sprayStatus` + `safeToReEnterAtUtc` + current UTC time. Both public and authenticated restricted-zone endpoints return the same entry permission fields. Entry logic: `unsafe` → restricted, `requires_approval` → caution (entryAllowed=False), `pending` → planned_warning (entryAllowed=True), `safe` → allowed, `never_sprayed` → no_data (allowed). The manager spray map (`/zone-map`) also returns these fields. No physical gate/QR/IoT control — this is read-only safety information.

27. **US32: Overdue alerts are polled every 60 s by `AnomalyNotificationContext`.**  
    `getOverdueSprayAlerts()` is polled on `overduePollRef`. New unresolved+unread overdue alerts trigger a toast. `overdueAlerts`, `overdueUnreadCount`, and `acknowledgeOverdueAlert` are exposed from the context. The overdue alerts UI is in the Spray Map page at `id="overdue-spray-alerts"`, manager-only (FarmManager role gate on all endpoints).

28. **Worker Planting mode shares read/write plant registry actions with FarmManagers.**  
    The worker dashboard uses `GET /api/inventory/by-variety` for the Plants Registry and map popup plant lists, so that endpoint must allow both `FarmManager` and `Worker`. Workers may create plants in Nursery (`POST /api/plants`), update plant status (`PUT /api/plants/{plant_id}/status`), and transfer healthy Nursery plants to greenhouse/germination zones (`PUT /api/plants/{plant_id}/location`). Full warehouse inventory management (`/api/inventory`, `/api/inventory/{id}`, `/api/inventory/report`) remains FarmManager-only.

29. **Worker plant workflows live only on `/worker`.**  
    The old `/worker/plants/add` and `/worker/plants/update-location` pages were removed. Do not add worker plant navigation back as separate pages unless the dashboard workflow is intentionally split again.

30. **Worker task workflows live only on `/worker`.**  
    The old `/worker/my-tasks` page was removed. The dashboard task panel and task detail modal are the worker task surface for status changes and checklist completion. Task notification links should point to `/worker`, not `/worker/my-tasks`.

31. **Worker spray reporting lives only on `/worker`.**  
    The old `/worker/spray-report` page was removed. The worker dashboard Sprays map opens a popup with the shared `SprayReportForm`; clicking "Create spray report" preselects the clicked sprayable zone. Do not add worker spray-report navigation back as a separate page unless the dashboard workflow is intentionally split again.

47. **US41: PayPal Sandbox (real PayPal, not mock):**
    - **Credit card = mock only**: Validates card fields + Luhn, stores only last 4 digits + brand. Never calls any real card gateway. Mock-decline card: `4000 0000 0000 0002`. `PaymentMethod="credit_card"` in DB.
    - **PayPal = real PayPal Sandbox**: Uses PayPal Orders API v2. No mock/fake PayPal flow. `paymentMethod="paypal"` in DB. Credentials: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` (backend-only). Frontend uses `NEXT_PUBLIC_PAYPAL_CLIENT_ID` only. Sandbox: `https://api-m.sandbox.paypal.com`.
    - **PayPal endpoints**: `POST /api/payments/paypal/create-order`; `POST /api/payments/paypal/capture-order`; `GET /api/payments/paypal/config`.
    - **PaymentRecord new fields**: `ProviderOrderId`, `ProviderCaptureId`, `ProviderStatus` for PayPal; `MockTransactionId` for credit-card mock only.
    - **Card number is exactly 16 digits** (schema + frontend).
    - **No real PayPal network calls in tests** — mocked via `routers.payments.*` patches.
    - **Migration**: `add_paypal_fields_to_payment_records.sql`.

46. **US41 bug-fix pass (cart/checkout UX):**
    - **Credit card formatting**: The card number input now auto-inserts a space every 4 digits as the user types (e.g. `4111 1111 1111 1111`). Digits-only are accepted; spaces are stripped before Luhn validation. Validation errors appear on field blur or on submit — not aggressively on every keystroke. Test card: `4111 1111 1111 1111` (valid Visa). Mock-decline card: `4000 0000 0000 0002`.
    - **Worker cart access**: Workers can access `/cart`, `/checkout`, and `/checkout/success`. `WorkerNavbar` now shows a green cart badge with item count (polls every 30 s, resets on route change). The empty cart "Continue Shopping" link is role-aware and sends Workers to `/worker/products`.
    - **Mock PayPal — no real credentials required**: US41 PayPal is mock-only. No `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, or `PAYPAL_MODE` env vars are needed. The backend generates a `MOCK-{uuid}` transaction ID and marks payment succeeded without any external network call. See `.env.example` for documentation. Any real PayPal sandbox credentials that may exist in `.env` are unused by the checkout router.
    - **Currency symbol**: Cart page, checkout page, and success page now display `₪` (ILS) instead of `$`.
    - **Back navigation**: Cart page has "← Continue Shopping" back-link. Checkout page has "← Back" to cart. Success page has "← Continue Shopping" back-link. All role-aware.

45. **US41: Payment / Cart / Mock Checkout — MOCK PAYMENT ONLY. No real card or PayPal processing.**
    - **Tables**: `CartItems`, `Orders`, `OrderItems`, `PaymentRecords`, `Coupons`, `CouponRedemptions`, `EmployeeDiscountSettings`, `EmployeeDiscountProductOverrides`. All created by `database/migrations/create_us41_tables.sql` (idempotent).
    - **Price calculation order** (single source: `services/pricing_service.py`): (1) base product Price → (2) US38 product discount if currently valid → (3) employee discount for Worker role (default 40%, manager-configurable, product-level overrides) → (4) coupon applied to item subtotal after all per-item discounts. Frontend prices are NEVER trusted.
    - **Stock**: checkout decrements `Inventory.AllocatedQuantity` atomically inside a DB transaction using `UPDATE ... WHERE AllocatedQuantity >= :qty`. If `rowcount == 0`, oversell is prevented and checkout fails cleanly.
    - **Cart**: stores only `ProductId + Quantity`. Prices recomputed from DB on every view. Never stores stale prices.
    - **Credit card**: Luhn validation (both client-side and server-side). Only last 4 digits + card brand stored. CVV/full number NEVER stored or logged. Mock decline card: `4000000000000002`.
    - **Mock PayPal**: always succeeds, generates mock transaction ID, no external API calls.
    - **Coupons**: percentage or fixed-amount. Case-insensitive. Manager can create/edit/deactivate. Use counted only after successful payment. Validated server-side only.
    - **Employee discount**: Workers get 40% by default (manager-configurable). Visitors/Managers get 0%. Product-level override modes: `use_global`, `excluded`, `custom_percent`. Manager manages via `/manager/employee-discounts`.
    - **Receipt/invoice email**: TRANSACTIONAL — sent to every buyer regardless of `EmailConsent`/newsletter subscription. Uses existing SMTP service (`services/email_service.py`). Background task (does not block checkout response). `EmailLogs.EmailType = 'order_receipt'`. No unsubscribe footer. SMTP failure does not roll back order. `PaymentRecords.InvoiceEmailStatus` updated to `sent`/`failed`/`not_sent`.
    - **Checkout response**: returns immediately after order creation. Receipt email queued via `BackgroundTasks`. Frontend timeout not increased.
    - **Frontend routes**: `/cart`, `/checkout`, `/checkout/success`, `/manager/coupons`, `/manager/employee-discounts`.
    - **Migration**: run `database/migrations/create_us41_tables.sql` against SQL Server before deploying.
    - **Tests**: `tests/test_us41_checkout.py` (34 tests).

44. **US39/US40 integration bug fixes (batch 3 — targeted):**
    - **Worker notification bell shows real details**: `handleBellClick` now calls `openAppNotifs()` when the bell opens, loading Notification rows from `/api/notifications`. Previously the panel always showed "No notifications" because `appNotifs` was never populated.
    - **Unsubscribe email footer wording**: `build_unsubscribe_footer_html/text()` in `services/email_unsubscribe.py` now says "click here to unsubscribe" with the token URL as the link. The fallback (no token) is a plain note with no link — the profile page is NOT linked (spec requirement). Applies to all marketing emails.
    - **`GET /api/email-consent/me` no longer 500s**: `email_consent.py` `_read_consent` and `update_my_consent` now catch `ProgrammingError` in addition to `OperationalError`. SQL Server raises `ProgrammingError` for "Invalid column name" when US40 migration columns are absent.
    - **Broken "Email Subscription" button removed from visitor header**: `visitor/layout.tsx` no longer shows the `/profile` link; the unsubscribe action is available only from email footers.
    - **Newsletter send result shows queued count**: `SendTemplateResponse` has `queued: bool = False`. When `queued=True`, the manager UI shows the `message` text ("queued for N recipients") instead of `sentCount: 0 · failedCount: 0`.
    - **Subscribe-again section on Products page**: Logged-in Visitor/Customer sees an email subscription widget at the bottom of `/visitor/products`. Unsubscribed visitors get a "Subscribe" button (calls `PUT /api/email-consent/me`). Subscribed visitors see a status note. The section is hidden for unauthenticated users and does not affect auth state.

43. **US39/US40 integration bug fixes (batch 2):**
    - **In-app announcements separated from email newsletters**: `POST /api/notifications/announce` (FarmManager only) creates Notification rows for all users of specified roles (`workers` / `visitors` / `all`). The manager newsletter page has a dedicated "In-App Announcement" tab (amber button) that calls this endpoint. Newsletter/discount email sends explicitly do NOT call `announce` — newsletters are email-only and must not create app notifications.
    - **Unsubscribe footer always present**: `build_unsubscribe_footer_html()` and `build_unsubscribe_footer_text()` in `services/email_unsubscribe.py` now always return a non-empty string. When the US40 migration hasn't been applied (no token), they fall back to a `/profile` management link. All three email paths (newsletter, template, discount) share this helper, so the fix applies everywhere with no per-caller changes.
    - **Newsletter/template send is non-blocking**: `POST /api/emails/send-newsletter` and `POST /api/newsletter-templates/{id}/send` now use FastAPI `BackgroundTasks` + their own `SessionLocal`. They resolve recipients and return `queued=True` immediately; SMTP delivery happens asynchronously. `NewsletterResponse` schema has a new `queued: bool = False` field.
    - **SMTP connection timeout**: `smtplib.SMTP(host, port, timeout=30)` added in `email_service.py`. Prevents a single slow/dead mail server from blocking the background loop indefinitely.
    - **Visitor products page is auth-aware**: `visitor/products/page.tsx` now checks `localStorage.getItem('token')` on mount. If authenticated, the Login/Register buttons are hidden (the visitor layout header already provides Logout/Profile). If not authenticated, Login/Register are shown as before.

42. **US39/US40 bug fixes (batch):**
    - **Discount email catalog button**: `href="#"` replaced with `{FRONTEND_BASE_URL}/visitor/products`. Set `FRONTEND_BASE_URL` in `.env` (default `http://localhost:3000`).
    - **Unsubscribe footer always present**: `_build_discount_html()` now falls back to a `/profile` link when `EmailUnsubscribeToken` migration has not been applied yet. The footer is never empty.
    - **Product update no longer blocks on SMTP**: `create_product_endpoint` and `update_product_endpoint` use `BackgroundTasks` + `_send_discount_notification_bg()` (creates its own `SessionLocal`). The HTTP response returns immediately; email logs are written by the background task. SMTP failure does not roll back the product update.
    - **Worker has one bell**: Duplicate US40 amber bell removed from `WorkerNavbar`. In-app notification count is merged into the existing red bell badge (`visibleUnreadCount + appNotifCount`). In-app messages appear as a section inside the existing bell panel.
    - **Visitor has a bell**: New `/visitor/layout.tsx` wraps all `/visitor/*` pages with a slim header that includes a notification bell (polls `/api/notifications/unread-count` every 60 s).
    - **Notifications API no longer crashes when table is missing**: `routers/notifications.py` now catches `ProgrammingError` (SQL Server's "Invalid object name" wrapping in pyodbc) in addition to `OperationalError`, returning graceful 200 / empty responses until `create_notifications_table.sql` is applied.

38. **US40: Email consent is NOT subscribed by default — explicit opt-in required.**
    `EmailConsent BIT NOT NULL DEFAULT 0` (changed from US39's DEFAULT 1). New users are not subscribed unless they check the registration checkbox. Consent can be updated via `PUT /api/email-consent/me`. The US40 migration script `add_email_consent_us40_fields.sql` adds `EmailMarketingConsentUpdatedAtUtc`, `EmailUnsubscribeToken`, `EmailUnsubscribedAtUtc`. Run AFTER `add_email_consent_to_users.sql`.

39. **US40: All marketing emails include a per-recipient unsubscribe link in the footer.**
    `services/email_unsubscribe.py` provides `get_or_create_token()` (uuid4 hex, stored in `EmailUnsubscribeToken`) and `build_unsubscribe_footer_html/text()`. Each recipient gets their own token so the link is personal. The link points to `{FRONTEND_BASE_URL}/unsubscribe?token=...`. Set `FRONTEND_BASE_URL=https://[frontend-host]` in production. The unsubscribe endpoint `GET /api/email-consent/unsubscribe?token=...` is public (no auth). It does not reveal whether an email exists.

40. **US40: In-app notifications are for app messages/announcements ONLY — never for newsletters.**
    `Notifications` table + `/api/notifications/*` endpoints. FarmManagers create notifications via `POST /api/notifications/broadcast`. Newsletter/discount sends do NOT create notification rows. Workers see their own notifications in an amber bell badge on the WorkerNavbar. The existing manager bell (sensor/spray alerts) is separate — the amber worker badge is exclusively for in-app messages.

41. **US40: Registration sends `emailConsent: bool` to backend (defaults false).**
    `RegisterRequest.emailConsent` optional field (default False). After user creation, `auth_service.register()` does a best-effort `UPDATE Users SET EmailConsent=1` if the user opted in. The update is wrapped in try/except so registration never fails if the migration hasn't been applied.

37. **US39 (extended): Newsletter image upload stores files under `uploads/newsletter_images/` and returns an absolute URL.**
    Endpoint: `POST /api/newsletter-templates/upload-image` (FarmManager only).
    Accepted types: JPEG, PNG, WEBP, GIF. Max size: 2 MB. Filenames are uuid4 hex + original extension.
    The absolute URL is built from `BACKEND_BASE_URL` env var (default: `http://localhost:8000`).
    Set `BACKEND_BASE_URL=https://hadinerim.azurewebsites.net` in production so email `<img src>` works.
    `ImageBlock.url` and `heroImageUrl` also accept `/uploads/` prefix (internal) or any `http(s)://` URL.
    Blocked schemes: `javascript:`, `data:`, `file:`, `vbscript:`. Email HTML uses `max-width:100%;height:auto;display:block` for all images.

34. **US39 (extended): `NewsletterTemplates` table stores structured content blocks as JSON.**
    Blocks: `heading`, `paragraph`, `image`, `button`, `divider`. The `render_html()` function in `services/newsletter_template_service.py` converts blocks to a full HTML email with preheader, hero image, CTA button, footer. The `render_plain_text()` function generates the text/plain fallback. Image and button URLs are validated (must start with `http://` or `https://`) — raw HTML is not accepted. Backend DDL: `database/migrations/create_newsletter_templates_table.sql`. Templates can be saved without SMTP; sending requires SMTP configuration.

35. **US39: RegisterForm uses `normalizeApiError()` to prevent React crash on Pydantic validation arrays.**
    `RegisterForm.tsx` now normalizes `data.detail` before calling `setApiError`. Handles: `detail` as string, as array of `{msg}` objects (Pydantic 422), as `{msg}` object, or as null/undefined. This prevents "Objects are not valid as a React child" when the backend returns a 422 with `detail` as an array.

36. **US39: `EmailConsent` is intentionally NOT mapped as a SQLAlchemy ORM column.**
    In SQLAlchemy 2.0, any nullable mapped column is included in INSERT as NULL even when
    `deferred` and never explicitly set, causing "Invalid column name 'EmailConsent'" on SQL
    Server before the migration runs. The only reliable fix is to not map the column at all.
    `EmailConsent` is added to the `Users` table by `add_email_consent_to_users.sql`
    (`DEFAULT 1 / opted-in by default`). Newsletter and discount routers filter by consent
    using `text("Users.EmailConsent = 1")` with an `OperationalError` fallback (sends to all
    active Visitors when the column doesn't exist yet). Register and login are completely
    unaffected because no SQL references `EmailConsent` during those flows.

29. **US39: SMTP is shared — one reusable service, no duplicate config.**
    `services/email_service.py` is the single SMTP sender. It uses the same `SMTP_HOST/PORT/USER/PASSWORD/FROM` env vars already present before US39. `routers/sensors.py` still has its own inline SMTP code for the sensor export endpoint (unchanged). Every new email send (discount notification, newsletter) goes through `email_service.py`. Never introduce a second SMTP config.

30. **US39: Automatic discount emails fire on new or changed active discounts only.**
    `routers/products.py` compares the previous discount state with the incoming update before calling `_send_discount_notification()`. An email is sent when: (a) a product is created with `DiscountActive=True` + `DiscountPercentage > 0`, or (b) an update activates a previously inactive discount, or (c) the discount percentage or end date changes while remaining active. Unrelated product edits do not trigger emails. Sending the exact same discount again does not trigger a duplicate.

31. **US39: Only opted-in customers (Visitors with `EmailConsent=True`) receive marketing/discount emails.**
    `models/user.py` now has `EmailConsent = Column(Boolean, NOT NULL, default=True)`. Migration: `database/migrations/add_email_consent_to_users.sql`. Newsletter endpoint recipient group `"customers"` filters by `Role.RoleName=="Visitor"` AND `EmailConsent==True` AND `IsActive==True`. Workers do not need consent for internal staff comms (newsletter workers group). Never send marketing emails to customers with `EmailConsent=False`.

32. **US39: Every email send attempt is logged to `EmailLogs`.**
    `models/email_log.py` / table `EmailLogs`. Fields: `Status` = sent/failed/skipped, `SentAtUtc` set on success, `ErrorMessage` set on failure, `RelatedProductId/DiscountPercentage` for discount emails. SMTP passwords are never stored in logs. DDL: `database/migrations/create_email_logs_table.sql`.

33. **US39: Email logs API is FarmManager-only.**
    `GET /api/emails/logs` and `POST /api/emails/send-newsletter` both require `FarmManager` role via `require_role("FarmManager")`. Non-managers receive 403.

28. **US38: Products support optional discounts (unlimited or time-limited).**  
    Four columns were added to `Products` via `database/migrations/add_discount_fields_to_products.sql` (safe to re-run): `DiscountPercentage DECIMAL(5,2)`, `DiscountActive BIT NOT NULL DEFAULT 0`, `DiscountStartDate DATETIME2 NULL`, `DiscountEndDate DATETIME2 NULL`. Discount validity is computed server-side inside `ProductResponse.compute_discount_validity()` (Pydantic model validator): valid when `DiscountActive=true` AND `DiscountPercentage > 0` AND start date has passed (if set) AND end date has not passed (if set). `FinalPrice = round(Price × (1 − DiscountPercentage/100), 2)` when valid; otherwise `FinalPrice = Price`. An **unlimited discount** has `DiscountActive=true`, `DiscountPercentage > 0`, and `DiscountEndDate=NULL` — it stays active until the manager disables it. All three catalog screens (manager `/manager/products`, worker `/worker/products`, visitor `/visitor/products`) share `ProductCard`, which shows the discount badge (`N% OFF`), strikethrough original price, discounted price in green, and an end-date or "Unlimited offer" label for currently-valid discounts. Expired discounts do not show a badge, strikethrough, or discounted price anywhere. Backend datetime fields are stored as naive UTC; the frontend always appends `'Z'` when parsing API-returned date strings to avoid local-timezone misinterpretation.

---

## 11. Testing Map

| Area | Type | Files | Run Command |
|---|---|---|---|
| Backend — auth | Unit/API | `tests/test_auth_api.py`, `test_login_api.py`, `test_swagger_token.py`, `test_role_authorization_api.py` (covers Worker access to plant registry/status endpoints) | `cd pepper-farm/backend && pytest` |
| Backend — tasks | Unit/API | `tests/test_tasks_api.py`, `test_task_service.py`, `test_get_tasks.py`, `test_completed_tasks.py`, `test_task_report.py` | same |
| Backend — sensors | Unit/API | `tests/test_sensors_api.py`, `test_sensor_service.py`, `test_sensor_readings_api.py`, `test_sensor_auto_sync_service.py`, `test_atomation_service.py` | same |
| Backend — anomalies | Unit/API | `tests/test_anomalies_api.py`, `test_anomaly_detection_service.py`, `test_recurrence_detection_service.py` | same |
| Backend — peppers | Unit/API | `tests/test_create_pepper.py`, `test_update_pepper.py`, `test_delete_pepper.py` | same |
| Backend — inventory | Unit/API | `tests/test_inventory_service.py`, `test_inventory_schema.py`, `test_inventory_report.py` | same |
| Backend — spray | Unit/API | `tests/test_spray_api.py`, `test_spray_service.py` | same |
| Backend — spray alerts | Unit/API | `tests/test_spray_alerts_api.py` (21 tests — list, get, mark-read, role enforcement, graceful failure when table missing) | same |
| Backend — overdue spray alerts | Unit/API | `tests/test_overdue_spray_alerts_api.py` (27 tests — overdue check logic, duplicate prevention, CRUD, task assignment idempotency, spray report resolution, manual trigger, US28/US30 regression) | same |
| Backend — users | Unit/API | `tests/test_users_api.py`, `test_user_service.py` | same |
| Backend — products | Unit/API | `tests/test_create_product_item.py`, `test_product_authorization.py`, `tests/test_product_discounts.py` (20 tests — schema validation, price computation, expired/unlimited/time-limited discount, create/update/catalog with discount) | same |
| Backend — email service | Unit | `tests/test_email_service.py` (8 tests — SMTP configured/not configured, send_email success/failure, SMTP_FROM fallback) | same |
| Backend — emails API | Unit/API | `tests/test_emails_api.py` (13 tests — auth/role enforcement, validation, recipient filtering, consent filter, email logs created for sent/failed, summary response fields) | same |
| Backend — newsletter templates | Unit/API | `tests/test_newsletter_templates_api.py` (22 tests — auth, CRUD, archive, preview, send with mocked SMTP, email logs written, invalid URL rejected, XSS escaped, plain-text override) | same |
| Backend — newsletter image upload | Unit/API | `tests/test_newsletter_image_upload.py` (19 tests — auth, valid JPEG/PNG/WEBP/GIF, oversized rejected, PDF rejected, imageUrl is absolute, BACKEND_BASE_URL respected, uuid unique filenames, schema accepts http/https//uploads/, rejects javascript/data/file schemes, HTML includes img alt) | same |
| Backend — email consent (US40) | Unit/API | `tests/test_email_consent_api.py` (12 tests — auth, GET/PUT consent, unsubscribed_at set, token unsubscribe, invalid/already token, register default false, register with true) | same |
| Backend — in-app notifications (US40) | Unit/API | `tests/test_notifications_api.py` (13 tests — auth, list own only, unread count, mark as read, cannot mark other's, mark-all-read, FarmManager broadcast, newsletter does NOT create notification) | same |
| Frontend — register form errors | Jest | `tests/RegisterForm.test.tsx` (+3 new error tests + 4 US40 consent checkbox tests = 17 total) | `npm --prefix pepper-farm/frontend run test` |
| Frontend — unsubscribe page (US40) | Jest | `tests/UnsubscribePage.test.tsx` (4 tests — success/already/invalid states, calls API with token) | same |
| Frontend — products (US38) | Jest | `tests/ProductCard.test.tsx` (13 tests — discount badge, strikethrough price, unlimited/timed end-date labels, expired discount hidden, frontend UTC safety check) | `npm --prefix pepper-farm/frontend run test` |
| Frontend — newsletter (US39) | Jest | `tests/NewsletterPage.test.tsx` (11 tests — renders, validation, success banner with counts, API error, sending state, loads email logs table, status badge) | same |
| Backend — plants | Unit | `tests/test_plant_service.py` | same |
| Backend — map | Unit | `tests/test_farm_map.py` | same |
| Frontend — components | Jest | `tests/*.test.tsx` (LoginForm, RegisterForm, TaskCard, PepperCard, etc.) | `npm --prefix pepper-farm/frontend run test` |
| Frontend — services | Jest | `tests/*.test.ts` (anomaliesService, sensorsService, tasksService, managerDashboardApi) | same |
| Frontend — integration | Jest | `tests/ManagerDashboard.integration.test.tsx` | same |
| Frontend — E2E | Playwright | `e2e/test_edit_pepper_flow.spec.ts`, `e2e/navbar.spec.ts` | `npx playwright test` (from `pepper-farm/frontend`) |

| Backend — spray map | Unit/API | `tests/test_spray_map_api.py` (12 tests) | same |
| Backend — spray restrictions | Unit/API | `tests/test_spray_restrictions_api.py` (27 tests — role access for Manager/Worker/Visitor, public endpoint returns 200 with no auth, US28 zone-map still 403 for Worker/Visitor, REI logic, sanitisation, insertion-order robustness, sensitive fields not exposed on public endpoint) | same |
| Frontend — spray alerts redirect | Jest | `tests/SprayAlertsPage.test.tsx` (2 tests — verifies redirect to spray-map#spray-alerts) | `npm --prefix pepper-farm/frontend run test` |
| Frontend — spray map page (US28 + US30 + US32) | Jest | `tests/SprayMapPage.test.tsx` (8 tests — zone map title, alerts section loading/empty/list/error) | same |
| Frontend — overdue spray alerts section (US32) | Jest | `tests/OverdueSprayAlertsSection.test.tsx` (14 tests — section renders, loading/empty/list, severity badge, resolved/active status, assign button, modal, success/error) | same |
| Frontend — spray restrictions page (US31, worker) | Jest | `tests/SprayRestrictionsPage.test.tsx` (13 tests — title, loading, map renders, safety notice, summary cards, restricted banner, zone table, status labels, error state, no manager alerts) | same |
| Frontend — visitor spray restrictions page (US31, public) | Jest | `tests/VisitorSprayRestrictionsPage.test.tsx` (11 tests — renders without login, calls `getPublicRestrictedZones` not `getRestrictedZones`, visitor safety notice, restricted-areas banner, all-clear banner, zone table, error state, no manager controls, no action workflow buttons) | same |
| Frontend — entry permission (US33) | Jest | `tests/EntryPermissionPage.test.tsx` (9 tests — restricted badge when within REI, allowed badge when REI passed, caution for unverified, planned_warning for future spray, no_data for no history, safe re-entry time column, no manager-only fields, no action buttons) | same |
| Frontend — manager navbar (US30 additions) | Jest | `tests/ManagerNavbar.test.tsx` (updated — spray map nav link, bell panel spray section, anchor hrefs, badge count) | same |

**Notable gaps:** No backend tests for Zones router. No E2E coverage for worker flows (tasks, spray). No frontend tests for sensor detail views. `tests/test_task_report.py` has 3 pre-existing failures unrelated to US28/29/30 — needs investigation.

**Test infrastructure (post-US41 fix):**
- `models/__init__.py` now imports all ORM models. Any module that imports `models` (or individual model files) automatically registers every table with `Base.metadata` before `create_all()`.
- `tests/conftest.py` does `import models` so pytest registers all models before any test's `setup_db` fixture runs — even for service-level tests that never do `from main import app`.
- `setup_db` fixtures in `test_emails_api.py` and `test_newsletter_templates_api.py` now use `drop_all → create_all → try/yield/finally` for a robust, clean-slate pattern per test.
- Background-task tests that check email logs patch `routers.emails.SessionLocal` and `routers.newsletter_templates.SessionLocal` to `TestingSessionLocal` so log writes land in the test DB instead of the production engine.
- `auth_service.register()` calls `db.refresh(user)` after `db.commit()` so mock-DB tests (test_auth_api.py) can access `user.UserId` and `user.role` without triggering a lazy-load through the mock session.

---

## 12. Common Commands

```bash
# Install all dependencies (from repo root)
npm run setup

# Run frontend + backend together (from repo root)
npm run dev

# Run frontend only (Next.js on port 3000)
npm run dev:frontend

# Run backend only (FastAPI on port 8000)
npm run dev:backend

# Run backend tests
cd pepper-farm/backend && pytest

# Run backend tests with output
cd pepper-farm/backend && pytest -v

# Run frontend unit tests
npm --prefix pepper-farm/frontend run test

# Run frontend unit tests in watch mode
npm --prefix pepper-farm/frontend run test:watch

# Run Playwright E2E tests
cd pepper-farm/frontend && npx playwright test

# Build frontend for production
npm --prefix pepper-farm/frontend run build

# Regenerate AUTO-GENERATED sections in this file
npm run context:update
# or directly:
python scripts/generate_project_context.py
```

---

## 13. Current Important Files

Files a new agent should read first when starting work:

| File | Why |
|---|---|
| [pepper-farm/backend/main.py](pepper-farm/backend/main.py) | App entry point — router registration, CORS, lifespan hooks |
| [pepper-farm/backend/database.py](pepper-farm/backend/database.py) | DB engine + session dependency |
| [pepper-farm/backend/models/pepper.py](pepper-farm/backend/models/pepper.py) | PepperVariety model — thresholds live here, not in PepperThresholds |
| [pepper-farm/backend/models/sensor_alert.py](pepper-farm/backend/models/sensor_alert.py) | SensorAlert + RecurrenceConfig models |
| [pepper-farm/backend/services/anomaly_detection_service.py](pepper-farm/backend/services/anomaly_detection_service.py) | Core anomaly logic — reads thresholds from PepperVariety |
| [pepper-farm/backend/routers/anomalies.py](pepper-farm/backend/routers/anomalies.py) | All anomaly + SSE endpoints |
| [pepper-farm/frontend/src/services/apiClient.ts](pepper-farm/frontend/src/services/apiClient.ts) | Central HTTP client — all requests go through here |
| [pepper-farm/frontend/src/app/manager/page.tsx](pepper-farm/frontend/src/app/manager/page.tsx) | Manager dashboard — largest and most complex frontend page |
| [pepper-farm/frontend/next.config.ts](pepper-farm/frontend/next.config.ts) | API proxy rewrite rules |
| [pepper-farm/backend/utils/auth.py](pepper-farm/backend/utils/auth.py) | JWT verification + role enforcement decorators |

---

## 14. Last Updated

- **Generated:** 2026-06-06 (Worker dashboard plant registry/map updates — Worker access to inventory-by-variety and plant status/location actions; spray map overview/entry legend layout documented; auto-generated endpoint/model/env sections refreshed)
- **Method:** Manual initial creation based on full codebase scan; AUTO-GENERATED sections can be refreshed by running `python scripts/generate_project_context.py` from the repo root.
- **To update:** Run `npm run context:update` or `python scripts/generate_project_context.py`. The script rewrites only content between `<!-- AUTO-GENERATED-START:* -->` and `<!-- AUTO-GENERATED-END:* -->` markers. All other sections are left untouched.
