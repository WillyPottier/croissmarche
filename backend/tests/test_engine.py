"""Automated tests for the 11 mandatory Croiss'Marche cases.

Run: cd /app/backend && python -m pytest tests/test_engine.py -v
Uses a disposable database and the real engine functions (no HTTP).
"""

import asyncio
import os
import uuid
from datetime import timedelta
from zoneinfo import ZoneInfo
from datetime import datetime

import pytest
from bson import ObjectId
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import config as C
import engine as E

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
MONGO_URL = os.environ["MONGO_URL"]


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


async def fresh_db():
    client = AsyncIOMotorClient(MONGO_URL, tz_aware=True)
    db = client[f"cm_test_{uuid.uuid4().hex[:8]}"]
    try:
        await db.vouchers.create_index(
            "userId", unique=True, name="one_active_voucher",
            partialFilterExpression={"status": C.VOUCHER_ACTIVE},
        )
    except Exception:
        pass
    return client, db


async def make_user(db, plan=C.PLAN_FREE):
    res = await db.users.insert_one({
        "email": f"{uuid.uuid4().hex}@t.fr", "firstName": "Test",
        "role": C.ROLE_WALKER, "plan": plan, "ccBalance": 0, "active": True,
    })
    return await db.users.find_one({"_id": res.inserted_id})


async def make_partner(db, allday=True):
    res = await db.partners.insert_one({
        "businessName": f"Boulangerie {uuid.uuid4().hex[:4]}",
        "address": "Perpignan", "lat": 42.7, "lng": 2.89, "phone": "",
        "contactName": "", "plan": C.PARTNER_ACTIVE,
        "offPeakStart": "00:00" if allday else "14:00",
        "offPeakEnd": "23:59" if allday else "17:00",
        "offPeakDays": [0, 1, 2, 3, 4, 5, 6] if allday else [0, 1, 2, 3, 4],
        "minPurchaseCents": C.MIN_PURCHASE_CENTS,
        "reward": C.DEFAULT_REWARD,
    })
    return await db.partners.find_one({"_id": res.inserted_id})


async def insert_voucher(db, uid, pid, code, created, status=C.VOUCHER_ACTIVE, ttl_min=10):
    res = await db.vouchers.insert_one({
        "userId": uid, "partnerId": pid, "code": code, "status": status,
        "ccSpent": C.VOUCHER_COST_CC, "createdAt": created,
        "expiresAt": created + timedelta(minutes=ttl_min), "redeemedAt": None,
    })
    return str(res.inserted_id)


# --- Pure earning maths -----------------------------------------------------
def test_1_free_6500_is_6_and_idempotent():
    async def go():
        client, db = await fresh_db()
        try:
            u = await make_user(db, C.PLAN_FREE)
            cc = await E.recompute_day(db, u, "2026-06-01", 6500)
            assert cc == 6
            # Recompute the same day → still 6 total, not 12.
            await E.recompute_day(db, u, "2026-06-01", 6500)
            assert await E.spendable_balance(db, str(u["_id"])) == 6
        finally:
            await client.drop_database(db.name); client.close()
    run(go())


def test_2_premium_6500_is_13():
    async def go():
        client, db = await fresh_db()
        try:
            u = await make_user(db, C.PLAN_PREMIUM)
            assert await E.recompute_day(db, u, "2026-06-01", 6500) == 13
        finally:
            await client.drop_database(db.name); client.close()
    run(go())


def test_3_daily_cap_25000_free_is_20():
    async def go():
        client, db = await fresh_db()
        try:
            u = await make_user(db, C.PLAN_FREE)
            assert await E.recompute_day(db, u, "2026-06-01", 25000) == 20
        finally:
            await client.drop_database(db.name); client.close()
    run(go())


