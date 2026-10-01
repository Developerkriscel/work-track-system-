# AI Candidate / Resume Analysis Setup

This project now has a secure server-side AI candidate analyzer.

## What it does

- HR/Admin/Super Admin can open **AI Hiring** from the side menu.
- They can enter the job requirement, candidate details, and upload a resume PDF.
- The backend sends the request to OpenAI and returns:
  - candidate score out of 100
  - shortlist recommendation
  - matched skills
  - missing skills
  - strengths
  - risks to verify
  - interview questions
  - suggested next step

## Files added

- `server/services/candidateAi.service.js`
- `server/routes/candidateAi.routes.js`
- `client/src/features/candidate-ai/CandidateAiPage.jsx`
- `client/src/features/candidate-ai/api.js`

## Environment setup

Add these to your server environment file:

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_CANDIDATE_MODEL=gpt-5-mini
```

Keep `OPENAI_API_KEY` only on the backend. Never add it to frontend `VITE_` variables.

## How to use

1. Restart the backend after adding the environment variables.
2. Login as HR, Admin, or Super Admin.
3. Open **AI Hiring**.
4. Paste the job requirement/JD.
5. Fill candidate details.
6. Upload resume PDF, up to 8 MB.
7. Click **Analyze Candidate**.

## API endpoint

```http
POST /api/candidate-ai/analyze
```

Auth: employee session required.

Allowed roles:

- HR
- Admin
- Super Admin

Request body:

```json
{
  "jobRequirement": "SEO Executive with 2+ years experience...",
  "candidate": {
    "name": "Candidate Name",
    "email": "candidate@example.com",
    "experience": "3 years",
    "skills": "SEO, GSC, GA4, keyword research"
  },
  "resume": {
    "fileName": "resume.pdf",
    "contentType": "application/pdf",
    "base64": "base64-pdf-content"
  }
}
```

## Good JD format

For best results, include:

- role title
- must-have skills
- good-to-have skills
- years of experience
- tools/software
- salary range if relevant
- location/work mode
- responsibilities

Example:

```text
SEO Executive, 2+ years experience.
Must know keyword research, Google Search Console, GA4, on-page SEO, technical SEO basics, monthly client reporting.
Good to have: WordPress, Screaming Frog, local SEO.
Location: Indore. Salary: 20k-30k.
```

## Notes

- AI score is an assistant for screening, not the final hiring decision.
- Always verify candidate claims manually.
- Avoid using protected personal attributes in ranking decisions.
