# School Final Polish Checklist

This checklist is for school submission/demo readiness (not enterprise production).

## 1) Stable Run Mode

- Use only one backend run mode at a time:
  - `npm run dev`, or
  - `pm2 start ...`
- Do not run both (avoid `EADDRINUSE` on port `5001`).

## 2) Pre-Demo Technical Check (5 minutes)

From `backend/`:

```bash
npm run school:qa
```

Expected:
- Syntax check passes
- Tests pass

## 3) Demo Data Ready

- Admin account can log in.
- Staff account can log in.
- Categories, products, sales exist (for reports/dashboard).
- Dashboard cards and charts load.

## 4) Demo Flow (Recommended)

1. Login (`/login.html`)
2. Dashboard (`/dashboard.html`)
3. Categories (`/categories.html`)
4. Products (`/products.html`) + barcode scan
5. Sales (`/sales.html`) + recent sale detail
6. Reports (`/reports.html`)
7. AI Forecast (`/ai.html`)
8. Users/Roles (`/users.html`)
9. Email Settings (`/email-settings.html`)

## 5) UI/Language Checks

- EN/KH switch works on all pages.
- Sidebar/topbar renders correctly.
- No critical red errors in browser console during demo flow.

## 6) Backup Before Presentation

- Export DB backup.
- Keep a copy of `.env`.
- Keep project zip/backup copy.

## 7) Known Scope (for report defense)

Current project is complete for school scope:
- Working modules end-to-end
- Role-based access
- Dashboard analytics
- Barcode workflows
- Email alert configuration
- Bilingual UI (EN/KH)

Not fully included (enterprise-level extras):
- Advanced security hardening/audits
- Full e2e regression automation
- Production infra/monitoring stack

## 8) Submission Attachments

- Source code
- SQL schema + seed SQL
- User manual
- API handover/spec
- Screenshots of each core module
- Short demo script (2-5 minutes)
