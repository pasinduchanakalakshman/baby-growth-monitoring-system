# Stage 16A - Professional Frontend Foundation

## Purpose
The purpose of Stage 16A is to scaffold and establish a professional, responsive React web application foundation for the Baby Growth Monitoring system. This foundation integrates seamlessly with the existing Stage 15 FastAPI backend via a Dockerized architecture and proxy, ensuring that all UI/UX components are built for future extensibility while strictly prohibiting any frontend calculation of scientific estimates.

## Existing Repository Inspection
The `frontend/` directory was inspected and found to only contain empty placeholder subdirectories. A complete new setup was initiated using Vite, React, and TypeScript.

## Frontend Technology Stack
- **Framework**: React via Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS & shadcn/ui
- **State/Data Fetching**: TanStack Query
- **Routing**: React Router DOM
- **Icons**: Lucide React
- **Testing**: Vitest + React Testing Library

## Docker Integration
A `Dockerfile` has been added to the `frontend/` directory based on `node:20-alpine`. The `docker-compose.yml` file was updated to include the `frontend` service, mapping port `5173:5173`.

## Architecture Highlights
- **Public Application Architecture**: A responsive Landing page, Login page, and Register page (placeholders for auth mutation actions) are accessible. Guest Routes redirect authenticated users to the `/app` dashboard.
- **Authenticated App Architecture**: The `AppShell` component provides the core layout wrapper for authenticated users, wrapping the `Dashboard` (`/app`) and `AccountPage` (`/account`).
- **Responsive Design**: Designed strictly without mobile canvas constraints (`max-w-[412px]`). Features a full responsive layout with desktop sidebars and mobile bottom navigation.
- **Routing**: Robust route segmentation logic with `<ProtectedRoute>` and `<GuestRoute>` wrappers enforcing access control based on session data.
- **Authentication State Management**: `AuthProvider` (using TanStack Query) wraps the React Router context, checking `/api/v1/auth/me` on initialization and handling session state transitions (e.g. AUTH_LOADING).
- **API Client**: Centralized in `src/api/client.ts`. Features automatic credentials inclusion for backend session cookies and explicit JSON error handling logic.

## UI/UX Placeholders
- **Desktop Navigation**: Sticky sidebar for large screens.
- **Mobile Navigation**: Bottom-anchored navigation bar for small screens.
- **Landing Page**: Professional introduction to the app.
- **Account Foundation**: Shows user profile information (Name, Email).

## Tests
Basic architectural and layout tests implemented via Vitest asserting:
- App renders without crashing.
- No fixed "412px" UI constraints exist.
- No mocked scientific outputs exist in the frontend UI.

## Backend and ML Safety
- All backend files, model versions, and artifact structures are **UNCHANGED**.
- No calculations for WAZ, HAZ, or risk assessments were migrated to the frontend. All outputs will strictly rely on API responses in Stage 16B.
