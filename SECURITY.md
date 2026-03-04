# Security & Compliance (TEBBI)

## Data Protection

- **Encryption at rest**: Sensitive fields (phone numbers, API keys, patient data in transit to AI) are encrypted using `crypto_utils` (AES-256-GCM when `ENCRYPTION_KEY` is set; Fernet for legacy) before storage in MongoDB. **Production:** You must set `ENCRYPTION_KEY` in the environment (at least 32 bytes). The application will not start in production if `ENCRYPTION_KEY` is missing or derived from `JWT_SECRET`.
- **Passwords**: Stored as bcrypt hashes. Never logged or returned in API responses.
- **JWT**: Access tokens are signed with `JWT_SECRET`. **Production:** You must set a strong, unique `JWT_SECRET` (32+ characters). The application will not start in production if the default development secret is used.

## Production Startup Requirements

When `PRODUCTION=true`, the server validates at startup and **refuses to start** if:

- `JWT_SECRET` is unset or still the default dev value.
- `ENCRYPTION_KEY` is unset or shorter than 32 bytes.
- `CORS_ORIGINS` is `*` (must be explicit frontend origin(s), e.g. `https://app.example.com`).

See [docs/secrets.md](docs/secrets.md) and use a secrets manager (e.g. AWS Secrets Manager, HashiCorp Vault) for production; never commit secrets.

## Audit & Compliance

- **Audit logs**: Actions (login, create/update/delete of patients, appointments, invoices, invoice updates, expenses, staff, companies, online booking, patient documents) and **every AI request** (endpoint and optional patient_id; no PHI content stored in audit details) are recorded in `audit_logs` with timestamp, user, action, resource type, and optional details. Access via `GET /api/audit-logs` (scoped by company for non–super-admin).
- **Role-based access**: Data is isolated by `company_id` for clinic staff; super_admin can see all. Patient portal uses separate JWT scoped to a single patient.

## Operational Security

- **Rate limiting**: Login and API have rate limiters to reduce brute-force and abuse.
- **CORS**: In production, set `CORS_ORIGINS` to your frontend origin(s) only; wildcard `*` is rejected at startup.
- **HTTPS**: Use TLS in production for all traffic. Nginx (see `deploy/nginx.conf`) terminates TLS and adds security headers: HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, and Content-Security-Policy. Adjust CSP if your frontend requires inline scripts or specific CDNs.

## Critical Flows and AI

**Core workflows (patients, appointments, invoices, billing, online booking, backups) do not depend on AI.** They are deterministic and always available. AI features (`/api/ai/*`) are optional assistants (symptom analysis, image analysis, reports, chat, etc.). When AI is enabled, ensure you have a BAA with the provider (e.g. OpenAI, Google) if PHI is sent; see [docs/baa-checklist.md](docs/baa-checklist.md).

## HIPAA / GDPR and Ongoing Compliance

- **MFA**: TOTP-based MFA is implemented and can be required per company for staff.
- **HIPAA / GDPR**: Document data retention, breach procedures (see [docs/breach-notification-policy.md](docs/breach-notification-policy.md) and runbook in [docs/operations.md](docs/operations.md)), and consent; use BAA with any subprocessors that handle PHI.
- **Annual**: Conduct risk assessment (see [docs/risk-assessment-template.md](docs/risk-assessment-template.md)) and staff training (see [docs/training-compliance.md](docs/training-compliance.md)).
