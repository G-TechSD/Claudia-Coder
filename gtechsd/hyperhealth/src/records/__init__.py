"""Record storage package.

This module provides a thin wrapper around an encrypted SQLite database
that stores patient health records in compliance with HIPAA.  The
implementation uses :mod:`sqlalchemy` for ORM mapping and the
``cryptography`` helpers from :mod:`src.security.crypto`.
"""

from .database import RecordDatabase