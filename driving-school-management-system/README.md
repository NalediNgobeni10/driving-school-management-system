# DriveRight

DriveRight is a driving school management and learning platform with separate NestJS and React applications.

## Stack

- Backend: NestJS, TypeScript, Prisma, PostgreSQL
- Frontend: React, TypeScript, Vite, React Router, Axios
- Authentication: 12-hour signed JWT sessions; password hashes use Node.js scrypt

## Run locally

Use Node.js 20.19+ and PostgreSQL. Configure `backend/.env` from `backend/.env.example`, set a PostgreSQL `DATABASE_URL`, and set a long random `JWT_SECRET`. Optionally set `ADMIN_EMAIL` and `ADMIN_PASSWORD` to create the initial administrator during seed. `LESSON_PRICE` sets the amount recorded for each new booking (defaults to 350 ZAR).

Apply the Phase 2 schema and seed the K53 study notes:

```bash
cd backend
npm install
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev
```

To initialize a fresh local database during development, `npx prisma migrate dev` can be used in place of `npx prisma migrate deploy`.

Configure `frontend/.env` from `frontend/.env.example` if needed, then run the app:

```bash
cd frontend
npm install
npm run dev
```

The API is served under `http://localhost:3000/api`; Vite defaults to `http://localhost:5173`.

## Phase 2 features

- Student self-registration and one shared login, routed by the authenticated role.
- Student lessons, explicit instructor availability, car selection, progress and feedback, K53 notes and quiz, and messaging.
- Instructor schedules, lesson completion/no-show handling, availability management, and messaging.
- Admin school metrics, booking cancellation, payment tracking, account enrollment, fleet management, and messaging.
- Role checks and ownership checks are enforced in the API as well as by protected frontend routes.

## Student Lesson Booking System (Latest Addition)

This submission adds the core infrastructure for the student lesson booking system:

### Backend Implementation (NestJS + Prisma)
- **Prisma Schema** (`backend/prisma/schema.prisma`): Database models for the lesson booking system
- **App Module** (`backend/src/app.module.ts`): Main application module configuration
- **Features Controller** (`backend/src/features/features.controller.ts`): API endpoints for lesson management features
- **Features Service** (`backend/src/features/features.service.ts`): Business logic for lesson booking operations
- **Prisma Module** (`backend/src/prisma/prisma.module.ts`): Database connection module
- **Prisma Service** (`backend/src/prisma/prisma.service.ts`): Prisma client service for database operations
- **Main Entry Point** (`backend/src/main.ts`): NestJS application bootstrap
- **Feature DTOs** (`backend/src/features/dto/feature.dto.ts`): Data transfer objects for API requests/responses

### Frontend Implementation (React)
- **App Component** (`frontend/src/App.tsx`): Main application component with routing
- **API Client** (`frontend/src/api/client.ts`): Axios HTTP client for backend communication
- **Authentication Context** (`frontend/src/auth/AuthContext.tsx`): Updated authentication state management
- **Main Entry Point** (`frontend/src/main.tsx`): React application bootstrap
- **Styling** (`frontend/src/index.css`): Updated visual styles for the booking interface

## Main source layout

```text
backend/prisma/schema.prisma        Data model for users, lessons, cars, payments and study notes
backend/prisma/migrations/          PostgreSQL migration history
backend/src/auth/                   Registration, login, password hashing and JWT validation
backend/src/features/               Role-aware dashboard and feature API
backend/src/prisma/                 Shared Prisma client module
frontend/src/api/client.ts          Axios instance and typed API models
frontend/src/auth/AuthContext.tsx   Session state and login/register actions
frontend/src/App.tsx                Role-based routes and dashboard workflows
frontend/src/index.css              DriveRight visual system and responsive layout
```
