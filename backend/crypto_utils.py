"""
Encryption helpers for sensitive fields at rest (PHI and secrets).
- AES-256-GCM: used when ENCRYPTION_KEY is 32+ bytes (prefix "a256:").
- Fernet (AES-128): legacy, prefix "enc:" for backward compatibility.
Handles legacy plaintext: if decrypt fails, return value as-is.
"""
import base64
import logging
import os
from typing import Optional

from config import settings

logger = logging.getLogger(__name__)

_FERNET = None
_PREFIX_LEGACY = "enc:"
_PREFIX_A256 = "a256:"


def _get_fernet():
    global _FERNET
    if _FERNET is not None:
        return _FERNET
    key = settings.encryption_key
    if key and len(key) >= 32:
        try:
            from cryptography.fernet import Fernet
            raw = key.encode("utf-8")[:32].ljust(32)[:32]
            key_b64 = base64.urlsafe_b64encode(raw).decode("ascii")
            _FERNET = Fernet(key_b64.encode())
        except Exception as e:
            logger.warning("ENCRYPTION_KEY invalid, Fernet disabled: %s", e)
            _FERNET = False
    else:
        secret = settings.jwt_secret
        try:
            from cryptography.fernet import Fernet
            from cryptography.hazmat.primitives import hashes
            from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
            kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=b"tebbi_salt_01", iterations=100000)
            key_b64 = base64.urlsafe_b64encode(kdf.derive(secret.encode("utf-8")[:64].ljust(64)[:64]))
            _FERNET = Fernet(key_b64)
        except Exception as e:
            logger.warning("Fernet init failed, encryption disabled: %s", e)
            _FERNET = False
    return _FERNET


def _get_a256_key() -> Optional[bytes]:
    """32-byte key for AES-256. From ENCRYPTION_KEY or derived from JWT_SECRET."""
    key = settings.encryption_key
    if key and len(key) >= 32:
        return key.encode("utf-8")[:32].ljust(32)[:32]
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=b"tebbi_a256_01", iterations=100000)
    return kdf.derive((settings.jwt_secret or "").encode("utf-8")[:64].ljust(64)[:64])


def _encrypt_a256(plain: str) -> Optional[str]:
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        key = _get_a256_key()
        nonce = os.urandom(12)
        aesgcm = AESGCM(key)
        ct = aesgcm.encrypt(nonce, plain.encode("utf-8"), None)
        payload = base64.urlsafe_b64encode(nonce + ct).decode("ascii")
        return _PREFIX_A256 + payload
    except Exception as e:
        logger.warning("AES-256-GCM encrypt failed: %s", e)
        return None


def _decrypt_a256(cipher: str) -> Optional[str]:
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        payload = cipher[len(_PREFIX_A256):]
        raw = base64.urlsafe_b64decode(payload)
        nonce, ct = raw[:12], raw[12:]
        key = _get_a256_key()
        aesgcm = AESGCM(key)
        return aesgcm.decrypt(nonce, ct, None).decode("utf-8")
    except Exception:
        return None


def encrypt_field(plain: Optional[str]) -> Optional[str]:
    """Encrypt with AES-256-GCM when possible; fallback to Fernet for compatibility."""
    if plain is None or plain == "":
        return plain
    out = _encrypt_a256(plain)
    if out is not None:
        return out
    f = _get_fernet()
    if not f:
        return plain
    try:
        return _PREFIX_LEGACY + f.encrypt(plain.encode("utf-8")).decode("ascii")
    except Exception as e:
        logger.warning("Encrypt failed: %s", e)
        return plain


def decrypt_field(cipher: Optional[str]) -> Optional[str]:
    """Decrypt: supports a256: (AES-256-GCM) and enc: (Fernet) and legacy plaintext."""
    if cipher is None or cipher == "":
        return cipher
    if not isinstance(cipher, str):
        return cipher
    if cipher.startswith(_PREFIX_A256):
        dec = _decrypt_a256(cipher)
        return dec if dec is not None else cipher[len(_PREFIX_A256):]
    if cipher.startswith(_PREFIX_LEGACY):
        f = _get_fernet()
        if not f:
            return cipher[len(_PREFIX_LEGACY):]
        try:
            return f.decrypt(cipher[len(_PREFIX_LEGACY):].encode("ascii")).decode("utf-8")
        except Exception:
            return cipher[len(_PREFIX_LEGACY):] if len(cipher) > len(_PREFIX_LEGACY) else cipher
    return cipher
