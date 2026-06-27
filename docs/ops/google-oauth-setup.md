# Enabling "Sign up with Google"

The Google OAuth flow is **already built** in the app (`backend/auth/routes.py`
→ `/api/auth/google` and `/api/auth/google/callback`, via Authlib). It is dormant
only because three environment values aren't set. Do the steps below once.

## 1. Create the OAuth client in Google Cloud Console

1. Go to <https://console.cloud.google.com/> and select (or create) a project,
   e.g. **Ticker Tracker**.
2. **APIs & Services → OAuth consent screen**:
   - User type: **External** → Create.
   - App name: `Ticker Tracker`; user support email: your email.
   - App domain (optional but good): `https://tickertracker.info`.
   - Authorized domain: `tickertracker.info`.
   - Scopes: the defaults (`.../auth/userinfo.email`, `.../auth/userinfo.profile`,
     `openid`) are all that's needed — add them and Save.
   - While in "Testing" you must add your own email under **Test users** to log in;
     click **Publish app** when you're ready for the public (it's an instant
     publish for these basic scopes — no Google verification review needed unless
     you request sensitive scopes, which we don't).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Name: `Ticker Tracker Web`.
   - **Authorized JavaScript origins:** `https://tickertracker.info`
   - **Authorized redirect URIs:** add EXACTLY (no trailing slash):
     ```
     https://tickertracker.info/api/auth/google/callback
     ```
     (This is the live callback route — `@auth_bp.get("/google/callback")` under
     the `/api/auth` blueprint prefix. It must match character-for-character or
     Google returns `redirect_uri_mismatch`.)
   - Create. Copy the **Client ID** and **Client secret**.

## 2. Put the credentials into Railway

Set these on the **web service** environment (Railway → service → Variables):

| Variable | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | (the Client ID from step 1) |
| `GOOGLE_CLIENT_SECRET` | (the Client secret from step 1) |
| `APP_BASE_URL` | `https://tickertracker.info` (confirm it's set — the backend builds the redirect from this) |

Railway redeploys on a variable change. After it restarts, the "Continue with
Google" button on the login/signup modal will work.

> **Hand the Client ID + Secret to the assistant** and it can set these via the
> Railway CLI for you (then rotate the values if they were shared in chat).

## 3. Verify

1. Open <https://tickertracker.info>, click **Sign in → Continue with Google**.
2. You should be redirected to Google's consent screen, then back into the app,
   logged in.
3. If you see `redirect_uri_mismatch`: the redirect URI in the Console doesn't
   exactly equal `https://tickertracker.info/api/auth/google/callback`.
4. If you see a 503 / "Google sign-in not configured": the env vars aren't set
   (or the service hasn't restarted yet).

## How it works (for reference)
- `/api/auth/google` calls `authorize_redirect(APP_BASE_URL + "/api/auth/google/callback")`.
- Google redirects back to the callback with a code; the app exchanges it,
  reads the verified email + name, and **upserts** a user (`oauth_identities`
  table links the Google subject to a user row). Email from Google is treated as
  verified. A session cookie is set (Flask-Login).
- An account created via Google has no password; it can still use email login
  only after setting one via password-reset (optional, not required).
