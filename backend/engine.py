"""Core Croiss'Marche engine.

Every function that touches CC or vouchers is server-side and takes an explicit
`db` handle so it can be unit-tested against a disposable database. No business
logic here depends on WHICH step source produced the numbers (see StepSource).
"""

from __future__ import annotations

import math
import random
from datetime import datetime, timezone, time as dtime
from zoneinfo import ZoneInfo

from dateutil.relativedelta import relativedelta

import config as C


# ---------------------------------------------------------------------------
# Step sources — single interface, two implementations. No business logic
# depends on which one is active; they only produce a daily step count.
# ---------------------------------------------------------------------------
class StepSource:
    def steps_for(self, date_str: str) -> int:
        raise NotImplementedError


class SimulatedStepSource(StepSource):
    """Generates plausible daily step counts for the prototype."""

    def __init__(self, seed: int | None = None):
        self._rng = random.Random(seed)

    def steps_for(self, date_str: str) -> int:
        # Weekends a little lower, weekdays a little higher; plausible spread.
        d = datetime.strptime(date_str, "%Y-%m-%d")
        base = 5200 if d.weekday() >= 5 else 7300
        return max(0, int(self._rng.gauss(base, 2600)))


class NativeStepSource(StepSource):
    """Stub for HealthKit / Health Connect. Same interface, wired later."""

    def steps_for(self, date_str: str) -> int:  # pragma: no cover
        raise NotImplementedError("NativeStepSource is a stub for native builds")


# ---------------------------------------------------------------------------
# Time helpers (fr-FR / Europe/Paris)
# ---------------------------------------------------------------------------
def paris_now() -> datetime:
    return datetime.now(ZoneInfo(C.PARIS_TZ))


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def today_str() -> str:
    return paris_now().strftime("%Y-%m-%d")


def _day_earned_at(date_str: str) -> datetime:
    """A day's CC are considered earned at Paris noon of that day (UTC-stored)."""
    d = datetime.strptime(date_str, "%Y-%m-%d")
    local = datetime.combine(d.date(), dtime(12, 0), tzinfo=ZoneInfo(C.PARIS_TZ))
    return local.astimezone(timezone.utc)


# ---------------------------------------------------------------------------
# Pure earning maths
# ---------------------------------------------------------------------------
def compute_cc(steps: int, plan: str) -> int:
    """CC for a single calendar day: 1 (FREE) or 2 (PREMIUM) CC per 1 000 steps,
    floored, with the daily anti-fraud cap applied first."""
    counted = min(max(int(steps), 0), C.DAILY_STEP_CAP)
    rate = C.CC_PER_1000_PREMIUM if plan == C.PLAN_PREMIUM else C.CC_PER_1000_FREE
    # Floor AFTER multiplying: PREMIUM 6 500 steps -> floor(6.5*2) = 13 CC.
    return (counted * rate) // 1000


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


# ---------------------------------------------------------------------------
# CC ledger (lots) — one EARN lot per (user, day); FIFO spend & expiry
# ---------------------------------------------------------------------------
async def spendable_balance(db, user_id: str, now: datetime | None = None) -> int:
    now = now or utc_now()
    total = 0
    async for lot in db.cc_lots.find({"userId": user_id, "expiresAt": {"$gt": now}}):
        total += max(0, int(lot.get("remaining", 0)))
    return total


async def refresh_balance(db, user_id: str, now: datetime | None = None) -> int:
    """Recompute the spendable balance (dropping expired CC) and mirror it on
    the user document for fast display. Authority stays in the ledger."""
    bal = await spendable_balance(db, user_id, now)
    await db.users.update_one({"_id": _oid(user_id)}, {"$set": {"ccBalance": bal}})
    return bal


