"""Croiss'Marche API. All CC/voucher logic is server-side (see engine.py)."""

import logging
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

import bcrypt
import jwt
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, APIRouter, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

import config as C
import engine as E
from seed import seed, onboard_new_walker

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url, tz_aware=True)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
JWT_MINUTES = int(os.getenv("JWT_MINUTES", "10080"))

app = FastAPI(title="Croiss'Marche API")
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("croissmarche")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": str(user["_id"]), "role": user["role"], "type": "access",
         "iat": now, "exp": now + timedelta(minutes=JWT_MINUTES)},
        JWT_SECRET, algorithm=JWT_ALG,
    )


def ser(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return doc
    out = {}
    for k, v in doc.items():
        if k == "_id":
            out["id"] = str(v)
        elif k == "passwordHash":
            continue
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, ObjectId):
            out[k] = str(v)
        else:
            out[k] = v
    return out


async def current_user(cred: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> dict:
    unauth = HTTPException(status_code=401, detail="Session expirée, reconnecte-toi.")
    if not cred:
        raise unauth
    try:
        claims = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALG])
        if claims.get("type") != "access" or not ObjectId.is_valid(claims.get("sub", "")):
            raise unauth
    except jwt.InvalidTokenError:
        raise unauth
    user = await db.users.find_one({"_id": ObjectId(claims["sub"]), "active": True})
    if not user:
        raise unauth
    return user


