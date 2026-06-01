"""Tests for routers/notifications.py (US40 in-app notifications)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import app
from models.notification import Notification
from models.role import Role
from models.user import User

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)

@event.listens_for(engine, "connect")
def fix(conn, _): conn.create_function("sysutcdatetime", 0, lambda: "2024-01-01 00:00:00")

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try: yield db
    finally: db.close()

client = TestClient(app)

_VISITOR_TOKEN = {"sub": "1", "role": "Visitor"}
_WORKER_TOKEN  = {"sub": "2", "role": "Worker"}
_MANAGER_TOKEN = {"sub": "3", "role": "FarmManager"}

def _auth(role: str) -> dict:
    return {"Authorization": f"Bearer fake-{role}"}

def _seed(db):
    vr = Role(RoleName="Visitor"); wr = Role(RoleName="Worker"); mr = Role(RoleName="FarmManager")
    db.add_all([vr, wr, mr]); db.flush()
    visitor = User(FullName="Alice", Email="alice@f.com", PasswordHash="x", RoleId=vr.RoleId)
    worker  = User(FullName="Bob",   Email="bob@f.com",   PasswordHash="x", RoleId=wr.RoleId)
    manager = User(FullName="Mgr",   Email="mgr@f.com",   PasswordHash="x", RoleId=mr.RoleId)
    db.add_all([visitor, worker, manager]); db.commit()

@pytest.fixture(autouse=True)
def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal(); _seed(db); db.close()
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.pop(get_db, None)


# ── Auth ──────────────────────────────────────────────────────────────────────

def test_list_notifications_requires_auth():
    assert client.get("/api/notifications").status_code == 401

def test_unread_count_requires_auth():
    assert client.get("/api/notifications/unread-count").status_code == 401


# ── GET /api/notifications ────────────────────────────────────────────────────

def test_list_notifications_returns_empty_for_no_notifs():
    with patch("utils.jwt.jwt.decode", return_value=_WORKER_TOKEN):
        resp = client.get("/api/notifications", headers=_auth("Worker"))
    assert resp.status_code == 200
    assert resp.json() == []

def test_list_notifications_returns_own_only():
    db = TestingSessionLocal()
    # UserId=2 is worker, UserId=1 is visitor
    db.add(Notification(UserId=2, Title="For worker", NotificationType="message"))
    db.add(Notification(UserId=1, Title="For visitor", NotificationType="message"))
    db.commit(); db.close()

    with patch("utils.jwt.jwt.decode", return_value=_WORKER_TOKEN):
        resp = client.get("/api/notifications", headers=_auth("Worker"))

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "For worker"


# ── Unread count ──────────────────────────────────────────────────────────────

def test_unread_count_zero_initially():
    with patch("utils.jwt.jwt.decode", return_value=_WORKER_TOKEN):
        resp = client.get("/api/notifications/unread-count", headers=_auth("Worker"))
    assert resp.status_code == 200
    assert resp.json()["unreadCount"] == 0

def test_unread_count_correct_after_notification_added():
    db = TestingSessionLocal()
    db.add(Notification(UserId=2, Title="N1", NotificationType="message", IsRead=False))
    db.add(Notification(UserId=2, Title="N2", NotificationType="message", IsRead=True))
    db.commit(); db.close()

    with patch("utils.jwt.jwt.decode", return_value=_WORKER_TOKEN):
        resp = client.get("/api/notifications/unread-count", headers=_auth("Worker"))
    assert resp.json()["unreadCount"] == 1


# ── Mark single as read ───────────────────────────────────────────────────────

def test_mark_notification_read():
    db = TestingSessionLocal()
    n = Notification(UserId=2, Title="T", NotificationType="message", IsRead=False)
    db.add(n); db.commit(); nid = n.NotificationId; db.close()

    with patch("utils.jwt.jwt.decode", return_value=_WORKER_TOKEN):
        resp = client.put(f"/api/notifications/{nid}/read", headers=_auth("Worker"))
    assert resp.status_code == 200

    db = TestingSessionLocal()
    row = db.query(Notification).filter(Notification.NotificationId == nid).first()
    assert row.IsRead is True; db.close()

def test_cannot_mark_another_users_notification():
    db = TestingSessionLocal()
    n = Notification(UserId=1, Title="T", NotificationType="message", IsRead=False)
    db.add(n); db.commit(); nid = n.NotificationId; db.close()

    with patch("utils.jwt.jwt.decode", return_value=_WORKER_TOKEN):
        resp = client.put(f"/api/notifications/{nid}/read", headers=_auth("Worker"))
    assert resp.status_code == 403


# ── Mark all as read ──────────────────────────────────────────────────────────

def test_mark_all_read():
    db = TestingSessionLocal()
    db.add_all([
        Notification(UserId=2, Title="A", NotificationType="message"),
        Notification(UserId=2, Title="B", NotificationType="message"),
    ]); db.commit(); db.close()

    with patch("utils.jwt.jwt.decode", return_value=_WORKER_TOKEN):
        client.put("/api/notifications/mark-all-read", headers=_auth("Worker"))
        count = client.get("/api/notifications/unread-count", headers=_auth("Worker"))

    assert count.json()["unreadCount"] == 0


# ── FarmManager broadcast ─────────────────────────────────────────────────────

def test_broadcast_requires_manager():
    with patch("utils.jwt.jwt.decode", return_value=_WORKER_TOKEN):
        resp = client.post("/api/notifications/broadcast",
                           json={"userId": 2, "title": "Hi", "notificationType": "message"},
                           headers=_auth("Worker"))
    assert resp.status_code == 403

def test_manager_can_broadcast_notification():
    with patch("utils.jwt.jwt.decode", return_value=_MANAGER_TOKEN):
        resp = client.post("/api/notifications/broadcast",
                           json={"userId": 2, "title": "Announcement", "message": "Meeting at 3pm", "notificationType": "system"},
                           headers=_auth("FarmManager"))
    assert resp.status_code == 201
    assert resp.json()["title"] == "Announcement"

def test_newsletter_send_does_not_create_notification():
    """Newsletter endpoint must NOT create in-app notifications — US40 rule."""
    with patch("utils.jwt.jwt.decode", return_value=_MANAGER_TOKEN):
        with patch("routers.emails.is_smtp_configured", return_value=True):
            with patch("routers.emails.send_email"):
                client.post("/api/emails/send-newsletter",
                            json={"subject": "News", "message": "Body", "recipientGroups": ["customers"]},
                            headers=_auth("FarmManager"))

        count = client.get("/api/notifications/unread-count", headers=_auth("FarmManager"))

    assert count.json()["unreadCount"] == 0
