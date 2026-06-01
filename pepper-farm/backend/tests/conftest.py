"""
pytest conftest — session-wide setup.

Importing `models` here ensures that every ORM model is registered in
Base.metadata BEFORE any test module's setup_db fixture calls
Base.metadata.create_all(bind=engine).

Without this import, service-level test files that never do
`from main import app` only register the handful of models they import
explicitly, so create_all silently skips tables such as EmailLogs,
NewsletterTemplates, CartItems, etc.
"""
import sys
import os

# Allow `from database import ...` etc. to resolve from the backend root.
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import models  # noqa: F401 — registers ALL ORM models with Base.metadata