def require(*roles):
    async def check(user: dict = Depends(current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Accès non autorisé pour ce rôle.")
        return user
    return check


async def public_user(user: dict) -> dict:
    bal = await E.refresh_balance(db, str(user["_id"]))
    u = ser(user)
    u["ccBalance"] = bal
    return u


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class SignupBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    firstName: str = Field(min_length=1, max_length=60)
    consentRGPD: bool


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class VoucherBody(BaseModel):
    partnerId: str


class ValidateBody(BaseModel):
    code: str


class PartnerSettingsBody(BaseModel):
    offPeakStart: Optional[str] = None
    offPeakEnd: Optional[str] = None
    offPeakDays: Optional[list[int]] = None
    reward: Optional[str] = None
    plan: Optional[str] = None


class PartnerBody(BaseModel):
    businessName: str
    address: str
    lat: float
    lng: float
    phone: str = ""
    contactName: str = ""
    offPeakStart: str = "14:00"
    offPeakEnd: str = "17:00"
    offPeakDays: list[int] = [0, 1, 2, 3, 4]
    reward: str = C.DEFAULT_REWARD
    force: bool = False


class DevStepsBody(BaseModel):
    userId: str
    steps: int


class DevBackfillBody(BaseModel):
    userId: str
    days: int = 7


class DevPlanBody(BaseModel):
    userId: str
    plan: str


class DevAgeBody(BaseModel):
    userId: str
    amount: int = 100
    monthsAgo: int = 7


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
@api.post("/auth/signup")
async def signup(body: SignupBody):
    if not body.consentRGPD:
        raise HTTPException(400, "Le consentement RGPD est requis pour créer un compte.")
    email = body.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "Cet email est déjà utilisé.")
    doc = {
        "email": email, "passwordHash": hash_pw(body.password),
        "firstName": body.firstName.strip(), "role": C.ROLE_WALKER,
        "plan": C.PLAN_FREE, "ccBalance": 0, "consentRGPD": True,
        "consentRGPDVersion": "2026-01", "createdAt": datetime.now(timezone.utc),
        "active": True,
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    await onboard_new_walker(db, doc)
    user = await db.users.find_one({"_id": res.inserted_id})
    return {"token": make_token(user), "user": await public_user(user)}


@api.post("/auth/login")
async def login(body: LoginBody):
    email = body.email.strip().lower()
    user = await db.users.find_one({"email": email, "active": True})
    if not user or not verify_pw(body.password, user["passwordHash"]):
        raise HTTPException(401, "Email ou mot de passe incorrect.")
    return {"token": make_token(user), "user": await public_user(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    data = await public_user(user)
    if user["role"] == C.ROLE_PARTNER and user.get("partnerId"):
        data["partner"] = ser(await db.partners.find_one({"_id": ObjectId(user["partnerId"])}))
    return data


# ---------------------------------------------------------------------------
# Walker
# ---------------------------------------------------------------------------
def _next_cc_info(steps_today: int, plan: str):
    rate = C.CC_PER_1000_PREMIUM if plan == C.PLAN_PREMIUM else C.CC_PER_1000_FREE
    counted = min(steps_today, C.DAILY_STEP_CAP)
    steps_into = counted % 1000
    steps_to_next = 0 if counted >= C.DAILY_STEP_CAP else (1000 - steps_into)
    return rate, steps_to_next


@api.get("/walker/home")
async def walker_home(user: dict = Depends(require(C.ROLE_WALKER))):
    uid = str(user["_id"])
    bal = await E.refresh_balance(db, uid)
    today = E.today_str()
    entry = await db.step_entries.find_one({"userId": uid, "date": today})
    steps_today = int(entry["steps"]) if entry else 0
    cc_today = int(entry["ccEarned"]) if entry else 0
    rate, steps_to_next = _next_cc_info(steps_today, user["plan"])

    cc_needed = max(0, C.VOUCHER_COST_CC - bal)
    progress = min(1.0, bal / C.VOUCHER_COST_CC)
    if cc_needed == 0:
        sentence = "Tu peux réclamer ta viennoiserie dès maintenant !"
    else:
        steps_for_needed = cc_needed * (1000 // rate)
        sentence = f"encore {steps_for_needed} pas pour ta prochaine viennoiserie"

    return {
        "firstName": user["firstName"], "plan": user["plan"],
        "ccBalance": bal, "voucherCost": C.VOUCHER_COST_CC,
        "ccNeeded": cc_needed, "progress": progress,
        "stepsToday": steps_today, "ccToday": cc_today,
        "stepsToNextCC": steps_to_next, "sentence": sentence,
    }


@api.get("/walker/partners")
async def walker_partners(
    user: dict = Depends(require(C.ROLE_WALKER)),
    lat: float = Query(42.6986), lng: float = Query(2.8954),
):
    now = E.utc_now()
    out = []
    async for p in db.partners.find({"plan": C.PARTNER_ACTIVE}):
        dist = E.haversine_m(lat, lng, p["lat"], p["lng"])
        available = E.is_within_offpeak(p, now)
        out.append({
            **ser(p),
            "distanceM": round(dist),
            "walkMinutes": max(1, round(dist / 80)),
            "availableNow": available,
            "windowText": E.window_text(p),
        })
    out.sort(key=lambda x: x["distanceM"])
    return out


@api.get("/walker/partners/{partner_id}")
async def walker_partner_detail(partner_id: str, user: dict = Depends(require(C.ROLE_WALKER))):
    p = await db.partners.find_one({"_id": ObjectId(partner_id)})
    if not p:
        raise HTTPException(404, "Boulangerie introuvable.")
    return {**ser(p), "availableNow": E.is_within_offpeak(p, E.utc_now()),
            "windowText": E.window_text(p)}


@api.get("/walker/voucher")
async def walker_voucher(user: dict = Depends(require(C.ROLE_WALKER))):
    now = E.utc_now()
    await db.vouchers.update_many(
        {"userId": str(user["_id"]), "status": C.VOUCHER_ACTIVE, "expiresAt": {"$lte": now}},
        {"$set": {"status": C.VOUCHER_EXPIRED}},
    )
    v = await db.vouchers.find_one(
        {"userId": str(user["_id"]), "status": C.VOUCHER_ACTIVE, "expiresAt": {"$gt": now}}
    )
    if not v:
        return {"voucher": None}
    p = await db.partners.find_one({"_id": ObjectId(v["partnerId"])})
    return {"voucher": {**ser(v), "partnerName": p["businessName"] if p else "",
                        "partnerAddress": p["address"] if p else ""}}


@api.post("/walker/voucher")
async def walker_create_voucher(body: VoucherBody, user: dict = Depends(require(C.ROLE_WALKER))):
    p = await db.partners.find_one({"_id": ObjectId(body.partnerId)})
    if not p:
        raise HTTPException(404, "Boulangerie introuvable.")
    try:
        v = await E.create_voucher(db, user, p)
    except E.EngineError as ex:
        raise HTTPException(400, str(ex))
    return {"voucher": {**ser(v), "partnerName": p["businessName"], "partnerAddress": p["address"]}}


@api.get("/walker/history")
async def walker_history(user: dict = Depends(require(C.ROLE_WALKER))):
    uid = str(user["_id"])
    days = []
    async for e in db.step_entries.find({"userId": uid}).sort("date", -1).limit(60):
        days.append({"date": e["date"], "steps": e["steps"], "ccEarned": e["ccEarned"]})
    vouchers = []
    async for v in db.vouchers.find({"userId": uid}).sort("createdAt", -1).limit(40):
        p = await db.partners.find_one({"_id": ObjectId(v["partnerId"])})
        vouchers.append({**ser(v), "partnerName": p["businessName"] if p else ""})
    return {"days": days, "vouchers": vouchers}


@api.post("/walker/premium/subscribe")
async def premium_subscribe(user: dict = Depends(require(C.ROLE_WALKER))):
    # Payment provider call is stubbed behind a feature flag (OFF by default).
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"plan": C.PLAN_PREMIUM}})
    return {"plan": C.PLAN_PREMIUM, "paymentsEnabled": C.PAYMENTS_ENABLED}


@api.post("/walker/premium/cancel")
async def premium_cancel(user: dict = Depends(require(C.ROLE_WALKER))):
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"plan": C.PLAN_FREE}})
    return {"plan": C.PLAN_FREE}


