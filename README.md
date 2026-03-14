# Acquerello Scheduler

Production-oriented web app for Acquerello's weekly kitchen schedule workflow.

## Structure

- `frontend/`: Next.js App Router app for the chef conversation, voice capture, reasoning stream, settings, and history
- `backend/`: FastAPI app wrapping the deterministic scheduling engine, integrity check, persistence, artifacts, and email delivery
- `src/`: original local scheduling engine reference
- `BUILD_WEBAPP.md`: source build specification

## Runtime Flow

1. Chef speaks or types weekly notes in the frontend.
2. The frontend proxies transcription to OpenAI and conversation parsing to Claude Haiku.
3. The confirmed `week_config` and weekly notes are streamed to the backend.
4. The backend runs the mandatory integrity check, then the deterministic scheduler, validation, artifact generation, and persistence.
5. The frontend renders the live reasoning stream and pivot preview.
6. The generated workbook can be emailed through Resend and downloaded from history.

## Environment

Frontend:

- `BACKEND_URL`
- `NEXT_PUBLIC_APP_URL`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `TRANSCRIBE_MODEL`
- `ANTHROPIC_CHAT_MODEL`

Backend:

- `APP_ENV`
- `FRONTEND_URL`
- `CORS_ORIGINS`
- `DATABASE_URL`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_INTEGRITY_MODEL`
- `INTEGRITY_CHECK_MODE`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `S3_BUCKET`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_REGION`
- `S3_ENDPOINT_URL`
- `S3_PUBLIC_BASE_URL`

## Local Verification

Frontend:

```bash
cd frontend
pnpm install
pnpm build
```

Backend:

```bash
cd backend
python3 -m compileall app
```
