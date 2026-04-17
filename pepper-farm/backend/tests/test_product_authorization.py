import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from fastapi import HTTPException

from utils.jwt import require_role


def test_require_role_allows_farm_manager():
    checker = require_role("FarmManager")

    current_user = {
        "user_id": 1,
        "role": "FarmManager",
    }

    result = checker(current_user)

    assert result == current_user


def test_require_role_blocks_worker():
    checker = require_role("FarmManager")

    current_user = {
        "user_id": 2,
        "role": "Worker",
    }

    with pytest.raises(HTTPException) as exc_info:
        checker(current_user)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Access denied. Required role: FarmManager."


def test_require_role_blocks_visitor():
    checker = require_role("FarmManager")

    current_user = {
        "user_id": 3,
        "role": "Visitor",
    }

    with pytest.raises(HTTPException) as exc_info:
        checker(current_user)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Access denied. Required role: FarmManager."