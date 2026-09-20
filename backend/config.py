"""Business constants for Croiss'Marche. All money in integer cents."""

# Earning engine
CC_PER_1000_FREE = 1
CC_PER_1000_PREMIUM = 2
DAILY_STEP_CAP = 20000          # steps counted per calendar day (anti-fraud)
CC_EXPIRY_MONTHS = 6            # CC expire 6 months after being earned, FIFO
ONBOARDING_DAYS = 7            # import last 7 days of history on signup

# Vouchers ("contremarques")
VOUCHER_COST_CC = 60
VOUCHER_TTL_MINUTES = 10       # single-use, valid 10 minutes
REDEMPTION_BILL_CENTS = 100    # 1,00 EUR billed to the partner per validated voucher

# Partner economics
PARTNER_SUBSCRIPTION_CENTS = 4900   # 49 EUR / month
MIN_PURCHASE_CENTS = 250            # 2,50 EUR minimum purchase enforced at the till
EXCLUSIVITY_RADIUS_M = 500          # 500 m exclusivity between active partners

# Premium (walker)
PREMIUM_PRICE_CENTS = 499           # 4,99 EUR / month
PAYMENTS_ENABLED = False            # feature flag, OFF by default

# Roles / plans / statuses
ROLE_WALKER = "walker"
ROLE_PARTNER = "partner"
ROLE_ADMIN = "admin"

PLAN_FREE = "FREE"
PLAN_PREMIUM = "PREMIUM"

PARTNER_ACTIVE = "ACTIVE"
PARTNER_PAUSED = "PAUSED"

VOUCHER_ACTIVE = "ACTIVE"
VOUCHER_REDEEMED = "REDEEMED"
VOUCHER_EXPIRED = "EXPIRED"

DEFAULT_REWARD = "Une viennoiserie offerte pour tout achat de 2,50 € minimum"

PARIS_TZ = "Europe/Paris"
