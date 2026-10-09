# Stage 16B: Professional Mother Authentication & Baby Onboarding

## Overview
This stage transforms the architectural foundation of Stage 16A into a fully functional, professional-grade mother-facing application. The focus is on onboarding: secure registration and login for the mother, seamless session restoration, and a clean baby registration process that guarantees a one-to-one mother-to-baby relationship.

## Features Implemented

### 1. Mother Authentication
- **Registration Flow:** Implemented `/register` supporting full name, email, and password (with client-side confirmation check). Connects directly to the Stage 15H-A authentication backend.
- **Login Flow:** Implemented `/login` with credentials. Updated the frontend API layer to properly serialize login requests as JSON (`application/json`), as defined by the updated `BaseModel` schema of the FastAPI backend.
- **Session Restoration:** Ensured that `GET /api/v1/auth/me` perfectly restores application state, securing all protected routes against unauthorized access.
- **Error Handling:** Graceful user-friendly error banners are presented for issues like duplicate emails (`400 Bad Request`) or invalid credentials (`401 Unauthorized`).

### 2. Baby Onboarding Decision
- **Onboarding Guard:** An intelligent `AppShell` checks the status of `GET /api/v1/baby/profile`. If a `404 Not Found` is returned, the mother is seamlessly redirected to the `/baby/register` page to complete onboarding.
- **Bypass for Existing:** Mothers with an already registered baby bypass this flow and land securely on the dashboard.

### 3. Baby Registration Flow
- **Data Completeness:** Collects necessary details such as Name, Biological Sex, Date of Birth, and Birth Weight (required parameters), alongside optional factors (Birth Length, Gestational Age, Birth Order, Delivery Type, APGAR score).
- **Backend Compatibility:** Adheres strictly to the `BabyCreate` schema structure and expected literal values (`Male`, `Female`).
- **Security:** The backend correctly uses the authenticated mother's session to assign ownership. The frontend actively prevents exposure or manual input of `owner_id` or `child_id`.

### 4. Baby Profile Page
- **Read-Only Dashboard:** Implemented `/baby` to display all recorded birth parameters gracefully.
- **Calculated Display Age:** Client-side only calculation to display user-friendly age without interfering with precise scientific ML inputs.

## Responsive Design Implementation
All pages are fully responsive:
- **Mobile (`< 768px`):** Single-column stack, full width cards, bottom navigation tab bar.
- **Tablet (`768px - 1024px`):** Enhanced grid usage for forms (2 columns for birth details).
- **Desktop (`> 1024px`):** Persistent left sidebar, optimized max-width forms, and readable content spacing.

## Validation & Test Coverage
- Comprehensive suite of 20 Vitest tests running successfully.
- Tests enforce correct rendering, state management, form validation mismatches, and route protections.
- Zero TypeScript errors across the entire codebase.
- No dummy/mocked scientific endpoints are presented.

## Known Limitations
- The baby profile is currently read-only, awaiting full Edit capabilities if supported by the backend in a later stage.
- Only one baby is allowed per mother in this iteration of the prototype, which matches backend constraints.
