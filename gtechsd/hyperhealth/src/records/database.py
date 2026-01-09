"""
records.database
~~~~~~~~~~~~~~~~

Provides a simple, encrypted SQLite database wrapper that persists
patient records.  The data is stored as binary blobs and encrypts
the entire row using :func:`encrypt_data` from :mod:`src.security.crypto`.

The design intentionally keeps the database schema lightweight,
the focus being on record persistence rather than complex queries.
"""

from __future__ import annotations

import os
from typing import List, Tuple

import sqlalchemy as sa
from sqlalchemy.orm import declarative_base, sessionmaker

.. (implementation omitted for brevity) ...