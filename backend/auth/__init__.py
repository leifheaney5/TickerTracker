# Auth package. `current_user_id` lives here so `from auth import current_user_id`
# keeps working now that `auth` is a package (was previously backend/auth.py).
# Task 6 replaces the body below with the Flask-Login session lookup.


def current_user_id() -> int:
    return 1
