# SmartPepper Farm Management System — Sprint 2

## Project Overview

SmartPepper Farm Management System is a web-based farm management platform for a smart pepper farm.  
The system is designed for three main types of users: FarmManager, Worker and Visitor.

The system supports agricultural and operational farm management by combining:

- Smart sensor data
- Pepper variety management
- Task management
- Alerts
- Spray and safety management
- Catalog and inventory management
- Visitor-facing information
- Role-based access control

The project is developed as part of the Software Project Management course using Agile / Scrum methodology, Jira, GitHub and GitHub Actions.

---

## Sprint 2 Goal

The goal of Sprint 2 was to expand the system beyond the basic management features implemented in Sprint 1 and add smart-farm functionality.

Sprint 2 focused on:

- Real-time sensor data ingestion
- Pepper variety threshold configuration
- Smart anomaly alerts
- Alert history and recurring anomaly detection
- Task assignment based on alerts
- Catalog and product improvements
- Spray and safety management
- UI / UX improvements
- Bug tracking and regression handling
- CI/CD and testing improvements

---

## Sprint 2 Implemented User Stories

| User Story | Description | Epic / Area | Status |
|---|---|---|---|
| US19 | Real-Time Sensor Data Ingestion | Sensors Data Management | Done |
| US20 | Pepper Variety Threshold Configuration | Sensors Data Management | Done |
| US21 | Sensor Anomaly Alert Generation | Smart Alerts Engine | Done |
| US22 | Alert History Log | Alerts Management | Done |
| US23 | Recurring Anomaly Detection | Sensors Data Management | Done |
| US24 | Manager Assigns Employee to Alert | Task Management | Done |
| US25 | Employee Receives and Handles Task | Task Management | Done |
| US26 | Update Product Details and Catalog Improvements | Catalog & Inventory | Done |
| US27 | Delete Product | Catalog & Inventory | Done |
| US28 | View Spray Map | Spray & Safety Management | Done |
| US29 | Employee Spray Report and Safety Checks | Spray & Safety Management | Done |
| US30 | Spray Alerts for Manager | Spray & Safety Management | Done |
| US31 | Mark Sprayed Area on Map for All Users | Spray & Safety Management | Done |
| US32 | Periodic Spray Alert and Task Assignment | Task Management | Done |
| US33 | Post-Spray Entry Safety Check | Spray & Safety Management | Done |
| US34 | View Completed Task History | Task Management | Done |
| UI Improvement | Unified Design, Navigation and Action Confirmations | Public Information / Visitor UI | Done |

---

## Main Features Added in Sprint 2

### 1. Sensor Data Management

Sprint 2 added the foundation for smart agriculture data handling.

Implemented capabilities:

- Receiving sensor readings
- Saving sensor data in the database
- Displaying sensor status
- Supporting live / stale sensor state
- Configuring threshold values by pepper variety
- Preparing the system for smart agriculture recommendations

Related user stories:

- US19
- US20
- US23

---

### 2. Smart Alerts Engine

Sprint 2 added smart alert capabilities based on sensor readings and anomaly conditions.

Implemented capabilities:

- Detecting anomaly conditions
- Creating alerts when sensor values are outside expected thresholds
- Tracking recurring anomalies
- Saving alert history
- Connecting alerts to follow-up tasks

Related user stories:

- US21
- US22
- US23
- US24

---

### 3. Task Management Improvements

Sprint 2 expanded the task management flow.

Implemented capabilities:

- Assigning employees to alerts
- Allowing workers to receive and handle tasks
- Creating tasks from periodic spray alerts
- Viewing completed task history
- Improving task flow and task tracking

Related user stories:

- US24
- US25
- US32
- US34

---

### 4. Catalog and Inventory Improvements

Sprint 2 improved the product catalog and inventory management.

Implemented capabilities:

- Updating product details
- Improving catalog display
- Deleting products
- Supporting better product and inventory management flows

Related user stories:

- US26
- US27

---

### 5. Spray and Safety Management

Sprint 2 added a farm-safety module related to spraying operations.

Implemented capabilities:

- Viewing spray map
- Reporting spray activity
- Generating spray alerts for managers
- Marking sprayed areas on the map
- Performing post-spray entry safety checks
- Supporting safety logic related to restricted entry and spray timing

Related user stories:

- US28
- US29
- US30
- US31
- US33

---

### 6. UI / UX Improvements

Sprint 2 also included general UI improvements.

Implemented improvements:

- Unified design
- Better navigation
- Action confirmation messages
- Improved user experience in several screens
- Better flow consistency across the system

---

## Technology Stack

### Backend

- Python
- FastAPI
- SQL Server / Azure SQL
- Pytest
- pytest-cov

### Frontend

- Next.js
- React
- TypeScript
- npm

### DevOps / Project Management

- GitHub
- GitHub Actions
- Jira
- Agile / Scrum
- CI/CD pipeline

---

## Project Structure

```text
pepper-farm/
├── backend/
│   ├── routers/
│   ├── services/
│   ├── schemas/
│   ├── models/
│   ├── tests/
│   └── main.py
│
├── frontend/
│   ├── src/
│   ├── app/
│   ├── components/
│   └── package.json
│
└── README.md
