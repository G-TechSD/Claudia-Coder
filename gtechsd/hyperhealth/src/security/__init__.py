"""Security package initialization.

The :mod:`src.security` package contains utilities for encryption,
audit logging and consent management.  The public API is intentionally
minimal to keep the top‑level namespace clean.
"""

from .crypto import encrypt_data, decrypt_data