# Backend (optional): report email endpoint

The application in `index.html` can email each generated PDF report to a
recipient. It does this by sending a `POST` request to a **same-origin** endpoint:

```
POST /api/send-report
```

This endpoint is **optional**. The full questionnaire flow — cultural profiling,
adaptive item generation, fatigue-based stopping, scoring, and **PDF download** — works
without it. Email delivery is the only feature that requires a backend, because a
browser cannot send email on its own (and cannot at all when the file is opened via
`file://`).

## What the endpoint receives

The client sends `multipart/form-data` with fields including:

- `report` — the generated PDF file (the report blob)
- `country`, `age` — basic profile fields
- `feedback` — the end-of-session feedback answers (JSON string)
- (plus any additional fields configured in the client)

The recipient address is configured in the client as `REPORT_RECIPIENT_EMAIL`.

## What to include when open-sourcing

If the study relied on emailed reports, add the actual server implementation that
handled `/api/send-report` to this folder (for example, a small Node.js/Express service
that receives the upload and forwards it via an email service), together with:

- setup and run instructions,
- the environment variables it expects (SMTP / email-service credentials — **never
  commit real credentials**; provide a `.env.example` instead),
- any rate-limiting or validation applied.

If reports were **not** emailed during the study (download only), state that here and
note that the endpoint is a convenience feature disabled in the released configuration.
