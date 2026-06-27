# AI Student Peer Comparison, Academic Tracking, and Motivation Portal

A production-style full-stack educational platform with student and instructor portals, role-based access control, attendance tracking, marks publishing, rank calculation, anonymized peer comparison, AI doubt solving, AI feedback, report history, analytics, and seeded demo data.

## Tech Stack

- Frontend: React, Vite, React Router, Axios, Recharts, Lucide icons
- Backend: Node.js, Express, Prisma ORM
- Database: SQLite for local demo by default; switch `DATABASE_URL` to PostgreSQL/MySQL for deployment
- Auth: JWT plus bcrypt password hashing
- AI: OpenAI API for student assistant chat; local deterministic fallback remains for non-chat demo reports
- Validation: Zod

## Folder Structure

```text
.
├── client
│   ├── index.html
│   ├── package.json
│   └── src
│       ├── App.jsx
│       ├── api.js
│       ├── main.jsx
│       └── styles.css
├── server
│   ├── .env.example
│   ├── package.json
│   ├── prisma
│   │   ├── schema.prisma
│   │   └── seed.js
│   └── src
│       ├── app.js
│       ├── middleware
│       │   └── auth.js
│       ├── prisma.js
│       ├── routes
│       │   ├── ai.js
│       │   ├── auth.js
│       │   ├── instructor.js
│       │   └── student.js
│       ├── server.js
│       ├── services
│       │   ├── academicService.js
│       │   └── aiService.js
│       ├── utils
│       │   └── http.js
│       └── validators.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Setup Commands

```bash
npm install
npm run install:all
cp server/.env.example server/.env
npm run seed
npm run dev
```

The API runs at `http://localhost:5000` and the web app runs at `http://localhost:5173`.

On Windows PowerShell, if `npm` is blocked by script policy, use `npm.cmd`:

```powershell
npm.cmd install
npm.cmd run install:all
Copy-Item server/.env.example server/.env
npm.cmd run seed
npm.cmd run dev
```

If Vite dev dependency pre-bundling is blocked by a restricted Windows/OneDrive sandbox, use the verified production preview flow instead:

```powershell
npm.cmd --prefix client run build
Start-Process powershell -ArgumentList '-NoProfile','-Command','cd "C:\Users\ADMIN\OneDrive\Documents\student report\server"; npm.cmd run start'
Start-Process powershell -ArgumentList '-NoProfile','-Command','cd "C:\Users\ADMIN\OneDrive\Documents\student report\client"; npm.cmd run preview'
```

## Environment Variables

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="replace-with-a-long-random-secret"
JWT_EXPIRES_IN="7d"
PORT=5000
CLIENT_ORIGIN="http://localhost:5173"
OPENAI_API_KEY="sk-your-openai-api-key-here"
OPENAI_MODEL="gpt-4o-mini"
VITE_API_URL="http://localhost:5000/api"
```

For production, use a managed PostgreSQL or MySQL connection string in `DATABASE_URL`, set a strong `JWT_SECRET`, and set `OPENAI_API_KEY` only on the backend.

To enable real OpenAI answers, create an API key in your OpenAI platform account, paste it into `server/.env`, and restart the backend server. The student assistant chat requires `OPENAI_API_KEY`; without it, the assistant shows a setup message instead of giving fallback answers.

After adding the key, verify it from the server folder:

```bash
npm run check:openai
```

Free local AI option:

If you do not want API payments, install Ollama on the server/computer, pull a model, and set the provider in `server/.env`:

```env
AI_PROVIDER="ollama"
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llama3.2:3b"
```

Then run:

```bash
ollama pull llama3.2:3b
npm run check:ollama
```

Ollama does not require OpenAI credits, but it runs on your own computer/server and answer quality depends on the local model and hardware.

## Demo Accounts

```text
Student
email: student@smartedu.test
password: Password123!

Instructor
email: instructor@smartedu.test
password: Password123!
```

## Core Security Rules Implemented

- Students can only access `/api/student/*` and `/api/ai/*` student actions.
- Students cannot create, edit, or publish marks or attendance.
- Instructors can only access assigned batches through subject assignments.
- Marks and attendance writes are guarded by instructor role checks and assignment checks.
- Student peer comparison returns anonymized distribution labels only.
- AI API keys are used only on the backend.

## API Overview

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/student/dashboard`
- `GET /api/student/profile`
- `GET /api/student/attendance`
- `GET /api/student/marks`
- `GET /api/student/rank`
- `GET /api/student/reports`
- `GET /api/student/feedback`
- `GET /api/student/assistant/history`
- `GET /api/instructor/dashboard`
- `GET /api/instructor/students`
- `GET /api/instructor/students/:id`
- `GET /api/instructor/subjects`
- `POST /api/instructor/attendance`
- `POST /api/instructor/marks`
- `PATCH /api/instructor/marks/:examId`
- `PATCH /api/instructor/marks/:examId/publish`
- `GET /api/instructor/analytics`
- `GET /api/instructor/reports`
- `POST /api/instructor/students/:studentId/remarks`
- `POST /api/ai/chat`
- `POST /api/ai/feedback`
- `POST /api/ai/peer-report`

## GitHub Push Commands

```bash
git init
git add .
git commit -m "Initial smart education portal"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/smart-education-portal.git
git push -u origin main
```

## ZIP Creation Command

```bash
zip -r smart-education-portal.zip .
```
