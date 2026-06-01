"""Unit tests for services/email_service.py (US39)."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import smtplib
from unittest.mock import MagicMock, patch

import pytest

import services.email_service as email_svc


# ── is_smtp_configured ───────────────────────────────────────────────────────

def test_smtp_configured_all_vars_set(monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_USER", "user@example.com")
    monkeypatch.setenv("SMTP_PASSWORD", "secret")
    assert email_svc.is_smtp_configured() is True


def test_smtp_not_configured_missing_host(monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "")
    monkeypatch.setenv("SMTP_USER", "user@example.com")
    monkeypatch.setenv("SMTP_PASSWORD", "secret")
    assert email_svc.is_smtp_configured() is False


def test_smtp_not_configured_missing_user(monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_USER", "")
    monkeypatch.setenv("SMTP_PASSWORD", "secret")
    assert email_svc.is_smtp_configured() is False


def test_smtp_not_configured_missing_password(monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_USER", "user@example.com")
    monkeypatch.setenv("SMTP_PASSWORD", "")
    assert email_svc.is_smtp_configured() is False


# ── send_email ────────────────────────────────────────────────────────────────

def test_send_email_raises_value_error_when_not_configured(monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "")
    monkeypatch.setenv("SMTP_USER", "")
    monkeypatch.setenv("SMTP_PASSWORD", "")
    with pytest.raises(ValueError, match="SMTP not configured"):
        email_svc.send_email("a@b.com", "Subject", "<p>hello</p>")


def test_send_email_calls_smtp_send(monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USER", "user@example.com")
    monkeypatch.setenv("SMTP_PASSWORD", "secret")
    monkeypatch.setenv("SMTP_FROM", "noreply@example.com")

    mock_smtp_instance = MagicMock()
    mock_smtp_cls = MagicMock(return_value=mock_smtp_instance)
    mock_smtp_instance.__enter__ = MagicMock(return_value=mock_smtp_instance)
    mock_smtp_instance.__exit__ = MagicMock(return_value=False)

    with patch("smtplib.SMTP", mock_smtp_cls):
        email_svc.send_email("recipient@example.com", "Hello", "<p>Hi</p>", "Hi")

    mock_smtp_instance.login.assert_called_once_with("user@example.com", "secret")
    mock_smtp_instance.send_message.assert_called_once()


def test_send_email_propagates_smtp_exception(monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USER", "user@example.com")
    monkeypatch.setenv("SMTP_PASSWORD", "secret")

    mock_smtp_instance = MagicMock()
    mock_smtp_instance.__enter__ = MagicMock(return_value=mock_smtp_instance)
    mock_smtp_instance.__exit__ = MagicMock(return_value=False)
    mock_smtp_instance.send_message.side_effect = smtplib.SMTPException("Network error")

    with patch("smtplib.SMTP", MagicMock(return_value=mock_smtp_instance)):
        with pytest.raises(smtplib.SMTPException):
            email_svc.send_email("r@example.com", "Subj", "<p>body</p>")


def test_send_email_uses_smtp_from_env(monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USER", "user@example.com")
    monkeypatch.setenv("SMTP_PASSWORD", "secret")
    monkeypatch.setenv("SMTP_FROM", "farm@pepper.com")

    sent_msgs = []
    mock_smtp = MagicMock()
    mock_smtp.__enter__ = MagicMock(return_value=mock_smtp)
    mock_smtp.__exit__ = MagicMock(return_value=False)
    mock_smtp.send_message.side_effect = lambda msg: sent_msgs.append(msg)

    with patch("smtplib.SMTP", MagicMock(return_value=mock_smtp)):
        email_svc.send_email("r@example.com", "Test", "<p>test</p>")

    assert len(sent_msgs) == 1
    assert sent_msgs[0]["From"] == "farm@pepper.com"