@api.get("/walker/export")
async def rgpd_export(user: dict = Depends(require(C.ROLE_WALKER))):
    uid = str(user["_id"])
    steps = [{"date": e["date"], "steps": e["steps"], "ccEarned": e["ccEarned"]}
             async for e in db.step_entries.find({"userId": uid}).sort("date", 1)]
    vouchers = [ser(v) async for v in db.vouchers.find({"userId": uid})]
    return {
        "account": {"email": user["email"], "firstName": user["firstName"],
                    "plan": user["plan"], "consentRGPD": user.get("consentRGPD"),
                    "createdAt": user.get("createdAt")},
        "dailyStepTotals": steps, "vouchers": vouchers,
        "note": "Seul le total quotidien de pas est stocké, jamais de trace de localisation.",
    }


@api.delete("/walker/account")
async def delete_account(user: dict = Depends(require(C.ROLE_WALKER))):
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"active": False, "deletedAt": datetime.now(timezone.utc),
                  "email": f"deleted+{user['_id']}@croissmarche.fr"}},
    )
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Partner
# ---------------------------------------------------------------------------
async def _partner_of(user: dict) -> dict:
    p = await db.partners.find_one({"_id": ObjectId(user["partnerId"])})
    if not p:
        raise HTTPException(404, "Boulangerie introuvable.")
    return p


@api.get("/partner/me")
async def partner_me(user: dict = Depends(require(C.ROLE_PARTNER))):
    p = await _partner_of(user)
    return {**ser(p), "availableNow": E.is_within_offpeak(p, E.utc_now())}


@api.post("/partner/validate")
async def partner_validate(body: ValidateBody, user: dict = Depends(require(C.ROLE_PARTNER))):
    p = await _partner_of(user)
    try:
        result = await E.redeem_code(db, p, body.code)
    except E.EngineError as ex:
        raise HTTPException(400, str(ex))
    return {"ok": True, **result}


@api.get("/partner/stats")
async def partner_stats(user: dict = Depends(require(C.ROLE_PARTNER)),
                        month: Optional[str] = None):
    p = await _partner_of(user)
    pid = str(p["_id"])
    month = month or E.paris_now().strftime("%Y-%m")
    start = datetime.strptime(month + "-01", "%Y-%m-%d").replace(tzinfo=timezone.utc)
    end = (start + timedelta(days=32)).replace(day=1)

    new_c = returning_c = total = 0
    async for r in db.redemptions.find(
        {"partnerId": pid, "redeemedAt": {"$gte": start, "$lt": end}}
    ):
        total += 1
        if r.get("isNewCustomer"):
            new_c += 1
        else:
            returning_c += 1

    revenue_min = total * C.MIN_PURCHASE_CENTS
    cost = C.PARTNER_SUBSCRIPTION_CENTS + total * C.REDEMPTION_BILL_CENTS
    return {
        "month": month, "totalRedemptions": total,
        "newCustomers": new_c, "returningCustomers": returning_c,
        "estimatedRevenueCents": revenue_min, "partnerCostCents": cost,
        "subscriptionCents": C.PARTNER_SUBSCRIPTION_CENTS,
        "redemptionCents": total * C.REDEMPTION_BILL_CENTS,
    }


