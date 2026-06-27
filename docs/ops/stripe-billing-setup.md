# Stripe Billing Setup

Ticker Tracker Pro is a freemium subscription: $7/month or $59/year (annual is
the primary CTA). Statuses `active` and `trialing` count as Pro.

## 1. Create the product & prices
1. Stripe Dashboard → **Products** → **Add product**: name `Ticker Tracker Pro`.
2. Add a recurring price: **$7.00 / month** → copy its price id → `STRIPE_PRO_MONTHLY_PRICE_ID`.
3. Add a second recurring price: **$59.00 / year** → copy its price id → `STRIPE_PRO_ANNUAL_PRICE_ID`.

## 2. Configure the Customer Portal
Dashboard → **Settings → Billing → Customer portal**. Enable:
- Cancel subscription.
- Update payment method.

Save. (`POST /api/billing/portal` returns a portal session.)

## 3. Add the webhook endpoint
Dashboard → **Developers → Webhooks → Add endpoint**:
- URL: `https://tickertracker.info/api/stripe/webhook`
- Events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Copy the signing secret → `STRIPE_WEBHOOK_SECRET`.

## 4. Environment variables
Set on the Railway web service (and any service that needs them):
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_MONTHLY_PRICE_ID`,
`STRIPE_PRO_ANNUAL_PRICE_ID`, `BILLING_ENABLED`.

## 5. Local testing
```bash
stripe listen --forward-to localhost:5000/api/stripe/webhook
```
Use the `whsec_...` it prints as `STRIPE_WEBHOOK_SECRET` locally. Trigger test
events with `stripe trigger checkout.session.completed`.

## Launch gate
**Do not set `BILLING_ENABLED=true` in production** until market-data provider
commercial-use rights are confirmed or upgraded. Until then limits are not
enforced and the app behaves exactly as it does today.

## How enforcement works
- `is_pro(user_id)` is a pure subscription-status check (independent of `BILLING_ENABLED`).
- Limit enforcement (`402 limit_exceeded` on watchlist/alerts/screens/digest) is
  gated by `BILLING_ENABLED`, so pre-launch nothing is blocked.
- The weekly digest cron and the price-hit alert cron gate on `is_pro` directly —
  these are Pro-only features regardless of `BILLING_ENABLED` (pre-launch, with no
  Pro subscribers, no digest/alert emails are sent).
- Compare is a UI-only cap (Free 2 / Pro 10) enforced client-side.

## References
- https://docs.stripe.com/webhooks
- https://docs.stripe.com/billing/subscriptions/webhooks
- https://docs.stripe.com/customer-management
- https://docs.stripe.com/cli
- https://docs.stripe.com/get-started/development-environment?lang=python
