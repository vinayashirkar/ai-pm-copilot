# 🚀 AI-PM Copilot — Zero-Cost Setup Guide

> **Total monthly cost: $0.00**
> Gemini AI · Groq AI · Supabase · Vercel · GitHub — all free tiers

---

## Overview of Free Services Used

| Service | Purpose | Free Tier |
|---------|---------|-----------|
| [Supabase](https://supabase.com) | Database, Auth, Storage | 500MB DB · 1GB Storage · 50k MAU |
| [Google AI Studio](https://aistudio.google.com) | Gemini 1.5 Flash (AI brain) | 1,500 req/day · 1M tokens/day |
| [Groq](https://console.groq.com) | Llama 3.1 70B (fast AI) | 14,400 req/day · 30 req/min |
| [Vercel](https://vercel.com) | App hosting | Unlimited deploys · 100GB bandwidth |
| [GitHub](https://github.com) | Code storage | Unlimited public/private repos |
| [Resend](https://resend.com) | Email notifications | 3,000 emails/month |

---

## Step-by-Step Setup (No Coding Required)

### Step 1 — GitHub (5 minutes)

1. Go to [github.com](https://github.com) → Sign up (free)
2. Click **New Repository** → Name it `ai-pm-copilot` → Set to Private → Create
3. Download [GitHub Desktop](https://desktop.github.com/) (no command line needed)
4. In GitHub Desktop: **File → Add Local Repository** → Select this `AI-PM Copilot` folder
5. Click **Publish Repository** → Push to GitHub

---

### Step 2 — Supabase Database (10 minutes)

1. Go to [supabase.com](https://supabase.com) → **Start for free** → Sign up with Google
2. Click **New Project** → Name: `ai-pm-copilot` → Choose a strong database password → Save it
3. Wait 2 minutes for project to spin up
4. Go to **SQL Editor** (left sidebar) → **New Query**
5. Open the file `supabase/schema.sql` from this folder → Copy all content → Paste → Click **Run**
6. You should see "Success. No rows returned." — database is set up!

**Get your credentials:**
- Go to **Project Settings** → **API**
- Copy: `Project URL` → this is your `NEXT_PUBLIC_SUPABASE_URL`
- Copy: `anon public` key → this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copy: `service_role` key → this is your `SUPABASE_SERVICE_ROLE_KEY` ⚠️ Keep secret!

**Enable Google Auth (optional):**
- Go to **Authentication** → **Providers** → **Google** → Enable
- Follow the Google OAuth setup instructions shown

---

### Step 3 — Google Gemini API Key (3 minutes)

1. Go to [aistudio.google.com](https://aistudio.google.com) → Sign in with Google
2. Click **Get API Key** (top right) → **Create API Key in new project**
3. Copy the key → this is your `GEMINI_API_KEY`

> **Free tier:** 1,500 requests/day · 1 million tokens/day · No credit card needed

---

### Step 4 — Groq API Key (3 minutes)

1. Go to [console.groq.com](https://console.groq.com) → Sign up (free)
2. Click **API Keys** → **Create API Key** → Name it `ai-pm-copilot`
3. Copy the key → this is your `GROQ_API_KEY`

> **Free tier:** 14,400 requests/day · 30 req/min with Llama 3.1 70B · No credit card needed

---

### Step 5 — Resend Email (optional, 2 minutes)

1. Go to [resend.com](https://resend.com) → Sign up (free)
2. Click **API Keys** → **Create API Key**
3. Copy the key → this is your `RESEND_API_KEY`
4. You can use `onboarding@resend.dev` as the from address for testing

> Skip this if you don't need email notifications yet.

---

### Step 6 — Vercel Deployment (10 minutes)

1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub (free)
2. Click **Add New Project** → **Import** your `ai-pm-copilot` GitHub repo
3. **Framework Preset:** Next.js (auto-detected)
4. **Environment Variables:** Click **Add** for each of these:

```
NEXT_PUBLIC_SUPABASE_URL        = (from Step 2)
NEXT_PUBLIC_SUPABASE_ANON_KEY   = (from Step 2)
SUPABASE_SERVICE_ROLE_KEY       = (from Step 2)
GEMINI_API_KEY                  = (from Step 3)
GROQ_API_KEY                    = (from Step 4)
RESEND_API_KEY                  = (from Step 5, or leave blank)
RESEND_FROM_EMAIL               = onboarding@resend.dev
NEXT_PUBLIC_APP_URL             = https://your-app.vercel.app
```

5. Click **Deploy** → Wait 2-3 minutes
6. Your app is live at: `https://your-app-name.vercel.app` 🎉

---

## Local Development (Optional)

If you want to run the app on your laptop before deploying:

1. Install [Node.js](https://nodejs.org/) (LTS version)
2. Open Terminal / Command Prompt in the `AI-PM Copilot` folder
3. Copy `.env.example` to `.env.local` and fill in your keys
4. Run:
```bash
npm install
npm run dev
```
5. Open [http://localhost:3000](http://localhost:3000)

---

## How to Use the App

### First Time
1. Go to your Vercel URL → Sign up with email or Google
2. Click **New Project** → Enter project name (e.g. "Investor Onboarding") and code (e.g. "IOP")

### Processing a Meeting
1. Open your project → Click **Upload Transcript**
2. Drop in a `.txt`, `.docx`, or `.pdf` file from your meeting
3. Click **Process with Gemini AI** → Wait 30–60 seconds
4. Review the generated MOM → Go to **Review Queue**

### Reviewing Changes
1. **Review Queue** shows all pending MOMs and requirement changes
2. For each item: **Approve** (commits to docs) · **Modify** (edit before committing) · **Reject** (with reason)
3. Every action is logged in the Audit Log

### Generating Artifacts
1. Open your project → Click **Generate** (after processing at least one transcript)
2. This creates: BRD sections · User Stories (US-XXX) · Acceptance Criteria (Gherkin) · Test Cases (TC-XXX)
3. View them under **Documents**

### Exporting to Jira / Azure DevOps
1. Open your project → Scroll to **Export to Delivery Tools**
2. Click **Export Jira CSV** → Download and import to Jira
3. Click **Export ADO JSON** → Download and import to Azure DevOps

---

## Free Tier Limits & What Happens When You Hit Them

| Limit | Impact | Solution |
|-------|--------|---------|
| Gemini: 1,500 req/day | Processing pauses until next day | Process transcripts in batches |
| Groq: 14,400 req/day | Quick operations slow down | Rarely hit at normal usage |
| Supabase: 500MB DB | Old data needs archiving | ~10,000+ meetings before this hits |
| Vercel: 100GB bandwidth | Site may slow | Rarely hit for internal tools |

> **All limits reset daily at midnight UTC.** For typical PM usage (5-10 meetings/week), you will never hit any limit.

---

## Troubleshooting

**"Supabase connection error"**
→ Check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel env vars

**"Gemini AI failed"**
→ Check `GEMINI_API_KEY` is correct and not expired. Re-generate at aistudio.google.com

**"Could not extract text from file"**
→ Make sure the file is not password-protected. Try exporting as plain .txt from your meeting tool

**"No requirements found"**
→ Ensure the transcript contains actual meeting discussion. Test with a real Teams/Zoom export

**Build fails on Vercel**
→ Check the Vercel build logs. Most common: missing environment variable

---

## Architecture Summary

```
User uploads transcript
        ↓
Supabase Storage (file saved)
        ↓
Gemini 1.5 Flash (free API)
  - Extracts MOM, decisions, actions, risks
  - Detects requirement changes vs existing BRD
        ↓
PM Review Queue (nothing auto-committed)
  - PM clicks Approve / Reject / Modify
        ↓
Supabase Database (approved changes saved)
        ↓
Gemini generates: BRD · User Stories · ACs · Test Cases
Groq (Llama 70B) generates: quick summaries · owner recommendations
        ↓
Export: Jira CSV / Azure DevOps JSON
```

---

## Monthly Cost Breakdown

```
Supabase (database + auth + storage)    FREE
Google Gemini API (AI processing)       FREE  (1,500 req/day)
Groq API (fast AI)                      FREE  (14,400 req/day)
Vercel (hosting + CI/CD)               FREE
GitHub (code storage)                   FREE
Resend (email notifications)            FREE  (3,000 emails/month)
─────────────────────────────────────────────
TOTAL                                   $0.00/month
```

---

*Built with ❤️ by Vinaya Shirkar | AI-PM Copilot v1.0 | June 2026*
