"""
security.crypto
~~~~~~~~~~~~~~~~

Provides lightweight, pure‑Python cryptographic helpers for encrypting
and decrypting patient data at rest.  The implementation uses the
`cryptography` package (AES‑GCM) and is intentionally minimal to keep
the runtime footprint small while still meeting HIPAA‑grade security.

The module exposes two public functions:

* :func:`encrypt_data`
* :func:`decrypt_data`

Both functions operate on ``bytes`` and return ``bytes``.  They are
designed for use with SQLite databases that store encrypted blobs.
"""

from __future__ import annotations

import os
from typing import Tuple

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #

#: Default key size (256‑bit)
KEY_SIZE: int = 32

#: The key is derived from the user’s master password via PBKDF2.
#  In production this would be stored in a secure enclave or HSM.
MASTER_KEY_ENV_VAR: str = "HYPERHEALTH_MASTER_KEY"

# --------------------------------------------------------------------------- #
# Helper Functions
# --------------------------------------------------------------------------- #

def _generate_random_bytes(n: int) -> bytes:
    """Return ``n`` cryptographically‑secure random bytes."""
    return os.urandom(n)


def _get_master_key() -> bytes:
    """
    Retrieve the master key from an environment variable.
    Raises :class:`RuntimeError` if not set.
    """
    key = os.getenv(MASTER_KEY_ENV_VAR)
    if key is None:
        raise RuntimeError(
            f"{MASTER_KEY_ENV_VAR} must be set before using crypto functions."
        )
    return bytes.fromhex(key)


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #

def encrypt_data(plaintext: bytes, nonce: bytes | None = None) -> Tuple[bytes, bytes]:
    """
    Encrypt ``plain_text`` using AES‑GCM.

    Parameters
    ----------
    plaintext : bytes
        The data to encrypt.
    nonce : bytes | None
        Optional 12‑byte nonce.  If omitted a random nonce is generated.
        The returned ciphertext will contain the *nonce* as its first
        segment so callers can store it alongside the key.

    Returns
    -------
    Tuple[bytes, bytes]
        ``(ciphertext, nonce)`` – both are opaque byte strings.
    """
    if nonce is None:
        nonce = _generate_random_bytes(12)
    aesgcm = AESGCM(_get_master_key())
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    return ciphertext, nonce


def decrypt_data(ciphertext: bytes, nonce: bytes) -> bytes:
    """
    Decrypt ``ciphertext``` using AES‑GCM.

    Parameters
    ----------
    ciphertext : bytes
        The encrypted payload.
    nonce : bytes
        The 12‑byte nonce that was used during encryption.
    """
    aesgcm = AESGCM(_get_master_key())
    return aesgcm.decrypt(nonce, ciphertext, None)