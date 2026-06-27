# Launch-Gate Setup Guide

This guide walks you through the three critical external configuration steps required before production launch. Complete all three **before** enabling public access.

---

## Step 1: Resend Domain Verification

Email notifications are sent via [Resend](https://resend.com). Until you verify your sending domain, Resend operates in sandbox mode and only delivers to the account owner's email address.

### In Resend Dashboard

1. Navigate to **Domains** → **Add Domain**
2. Enter your sending domain (e.g., `tickertracker.info`)
3. Resend will display three DNS records:
   - **DKIM** (format: `v=DKIM1; p=...`)
   - **SPF** (format: `v=spf1 include:...`)
   - **DMARC** (format: `v=DMARC1; p=...`)
4. Copy each record exactly as shown

### At Your Domain Registrar

1. Log in to your DNS registrar (GoDaddy, Namecheap, Route 53, etc.)
2. Navigate to DNS Records / Manage DNS
3. Add three new TXT records:
   - One for **DKIM** with the full value Resend provided
   - One for **SPF** with the full value Resend provided
   - One for **DMARC** with the full value Resend provided
4. Save and allow 15–30 minutes for DNS propagation

### Verify and Configure

1. Return to Resend → Domains and click **Verify**
2. Wait for Resend to confirm all three records are detected (status changes to "Verified")
3. Once verified, go to your **Railway dashboard** → Web service environment
4. Set the environment variable:
   - **Name:** `MAIL_FROM`
   - **Value:** `alerts@tickertracker.info` (or your chosen subdomain)

After this step, Resend will deliver to all addresses on the platform.

---

## Step 2: Google OAuth Configuration

Users sign in via Google. You must register the app in Google Cloud Console and configure the exact callback URL.

### In Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select your existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Select **Web application**
6. Add the authorized redirect URI:
   - **Exact value:** `https://tickertracker.info/api/auth/google/callback`
   - (Backend route: `@auth_bp.get("/google/callback")` under url_prefix `/api/auth`)
7. Click **Create** and note the displayed **Client ID** and **Client Secret**
8. Do **not** share these secrets; copy them securely

### In Railway Dashboard

1. Go to your web service's environment variables
2. Add or update:
   - **Name:** `GOOGLE_CLIENT_ID` → **Value:** (paste from Google Console)
   - **Name:** `GOOGLE_CLIENT_SECRET` → **Value:** (paste from Google Console)
3. Verify that `APP_BASE_URL` is set to `https://tickertracker.info`
   - The backend uses `APP_BASE_URL` to build the login and callback URLs
4. Deploy (or restart the service)

---

## Step 3: Rotate Pasted Secrets

During development, the following secrets were shared in chat and should be rotated immediately:

- **Finnhub API Key** (for stock data)
- **Resend API Key** (for email)
- **Railway API Token** (for deployment/CLI)

### Rotate Each Secret

For each secret listed above:

1. **Finnhub:**
   - Log in to [Finnhub Dashboard](https://finnhub.io/dashboard)
   - Regenerate your API key
   - Copy the new key

2. **Resend:**
   - Log in to [Resend](https://resend.com)
   - Go to **API Keys** → find your pasted key → **Delete**
   - Click **Create New Key** and copy the new key

3. **Railway:**
   - Log in to [Railway Dashboard](https://railway.app)
   - Go to **Account** → **Tokens** → find your development token
   - Click **Regenerate** and copy the new token

### Store in Railway Environment

Once you have the new keys:

1. Go to your web service's environment variables in Railway
2. Add or update:
   - **Name:** `FINNHUB_API_KEY` → **Value:** (new Finnhub key)
   - **Name:** `RESEND_API_KEY` → **Value:** (new Resend key)
3. For the Railway token, update your local `.env` or CLI configuration:
   - Run: `railway login` and authenticate with the new token
   - Or update your local environment: `export RAILWAY_TOKEN=<new-token>`
4. Deploy to apply the changes

---

## Verification Checklist

Once all three steps are complete:

- [ ] Resend domain shows "Verified" in Resend dashboard
- [ ] `MAIL_FROM` is set in Railway environment
- [ ] Google OAuth client ID and secret are set in Railway environment
- [ ] `APP_BASE_URL` is set to your production domain
- [ ] Old secrets (Finnhub, Resend, Railway token) have been rotated and new values are in Railway
- [ ] Web service has been deployed after all environment changes
- [ ] Test: Send a test email via the alerts feature (confirm it arrives)
- [ ] Test: Click "Sign in with Google" and confirm redirect succeeds

---

## Troubleshooting

**Email not sending:**
- Confirm Resend domain is marked "Verified" (not just submitted)
- Confirm `MAIL_FROM` matches your verified domain
- Check Resend dashboard → **Emails** for delivery logs

**Google login fails / redirect_uri mismatch error:**
- Verify the exact callback URI in Google Console matches: `https://tickertracker.info/api/auth/google/callback`
- Confirm `APP_BASE_URL` is set (backend uses it to construct URLs)
- Confirm `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
- Check Railway logs for auth errors

**Secrets still in chat history:**
- These are now invalidated by rotation; no further action needed
- Future development: use a secrets manager (e.g., Railway's native secrets, 1Password, Vault) instead of pasting


---

## STATUS (2026-06-27): Resend domain VERIFIED ✅

`tickertracker.info` is verified in Resend (DKIM/SPF/DMARC all green). `MAIL_FROM`
is now `Ticker Tracker <alerts@tickertracker.info>` on the web service + both cron
services. Emails (signup verification, password reset, price alerts, weekly
digest) now deliver to ANY recipient — no longer sandbox-limited. Verified by a
real test send. Google OAuth: live + published. **All launch gates closed.**
