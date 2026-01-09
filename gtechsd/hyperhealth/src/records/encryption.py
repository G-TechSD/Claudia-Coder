"""
Encryption utilities for the Patient Health Record system.

Provides AES‑GCM encryption/decryption, key derivation and rotation helpers.
"""

from __future__ import annotations

import os
import base64
import hashlib
import hmac
from dataclasses import dataclass
from typing import Tuple

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend


@dataclass(frozen=True)
class EncryptionKey:
    """Container for an encryption key and its metadata."""
    key: bytes
    iv: bytes  # Initialization vector (nonce)

def derive_user_key(master_key: bytes, user_id: str) -> Tuple[bytes, bytes]:
    """
    Derive a per‑user key using PBKDF2-HMAC-SHA256.
    Returns the derived key and an IV for AES‑GCM.
    """
    salt = hashlib.sha256(user_id.encode()).digest()
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        master_key,
        salt,
        100_000,
        dklen=64,  # 32 bytes key + 32 bytes IV
    )
    return dk[:32], dk[32:]

def encrypt_data(data: bytes, key: bytes, iv: bytes) -> Tuple[str, str]:
    """
    Encrypt *data* using AES‑GCM.
    Returns base64‑encoded ciphertext and authentication tag.
    """
    cipher = Cipher(algorithms.AES(key), modes.GCM(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    ct = encryptor.update(data) + encryptor.finalize()
    return base64.b64encode(ct).decode(), base64.b64encode(encryptor.tag).decode()

def decrypt_data(ciphertext_b64: str, tag_b64: str, key: bytes, iv: bytes) -> bytes:
    """
    Decrypt *ciphertext* using AES‑GCM.
    """
    ct = base64.b64decode(ciphertext_b64)
    tag = base64.b64decode(tag_b64)
    cipher = Cipher(algorithms.AES(key), modes.GCM(iv, tag), backend=default_backend())
    decryptor = cipher.decryptor()
    return decryptor.update(ct) + decryptor.finalize()

def load_master_key() -> bytes:
    """
    Load or generate the master key.
    The key is stored in a file named `master.key` in the project root.
    If the file does not exist, create it with secure random bytes.
    """
    path = os.path.join(os.getcwd(), "master.key")
    if os.path.exists(path):
        with open(path, "rb") as f:
            return f.read()
    # Generate a new master key
    key = os.urandom(32)
    with open(path, "wb") as f:
        f.write(key)
    return key

def get_user_encryption_key(user_id: str) -> EncryptionKey:
    """
    Convenience wrapper that returns an *EncryptionKey* instance.
    """
    master = load_master_key()
    k, iv = derive_user_key(master, user_id)
    return EncryptionKey(key=k, iv=iv)