async def recompute_day(db, user: dict, date_str: str, steps: int, source: str = "SIMULATED") -> int:
    """Idempotently set a day's steps and reconcile that day's CC lot.

    Recomputing the same day with the same steps NEVER double-credits: we store
    the day's previously credited CC and only apply the delta.
    """
    plan = user.get("plan", C.PLAN_FREE)
    user_id = str(user["_id"])
    new_cc = compute_cc(steps, plan)

    existing = await db.step_entries.find_one({"userId": user_id, "date": date_str})
    old_cc = int(existing["ccEarned"]) if existing else 0

    await db.step_entries.update_one(
        {"userId": user_id, "date": date_str},
        {"$set": {"userId": user_id, "date": date_str, "steps": int(steps),
                  "ccEarned": new_cc, "source": source}},
        upsert=True,
    )

    delta = new_cc - old_cc
    if delta != 0:
        lot = await db.cc_lots.find_one({"userId": user_id, "date": date_str})
        if lot:
            await db.cc_lots.update_one(
                {"_id": lot["_id"]},
                {"$set": {"amount": max(0, int(lot["amount"]) + delta),
                          "remaining": max(0, int(lot["remaining"]) + delta)}},
            )
        else:
            earned_at = _day_earned_at(date_str)
            await db.cc_lots.insert_one({
                "userId": user_id, "date": date_str,
                "amount": new_cc, "remaining": new_cc,
                "earnedAt": earned_at,
                "expiresAt": earned_at + relativedelta(months=C.CC_EXPIRY_MONTHS),
                "source": source,
            })

    await refresh_balance(db, user_id)
    return new_cc


async def add_aged_cc(db, user_id: str, amount: int, months_ago: int) -> None:
    """DEV ONLY: inject a CC lot earned `months_ago` months ago to test expiry."""
    earned_at = utc_now() - relativedelta(months=months_ago)
    await db.cc_lots.insert_one({
        "userId": user_id, "date": earned_at.strftime("%Y-%m-%d"),
        "amount": amount, "remaining": amount,
        "earnedAt": earned_at,
        "expiresAt": earned_at + relativedelta(months=C.CC_EXPIRY_MONTHS),
        "source": "DEV_AGED",
    })
    await refresh_balance(db, user_id)


# ---------------------------------------------------------------------------
# Off-peak window
# ---------------------------------------------------------------------------
def _parse_hhmm(s: str) -> dtime:
    h, m = s.split(":")
    return dtime(int(h), int(m))


def window_text(partner: dict) -> str:
    start = partner.get("offPeakStart", "14:00").replace(":", "h")
    end = partner.get("offPeakEnd", "17:00").replace(":", "h")
    return f"de {start} à {end}"


def is_within_offpeak(partner: dict, now: datetime | None = None) -> bool:
    now = (now or utc_now()).astimezone(ZoneInfo(C.PARIS_TZ))
    days = partner.get("offPeakDays", [0, 1, 2, 3, 4])
    if now.weekday() not in days:
        return False
    start = _parse_hhmm(partner.get("offPeakStart", "14:00"))
    end = _parse_hhmm(partner.get("offPeakEnd", "17:00"))
    return start <= now.time() <= end


# ---------------------------------------------------------------------------
# Vouchers
# ---------------------------------------------------------------------------
class EngineError(Exception):
    """Raised for expected, user-facing business-rule violations (French msg)."""


def _oid(id_str):
    from bson import ObjectId
    return ObjectId(id_str)