@api.get("/partner/billing")
async def partner_billing(user: dict = Depends(require(C.ROLE_PARTNER)),
                          month: Optional[str] = None):
    stats = await partner_stats(user, month)
    return {
        "month": stats["month"],
        "subscriptionCents": C.PARTNER_SUBSCRIPTION_CENTS,
        "redemptionCount": stats["totalRedemptions"],
        "redemptionCents": stats["redemptionCents"],
        "totalCents": C.PARTNER_SUBSCRIPTION_CENTS + stats["redemptionCents"],
    }


@api.put("/partner/settings")
async def partner_settings(body: PartnerSettingsBody, user: dict = Depends(require(C.ROLE_PARTNER))):
    p = await _partner_of(user)
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if "plan" in update and update["plan"] not in (C.PARTNER_ACTIVE, C.PARTNER_PAUSED):
        raise HTTPException(400, "Statut invalide.")
    if update:
        await db.partners.update_one({"_id": p["_id"]}, {"$set": update})
    return ser(await db.partners.find_one({"_id": p["_id"]}))


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------
@api.get("/admin/partners")
async def admin_partners(user: dict = Depends(require(C.ROLE_ADMIN))):
    return [ser(p) async for p in db.partners.find().sort("businessName", 1)]


@api.post("/admin/partners")
async def admin_create_partner(body: PartnerBody, user: dict = Depends(require(C.ROLE_ADMIN))):
    # 500 m exclusivity check against active partners.
    async for p in db.partners.find({"plan": C.PARTNER_ACTIVE}):
        d = E.haversine_m(body.lat, body.lng, p["lat"], p["lng"])
        if d < C.EXCLUSIVITY_RADIUS_M:
            if not body.force:
                raise HTTPException(409, {
                    "message": f"À {round(d)} m de « {p['businessName']} » "
                               f"(exclusivité {C.EXCLUSIVITY_RADIUS_M} m). "
                               "Confirme pour créer quand même.",
                    "conflict": p["businessName"], "distanceM": round(d),
                })
    doc = {
        "businessName": body.businessName, "address": body.address,
        "lat": body.lat, "lng": body.lng, "phone": body.phone,
        "contactName": body.contactName, "plan": C.PARTNER_ACTIVE,
        "offPeakStart": body.offPeakStart, "offPeakEnd": body.offPeakEnd,
        "offPeakDays": body.offPeakDays, "minPurchaseCents": C.MIN_PURCHASE_CENTS,
        "exclusivityRadiusM": C.EXCLUSIVITY_RADIUS_M, "reward": body.reward,
        "createdAt": datetime.now(timezone.utc),
    }
    res = await db.partners.insert_one(doc)
    doc["_id"] = res.inserted_id
    return ser(doc)


@api.put("/admin/partners/{partner_id}")
async def admin_update_partner(partner_id: str, body: PartnerBody,
                               user: dict = Depends(require(C.ROLE_ADMIN))):
    update = body.model_dump(exclude={"force"})
    await db.partners.update_one({"_id": ObjectId(partner_id)}, {"$set": update})
    return ser(await db.partners.find_one({"_id": ObjectId(partner_id)}))


@api.delete("/admin/partners/{partner_id}")
async def admin_pause_partner(partner_id: str, user: dict = Depends(require(C.ROLE_ADMIN))):
    # Soft: pause instead of destroying data.
    await db.partners.update_one({"_id": ObjectId(partner_id)}, {"$set": {"plan": C.PARTNER_PAUSED}})
    return {"paused": True}


@api.get("/admin/users")
async def admin_users(user: dict = Depends(require(C.ROLE_ADMIN))):
    out = []
    async for u in db.users.find({"role": C.ROLE_WALKER, "active": True}).sort("firstName", 1):
        bal = await E.spendable_balance(db, str(u["_id"]))
        out.append({"id": str(u["_id"]), "firstName": u["firstName"],
                    "email": u["email"], "plan": u["plan"], "ccBalance": bal})
    return out


