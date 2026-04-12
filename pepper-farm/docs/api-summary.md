# API Summary

Base URL: `http://localhost:5000`

---

## Tasks

### POST `/api/tasks`
Create a new task. Caller must be a FarmManager.

**Request Body**
| Field             | Type     | Required | Notes                                      |
|-------------------|----------|----------|--------------------------------------------|
| title             | string   | Yes      | Max 200 chars                              |
| taskType          | string   | Yes      | e.g. irrigation, harvesting, planting      |
| description       | string   | No       | Max 1000 chars                             |
| priority          | string   | No       | `low` / `medium` / `high` / `critical` — default: `medium` |
| assignedToUserId  | int      | No       | Must be an active Worker                   |
| dueDate           | datetime | No       | Cannot be in the past                      |
| pepperId          | int      | No       | FK to PepperVarieties                      |
| zoneId            | int      | No       | FK to FarmZones                            |

**Responses**
| Status | Description                              |
|--------|------------------------------------------|
| 201    | Task created — returns `TaskResponse`    |
| 400    | Validation error — returns `{ message }` |
| 401    | Caller user ID not resolved              |

**TaskResponse**
```json
{
  "id": 1,
  "title": "Water zone A",
  "description": null,
  "status": "todo",
  "priority": "medium",
  "taskType": "irrigation",
  "createdByUserId": 10,
  "assignedToUserId": 20,
  "dueDate": "2026-04-20T00:00:00",
  "startedAt": null,
  "completedAt": null,
  "pepperId": null,
  "zoneId": null,
  "createdAt": "2026-04-12T10:00:00",
  "updatedAt": "2026-04-12T10:00:00"
}
```

---

## Users

### GET `/api/users/workers`
Returns all active workers available for task assignment.

**Responses**
| Status | Description                    |
|--------|--------------------------------|
| 200    | List of workers                |

**Response**
```json
[
  {
    "userId": 20,
    "fullName": "Bob Worker",
    "email": "bob@farm.com",
    "roleName": "Worker",
    "isActive": true
  }
]
```

---

## Validation Rules

| Rule                            | Error message                                              |
|---------------------------------|------------------------------------------------------------|
| Caller not found                | "Caller user does not exist."                              |
| Caller not a FarmManager        | "Only FarmManagers can create tasks."                      |
| Invalid priority value          | "Invalid priority '{value}'. Allowed values: low, medium, high, critical." |
| Due date in the past            | "DueDate cannot be in the past."                           |
| Assigned user not found         | "Assigned user does not exist."                            |
| Assigned user not a Worker      | "Tasks can only be assigned to Workers."                   |

---

## Task Status Values
`todo` → `in_progress` → `done` / `cancelled`

## Task Priority Values
`low` · `medium` · `high` · `critical`
