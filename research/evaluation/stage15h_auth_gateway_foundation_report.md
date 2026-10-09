# Stage 15H-A: Authentication + Gateway + Ownership Foundation Report

## 1. Stage purpose
Convert the development-style backend to a professional authenticated system where a mother registers, logs in, registers ONE baby, and operates securely on her own baby via a Gateway.

## 2. Previous development-user behavior found
Found a mock `get_current_user` in `app.api.routes.baby` which hardcoded an authenticated mother as `dev_mother@example.com` and automatically inserted her into the DB on each request if missing. This logic was completely removed.

## 3. User model changes
Extended the SQLAlchemy `User` model (`app/models/user.py`) to include `password_hash` and `is_active` fields, retaining the existing primary key and relationships.

## 4. Migration details
Alembic was introduced to the child-growth-monitoring-service. A migration was generated (via `alembic revision --autogenerate`) to add the `password_hash` and `is_active` columns to the existing `users` table safely.

## 5. Password hashing
Argon2 (via `passlib[argon2]`) was chosen for secure password hashing. Helper functions `get_password_hash` and `verify_password` were implemented in `app/core/security.py`.

## 6. Authentication strategy
Adopted JWT (JSON Web Tokens). Upon login, a JWT is generated and set in an `HttpOnly`, `SameSite=Lax` cookie (`access_token`). It is secure in production.

## 7. Auth endpoints
Implemented in `app.api.routes.auth`:
- `POST /api/v1/auth/register`: Normalizes email, hashes password, saves user.
- `POST /api/v1/auth/login`: Verifies credentials, returns an `HttpOnly` access token cookie.
- `POST /api/v1/auth/logout`: Clears the access token cookie.
- `GET /api/v1/auth/me`: Returns the current authenticated user safely.

## 8. get_current_user implementation
A robust FastAPI dependency in `app.api.deps` that decodes the JWT from either the cookie or `Authorization` header, looks up the user, checks if active, and returns the User object. Fails with 401 on missing or invalid tokens.

## 9. Baby ownership
`app.api.routes.baby` methods (`get_profile`, `register_baby`, `update_profile`) use `current_user.id` to determine ownership. Multiple baby registration raises a 400 conflict. Mothers cannot access each other's babies.

## 10. Growth ownership
`app.api.routes.growth` methods dynamically look up the baby belonging to the `current_user`. The frontend no longer passes `child_id`; the backend resolves it internally securely.

## 11. Gateway routing
The gateway (FastAPI) now forwards requests to `/api/v1/auth/*`, `/api/v1/baby/*`, and `/api/v1/growth/*` while preserving HTTP methods, headers, status codes, query parameters, and request bodies.

## 12. CORS/cookie configuration
CORS is configured on the Gateway with `allow_origins=["http://localhost:5173"]` and `allow_credentials=True` for browser session compatibility.

## 13. Auth test results
Backend tests confirm duplicate emails are rejected, passwords hashed (and never stored plain), valid logins yield cookies, wrong passwords fail, `/auth/me` protects properly, and logout clears auth state.

## 14. Ownership test results
Tests simulate Mother A and Mother B. They confirm Mother B cannot view or modify Mother A's baby or growth records, establishing firm cross-user isolation.

## 15. Gateway test results
Gateway tests verify proxy rules accurately route paths to the backend and preserve headers/cookies, validating the multi-service architecture flow.

## 16. Stage 15 regression results
Backend tests from Stage 15 remain intact and pass against the new secure authenticated endpoints (where adapted for local testing).

## 17. Frozen artifact verification
Running `stage12_freeze_research_core.py --verify` confirms all ML components, dataset splits, WHO JSON/Excel files, and pipelines remain untouched.

## 18. Docker validation
Docker Compose builds successfully with new dependencies (`alembic`, `passlib`, `python-jose`, `python-multipart`). Services spin up cleanly, communicating via the internal app-network.

## 19. Known warnings
`InconsistentVersionWarning` from Scikit-Learn (1.5 vs 1.4) may persist when loading models, as expected and previously documented. This issue does not affect inference functionality.

## 20. Security limitations
Refresh tokens are not implemented. Argon2 parameters are defaults from `passlib`. HTTPS/TLS must be enforced in the production deployment layer to protect the `HttpOnly` cookie payload.

## 21. Readiness for professional frontend Stage 16
The backend is completely prepared. Authenticated users can register, manage one baby profile, and receive growth/prediction data strictly scoped to their own data. Ready for Stage 16.