@api.get("/admin/metrics")
async def admin_metrics(user: dict = Depends(require(C.ROLE_ADMIN))):
    active_walkers = await db.users.count_documents({"role": C.ROLE_WALKER, "active": True})
    total_partners = await db.partners.count_documents({"plan": C.PARTNER_ACTIVE})
    total_redemptions = await db.redemptions.count_documents({})
    month = E.paris_now().strftime("%Y-%m")
    start = datetime.strptime(month + "-01", "%Y-%m-%d").replace(tzinfo=timezone.utc)

    per_partner = []
    async for p in db.partners.find():
        cnt = await db.redemptions.count_documents({"partnerId": str(p["_id"])})
        per_partner.append({"businessName": p["businessName"], "redemptions": cnt,
                            "plan": p["plan"]})
    per_partner.sort(key=lambda x: x["redemptions"], reverse=True)

    month_redemptions = await db.redemptions.count_documents({"redeemedAt": {"$gte": start}})
    monthly_revenue = (total_partners * C.PARTNER_SUBSCRIPTION_CENTS
                       + month_redemptions * C.REDEMPTION_BILL_CENTS)
    return {
        "activeWalkers": active_walkers, "activePartners": total_partners,
        "totalRedemptions": total_redemptions, "monthlyRevenueCents": monthly_revenue,
        "perPartner": per_partner,
    }


# --- Dev panel (admin only) ---
@api.post("/admin/dev/set-steps")
async def dev_set_steps(body: DevStepsBody, user: dict = Depends(require(C.ROLE_ADMIN))):
    target = await db.users.find_one({"_id": ObjectId(body.userId)})
    if not target:
        raise HTTPException(404, "Utilisateur introuvable.")
    cc = await E.recompute_day(db, target, E.today_str(), body.steps, "DEV")
    return {"date": E.today_str(), "steps": body.steps, "ccEarned": cc}


@api.post("/admin/dev/backfill")
async def dev_backfill(body: DevBackfillBody, user: dict = Depends(require(C.ROLE_ADMIN))):
    target = await db.users.find_one({"_id": ObjectId(body.userId)})
    if not target:
        raise HTTPException(404, "Utilisateur introuvable.")
    src = E.SimulatedStepSource()
    today = E.paris_now().date()
    total = 0
    for d in range(body.days):
        ds = (today - timedelta(days=d)).strftime("%Y-%m-%d")
        total += await E.recompute_day(db, target, ds, src.steps_for(ds), "DEV")
    return {"days": body.days, "ccAdded": total}


@api.post("/admin/dev/set-plan")
async def dev_set_plan(body: DevPlanBody, user: dict = Depends(require(C.ROLE_ADMIN))):
    if body.plan not in (C.PLAN_FREE, C.PLAN_PREMIUM):
        raise HTTPException(400, "Plan invalide.")
    await db.users.update_one({"_id": ObjectId(body.userId)}, {"$set": {"plan": body.plan}})
    return {"plan": body.plan}


@api.post("/admin/dev/age-cc")
async def dev_age_cc(body: DevAgeBody, user: dict = Depends(require(C.ROLE_ADMIN))):
    await E.add_aged_cc(db, body.userId, body.amount, body.monthsAgo)
    bal = await E.spendable_balance(db, body.userId)
    return {"spendableBalance": bal, "injectedMonthsAgo": body.monthsAgo}


@api.post("/admin/notifications/run-daily")
async def run_daily_notifications(user: dict = Depends(require(C.ROLE_ADMIN))):
    """One end-of-day notification per walker, always with a number. Sender stubbed."""
    today = E.today_str()
    sent = 0
    async for u in db.users.find({"role": C.ROLE_WALKER, "active": True}):
        uid = str(u["_id"])
        entry = await db.step_entries.find_one({"userId": uid, "date": today})
        steps = int(entry["steps"]) if entry else 0
        cc = int(entry["ccEarned"]) if entry else 0
        bal = await E.spendable_balance(db, uid)
        need = max(0, C.VOUCHER_COST_CC - bal)
        if need == 0:
            msg = f"{u['firstName']}, tu as {bal} CC : ta viennoiserie t'attend !"
        else:
            msg = f"{u['firstName']}, {steps} pas aujourd'hui (+{cc} CC). Encore {need} CC pour une viennoiserie."
        await db.notifications.insert_one({
            "userId": uid, "date": today, "message": msg,
            "createdAt": datetime.now(timezone.utc), "sent": False,  # stub sender
        })
        logger.info("[NOTIF STUB] %s", msg)
        sent += 1
    return {"queued": sent}


@api.get("/")
async def root():
    return {"app": "Croiss'Marche", "status": "ok"}


app.include_router(api)
app.add_middleware(
    CORSMiddleware, allow_credentials=True, allow_origins=["*"],
    allow_methods=["*"], allow_headers=["*"],
)


@app.on_event("startup")
async def _startup():
    await seed(db)
    logger.info("Seed complete.")


@app.on_event("shutdown")
async def _shutdown():
    client.close()
