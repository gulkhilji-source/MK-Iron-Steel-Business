# MK — Iron & Steel Fabrication Business Manager

A full-stack JavaScript starter app for Mujahid Khilji (Iron & Steel Fabrication). It includes a React dashboard, Express API, SQLite database, login, shared customer/supplier records, ledgers, orders, transactions, expenses, manual cash/bank book, bill uploads, OCR scanning, editable OCR text, and an audit trail.

## Requirements
- Node.js 20 LTS (18.18+ may work)
- npm

## Start the app
1. Extract this ZIP.
2. Open a terminal in the extracted `mk-iron-steel` folder.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Copy `.env.example` to `.env`.
5. Change `JWT_SECRET` and `ADMIN_PASSWORD` in `.env`.
6. Start frontend and backend together:
   ```bash
   npm run dev
   ```
7. Open **http://localhost:5173**.

Default first-run login (change it in `.env` before the first launch):
- Email: `admin@mk.local`
- Password: `ChangeMe123!`

The first admin is seeded automatically the first time the database is created. The SQLite database is stored at `server/data/mk-business.sqlite`; uploaded bill files are stored in `server/uploads/`. Back up both folders.

## Included modules
- Dashboard with customer/supplier counts, order value, receivables/payables, cash/bank snapshot, expenses and recent transactions.
- Customer and supplier directories with edit forms and per-account transaction ledger view.
- Central transaction logbook; edits are audited and deletes are implemented as voids, not physical deletion.
- Fabrication orders with customer, project, price, advance, expected delivery and status.
- Expense records.
- Manual cash and bank entries, including opening balance entries.
- Bill/receipt upload (image/PDF), OCR text extraction in the browser using Tesseract.js, editable extracted text, editable total/date and account linking, plus original-file archive.
- Admin activity/audit log and creation of a second admin.
- English/Urdu language switch, RTL layout direction and Urdu navigation labels. **The full page-by-page Urdu translation is not complete yet.**

## OCR notes
OCR is performed in the browser. The current OCR language is English (`eng`). Urdu OCR can be added by loading the relevant Tesseract language data. PDF OCR depends on the browser/Tesseract handling of the selected PDF; for best results, upload a clear JPG or PNG photo. OCR is only a draft: review and correct every extracted field before saving. The original uploaded file is retained.

## Not included yet
- Full PDF customer/supplier statements and report exports.
- Stock/inventory management.
- Full Urdu translation of every form, table and message.
- Automated WhatsApp notifications.

## WhatsApp
The settings page documents the official Meta WhatsApp Cloud API setup, but outbound WhatsApp sending, template management, opt-in enforcement and delivery webhooks are **not activated in this starter build**. Do not add API tokens to frontend code. These should be implemented as secured server-side functions after you configure a Meta Business account and approved templates.

## Important accounting behaviour
- Customer and supplier ledgers are based on transaction rows.
- Record customer order value using transaction type **Order** and customer receipts using **Payment received**.
- Record supplier material purchases using **Material purchase** and supplier payments using **Payment sent**.
- Cash & Bank is a separate manual book. Entries are not automatically posted from customer/supplier transactions, avoiding accidental double counting. Enter the corresponding cash/bank movement once in the cash book if you want those balances to reflect it.
- This is a local single-server starter. Both admins share the same database when they use the same running server and database folder. It is not yet configured for internet hosting, multi-device deployment, automated cloud backups, or production hardening.

## Production checklist before using for live accounting
- Deploy behind HTTPS on a secured server.
- Set a strong unique `JWT_SECRET` and strong admin passwords.
- Restrict server/network access and configure automated encrypted backups for `server/data` and `server/uploads`.
- Add role/permission policy, password reset, rate limiting, CSRF/security headers, retention policy and monitoring.
- Add full statement/PDF generation and tested financial reconciliation workflows.
- Implement WhatsApp Cloud API sending, opt-in and delivery webhooks server-side.
- Validate tax/legal/accounting requirements with your accountant.

## Useful commands
```bash
npm run dev       # frontend + API
npm run build     # production frontend build
npm start         # API + built frontend (run npm run build first)
```