async def create_voucher(db, user: dict, partner: dict, now: datetime | None = None) -> dict:
    """Atomically debit 60 CC (FIFO) and create one ACTIVE voucher.

    A partial unique index on (userId | status=ACTIVE) guarantees a double-tap
    can never create two vouchers. Balance is debited at creation, not at
    redemption.
    """
    from pymongo.errors import DuplicateKeyError

    now = now or utc_now()
    user_id = str(user["_id"])

    if partner.get("plan") == C.PARTNER_PAUSED:
        raise EngineError("Cette boulangerie n'accepte pas de contremarques pour le moment.")

    # Never let someone burn CC on a voucher they cannot redeem: block outside window.
    if not is_within_offpeak(partner, now):
        raise EngineError(
            f"{partner['businessName']} accepte les contremarques {window_text(partner)}. "
            "Reviens pendant ce créneau pour ne pas gaspiller tes CC."
        )

    # Retire any stale (expired) active voucher first.
    await db.vouchers.update_many(
        {"userId": user_id, "status": C.VOUCHER_ACTIVE, "expiresAt": {"$lte": now}},
        {"$set": {"status": C.VOUCHER_EXPIRED}},
    )

    existing = await db.vouchers.find_one(
        {"userId": user_id, "status": C.VOUCHER_ACTIVE, "expiresAt": {"$gt": now}}
    )
    if existing:
        raise EngineError("Tu as déjà une contremarque active. Utilise-la ou attends son expiration.")

    balance = await spendable_balance(db, user_id, now)
    if balance < C.VOUCHER_COST_CC:
        raise EngineError(
            f"Solde insuffisant : il te faut {C.VOUCHER_COST_CC} CC "
            f"et tu en as {balance}. Continue à marcher !"
        )

    code = f"{random.randint(0, 9999):04d}"
    voucher_doc = {
        "userId": user_id,
        "partnerId": str(partner["_id"]),
        "code": code,
        "status": C.VOUCHER_ACTIVE,
        "ccSpent": C.VOUCHER_COST_CC,
        "createdAt": now,
        "expiresAt": now + relativedelta(minutes=+C.VOUCHER_TTL_MINUTES),
        "redeemedAt": None,
    }
    try:
        res = await db.vouchers.insert_one(voucher_doc)
    except DuplicateKeyError:
        raise EngineError("Une contremarque est déjà en cours de création.")

    # FIFO debit across non-expired lots (oldest first).
    to_debit = C.VOUCHER_COST_CC
    async for lot in db.cc_lots.find(
        {"userId": user_id, "remaining": {"$gt": 0}, "expiresAt": {"$gt": now}}
    ).sort("earnedAt", 1):
        if to_debit <= 0:
            break
        take = min(to_debit, int(lot["remaining"]))
        await db.cc_lots.update_one({"_id": lot["_id"]}, {"$inc": {"remaining": -take}})
        to_debit -= take

    await refresh_balance(db, user_id, now)
    voucher_doc["_id"] = res.inserted_id
    return voucher_doc


async def redeem_code(db, partner: dict, code: str, now: datetime | None = None) -> dict:
    """Server-side validation of a code typed by the baker.

    Rejects: wrong code, wrong partner, already redeemed, expired, outside the
    partner's off-peak window. On success flips the voucher atomically and bills
    the partner 1,00 EUR.
    """
    now = now or utc_now()
    partner_id = str(partner["_id"])
    code = (code or "").strip()

    owned = await db.vouchers.find_one({"code": code, "partnerId": partner_id}, sort=[("createdAt", -1)])
    if not owned:
        elsewhere = await db.vouchers.find_one({"code": code, "status": C.VOUCHER_ACTIVE})
        if elsewhere:
            raise EngineError("Ce code n'appartient pas à votre boulangerie.")
        raise EngineError("Code invalide. Vérifiez les 4 chiffres.")

    if owned["status"] == C.VOUCHER_REDEEMED:
        raise EngineError("Code déjà utilisé.")

    if owned["status"] == C.VOUCHER_EXPIRED or owned["expiresAt"] <= now:
        await db.vouchers.update_one({"_id": owned["_id"]}, {"$set": {"status": C.VOUCHER_EXPIRED}})
        raise EngineError("Code expiré (valable 10 minutes après création).")

    if not is_within_offpeak(partner, now):
        raise EngineError(
            f"Hors créneau : les contremarques sont acceptées {window_text(partner)}."
        )

    # Atomic flip — protects against double redemption / double-tap.
    updated = await db.vouchers.find_one_and_update(
        {"_id": owned["_id"], "status": C.VOUCHER_ACTIVE},
        {"$set": {"status": C.VOUCHER_REDEEMED, "redeemedAt": now}},
    )
    if not updated:
        raise EngineError("Code déjà utilisé.")

    is_new = (await db.redemptions.count_documents(
        {"partnerId": partner_id, "userId": owned["userId"]}
    )) == 0

    await db.redemptions.insert_one({
        "voucherId": str(owned["_id"]),
        "partnerId": partner_id,
        "userId": owned["userId"],
        "redeemedAt": now,
        "billedCents": C.REDEMPTION_BILL_CENTS,
        "isNewCustomer": is_new,
    })

    return {
        "rewardName": partner.get("reward", C.DEFAULT_REWARD),
        "minPurchaseCents": partner.get("minPurchaseCents", C.MIN_PURCHASE_CENTS),
        "isNewCustomer": is_new,
    }
