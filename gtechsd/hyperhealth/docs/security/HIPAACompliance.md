# HIPAA Compliance Guide

This document outlines the security controls, data handling practices, and audit procedures that ensure **HyperHealth** meets or exceeds HIPAA requirements.

## 1. Data Classification

| Category | Description | Handling |
|----------|-------------|----------|
| PHI (Protected Health Information) | Any personal health record, test result, or communication transcript | Encrypted at rest & in transit; access logged |
| Non‑PHI | Publicly available medical guidelines, drug databases | Stored unencrypted but access restricted to authenticated users |

## 2. Encryption

* **At Rest** – AES‑GCM 256‑bit with per‑user key derived from a master key stored in a secure enclave.
* **In Transit** – TLS 1.3 for all network traffic; mutual authentication for internal APIs.

## 3. Key Management

* Master key rotated quarterly via automated script.
* User keys are derived using PBKDF2‑HMAC‑SHA256 with 100,000 iterations.
* Keys never leave the device unless explicitly exported by the user.

## 4. Access Control

* Role‑based access: `patient`, `admin`, `lawyer`.
* Fine‑grained permissions on record segments (e.g., lab results vs. billing).

## 5. Audit Logging

* Immutable log entries stored in a separate write‑once storage.
* Log retention period: 7 years, aligned with HIPAA.

## 6. Consent Management

* Explicit opt‑in for call recording and data sharing.
* UI flow to revoke consent at any time.

## 7. Incident Response

1. Detect anomalous access patterns via automated alerts.
2. Notify affected users within 72 h.
3. Conduct forensic analysis and patch vulnerabilities.

---

### Appendices

- [Key Rotation Script](./scripts/key_rotation.py)
- [Audit Log Schema](./docs/security/AuditLogSchema.md)