# --- Voucher creation -------------------------------------------------------
def test_4_create_voucher_debits_60():
    async def go():
        client, db = await fresh_db()
        try:
            u = await make_user(db)
            p = await make_partner(db)
            await E.add_aged_cc(db, str(u["_id"]), 62, 0)
            v = await E.create_voucher(db, u, p)
            assert v["status"] == C.VOUCHER_ACTIVE and len(v["code"]) == 4
            assert await E.spendable_balance(db, str(u["_id"])) == 2
        finally:
            await client.drop_database(db.name); client.close()
    run(go())


def test_5_insufficient_balance_refused():
    async def go():
        client, db = await fresh_db()
        try:
            u = await make_user(db)
            p = await make_partner(db)
            await E.add_aged_cc(db, str(u["_id"]), 59, 0)
            with pytest.raises(E.EngineError):
                await E.create_voucher(db, u, p)
        finally:
            await client.drop_database(db.name); client.close()
    run(go())


# --- Redemption -------------------------------------------------------------
def test_6_redeem_twice_second_refused():
    async def go():
        client, db = await fresh_db()
        try:
            u = await make_user(db)
            p = await make_partner(db)
            now = E.utc_now()
            await insert_voucher(db, str(u["_id"]), str(p["_id"]), "1234", now)
            await E.redeem_code(db, p, "1234", now)
            with pytest.raises(E.EngineError):
                await E.redeem_code(db, p, "1234", now)
        finally:
            await client.drop_database(db.name); client.close()
    run(go())


def test_7_expired_after_11_minutes():
    async def go():
        client, db = await fresh_db()
        try:
            u = await make_user(db)
            p = await make_partner(db)
            created = E.utc_now()
            await insert_voucher(db, str(u["_id"]), str(p["_id"]), "5555", created)
            with pytest.raises(E.EngineError):
                await E.redeem_code(db, p, "5555", created + timedelta(minutes=11))
        finally:
            await client.drop_database(db.name); client.close()
    run(go())


def test_8_outside_offpeak_window_refused():
    async def go():
        client, db = await fresh_db()
        try:
            u = await make_user(db)
            p = await make_partner(db, allday=False)  # 14:00-17:00 weekdays
            # Monday 15/06/2026 at 10:00 Paris → outside window.
            now = datetime(2026, 6, 15, 10, 0, tzinfo=ZoneInfo(C.PARIS_TZ))
            await insert_voucher(db, str(u["_id"]), str(p["_id"]), "6789", now)
            with pytest.raises(E.EngineError):
                await E.redeem_code(db, p, "6789", now)
        finally:
            await client.drop_database(db.name); client.close()
    run(go())


def test_9_wrong_partner_refused():
    async def go():
        client, db = await fresh_db()
        try:
            u = await make_user(db)
            a = await make_partner(db)
            b = await make_partner(db)
            now = E.utc_now()
            await insert_voucher(db, str(u["_id"]), str(a["_id"]), "4242", now)
            with pytest.raises(E.EngineError):
                await E.redeem_code(db, b, "4242", now)
        finally:
            await client.drop_database(db.name); client.close()
    run(go())


def test_10_second_redemption_is_returning_customer():
    async def go():
        client, db = await fresh_db()
        try:
            u = await make_user(db)
            p = await make_partner(db)
            now = E.utc_now()
            await insert_voucher(db, str(u["_id"]), str(p["_id"]), "1111", now)
            r1 = await E.redeem_code(db, p, "1111", now)
            assert r1["isNewCustomer"] is True
            await insert_voucher(db, str(u["_id"]), str(p["_id"]), "2222", now)
            r2 = await E.redeem_code(db, p, "2222", now)
            assert r2["isNewCustomer"] is False
        finally:
            await client.drop_database(db.name); client.close()
    run(go())


def test_11_cc_earned_7_months_ago_not_spendable():
    async def go():
        client, db = await fresh_db()
        try:
            u = await make_user(db)
            await E.add_aged_cc(db, str(u["_id"]), 100, 7)  # earned 7 months ago
            assert await E.spendable_balance(db, str(u["_id"])) == 0
        finally:
            await client.drop_database(db.name); client.close()
    run(go())
