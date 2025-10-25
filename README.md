# catalog-creative

A full-stack marketing site and service catalog for Devara Creative. The project ships a Go backend paired with a Next.js frontend.

## Features
- Service catalog with promo codes, order management, and admin dashboards.
- Xendit-powered payments with hosted invoices supporting virtual accounts, e-wallets, QRIS, retail outlets, paylater, and credit/debit cards.
- Refund disbursement handling via Xendit, plus automatic webhook and polling-based payment sync.
- Authentication for customers and admins, including Google OAuth.

## Project Structure
```
backend/   # Go HTTP API, storage layer, and integrations
frontend/  # Next.js marketing site, checkout flow, and admin UI
```

## Getting Started
1. Install dependencies:
   ```bash
   cd backend && go mod download
   cd ../frontend && npm install
   ```
2. Configure environment variables (see below).
3. Start the backend API:
   ```bash
   cd backend
   go run app/main.go
   ```
4. In a separate terminal, run the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

## Environment Variables
### Backend
Set these in your shell or a `.env` file before running the API.

| Variable | Description |
| --- | --- |
| `XENDIT_API_KEY` | Required. Xendit secret key (`xnd_...`). Needed for invoice creation and disbursements. |
| `XENDIT_BASE_URL` | Optional. Override the Xendit API host (defaults to `https://api.xendit.co`). |
| `XENDIT_REDIRECT_URL` | Optional. Base URL for hosted payment redirects (defaults to `https://devaracreative.com`). |
| `XENDIT_CALLBACK_TOKEN` | Optional. Shared secret used to validate Xendit webhooks. |
| `CORS_ORIGINS` | Comma-separated list of allowed origins for the API. |
| `ADMIN_EMAIL` | Email address that receives refund request notifications. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URL` | Optional. Enable Google OAuth for authentication. |

### Frontend
Create `frontend/.env.local` and configure:

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Base URL of the backend API (e.g., `http://localhost:8000`). |
| `NEXT_PUBLIC_XENDIT_PUBLIC_KEY` | Required for kartu kredit/debit. Xendit publishable key used to membuat token kartu. |
| `NEXT_PUBLIC_XENDIT_API_URL` | Optional. Override host Xendit (default `https://api.xendit.co`). |

## Testing
Run Go unit tests from the backend directory:
```bash
cd backend
go test ./...
```

Run frontend type checks and linting:
```bash
cd frontend
npm run lint
npm run type-check
```

## Payments Overview
- Every order automatically creates a Xendit invoice and stores the hosted `invoice_url`.
- Checkout links customers to the Xendit payment page so they can choose any enabled channel.
- `/api/xendit/webhook` receives invoice and disbursement notifications; orders are marked `PAID` when invoices settle.
- Admins can trigger refunds, which issue Xendit disbursements and track refund status within the order history.
