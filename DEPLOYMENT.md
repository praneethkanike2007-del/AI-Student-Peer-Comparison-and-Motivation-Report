# Deployment Checklist

## 1. Push to GitHub

Install Git if `git --version` does not work:

```powershell
winget install --id Git.Git -e --source winget
```

Then open a new terminal:

```powershell
cd "C:\Users\ADMIN\OneDrive\Documents\student report"
git init
git add .
git commit -m "Initial smart education portal"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

## 2. Deploy Backend

Deploy the `server` folder to Render, Railway, or another Node host.

Use these commands/settings:

```text
Root directory: server
Build command: npm install && npx prisma generate
Start command: npm run start
```

Use a hosted PostgreSQL/MySQL database for production. SQLite is only for local demo.

Set backend environment variables:

```env
DATABASE_URL="your-production-database-url"
JWT_SECRET="a-long-random-production-secret"
JWT_EXPIRES_IN="7d"
PORT=5000
CLIENT_ORIGIN="https://your-vercel-app.vercel.app"
AI_PROVIDER="ollama"
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llama3.2:3b"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o-mini"
```

If using OpenAI instead of Ollama:

```env
AI_PROVIDER="openai"
OPENAI_API_KEY="sk-your-real-key"
```

## 3. Deploy Frontend To Vercel

Import the GitHub repository into Vercel.

Vercel will use `vercel.json` from this project:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "client/dist"
}
```

Set this Vercel environment variable:

```env
VITE_API_URL="https://your-backend-domain.com/api"
```

After deployment, update backend `CLIENT_ORIGIN` to the final Vercel URL.

## 4. Production Notes

- Public visitors can see the homepage only.
- Approved students and instructors can login.
- Instructors can add/remove students from assigned batches.
- Do not commit real `.env` files or API keys.
