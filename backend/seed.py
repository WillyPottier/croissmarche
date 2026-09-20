"""Idempotent seed: 1 admin, 6 Perpignan partners (+ their login accounts),
20 walkers with 7 days of step history."""

import random

import bcrypt

import config as C
from engine import SimulatedStepSource, recompute_day, paris_now
from datetime import timedelta


def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


PERPIGNAN_PARTNERS = [
    {
        "businessName": "Boulangerie Saint-Jean",
        "address": "3 Place Gambetta, 66000 Perpignan",
        "lat": 42.6994, "lng": 2.8946, "phone": "04 68 34 12 45",
        "contactName": "Élise Fabre", "slug": "saint-jean",
    },
    {
        "businessName": "Le Fournil du Castillet",
        "address": "2 Place de Verdun, 66000 Perpignan",
        "lat": 42.7020, "lng": 2.8955, "phone": "04 68 51 09 22",
        "contactName": "Marc Vidal", "slug": "castillet",
        "offPeakStart": "07:00", "offPeakEnd": "21:00",
        "offPeakDays": [0, 1, 2, 3, 4, 5, 6],
    },
    {
        "businessName": "Maison Porté",
        "address": "18 Avenue du Général de Gaulle, 66000 Perpignan",
        "lat": 42.6962, "lng": 2.8790, "phone": "04 68 35 44 71",
        "contactName": "Sophie Porté", "slug": "porte",
    },
    {
        "businessName": "La Croustille Catalane",
        "address": "9 Rue de la Fusterie, 66000 Perpignan",
        "lat": 42.6975, "lng": 2.8925, "phone": "04 68 21 55 33",
        "contactName": "Julien Camps", "slug": "croustille",
    },
    {
        "businessName": "Aux Délices d'Aristide",
        "address": "24 Boulevard Aristide Briand, 66000 Perpignan",
        "lat": 42.6930, "lng": 2.8968, "phone": "04 68 50 18 07",
        "contactName": "Nadia Roig", "slug": "aristide",
    },
    {
        "businessName": "Le Pétrin de Perpignan",
        "address": "41 Avenue Julien Panchot, 66000 Perpignan",
        "lat": 42.7098, "lng": 2.8852, "phone": "04 68 55 62 90",
        "contactName": "Thomas Sanz", "slug": "petrin",
    },
]

WALKER_NAMES = [
    "Marie", "Léa", "Camille", "Hugo", "Lucas", "Chloé", "Nathan", "Emma",
    "Louis", "Jade", "Gabriel", "Manon", "Raphaël", "Louise", "Arthur",
    "Alice", "Paul", "Inès", "Antoine", "Zoé",
]


async def seed(db):
    # Indexes (idempotent)
    await db.users.create_index("email", unique=True)
    try:
        await db.vouchers.create_index(
            "userId", unique=True, name="one_active_voucher",
            partialFilterExpression={"status": C.VOUCHER_ACTIVE},
        )
    except Exception:
        pass

    if await db.users.count_documents({"role": C.ROLE_ADMIN}) == 0:
        await db.users.insert_one({
            "email": "admin@croissmarche.fr", "passwordHash": _hash("croissant123"),
            "firstName": "Opérateur", "role": C.ROLE_ADMIN,
            "plan": C.PLAN_FREE, "ccBalance": 0, "consentRGPD": True,
            "createdAt": paris_now().isoformat(), "active": True,
        })

    # Partners + their login accounts
    for p in PERPIGNAN_PARTNERS:
        if await db.partners.find_one({"businessName": p["businessName"]}):
            continue
        partner_doc = {
            "businessName": p["businessName"], "address": p["address"],
            "lat": p["lat"], "lng": p["lng"], "phone": p["phone"],
            "contactName": p["contactName"], "plan": C.PARTNER_ACTIVE,
            "offPeakStart": p.get("offPeakStart", "14:00"),
            "offPeakEnd": p.get("offPeakEnd", "17:00"),
            "offPeakDays": p.get("offPeakDays", [0, 1, 2, 3, 4]),
            "minPurchaseCents": C.MIN_PURCHASE_CENTS,
            "exclusivityRadiusM": C.EXCLUSIVITY_RADIUS_M,
            "reward": C.DEFAULT_REWARD,
            "createdAt": paris_now().isoformat(),
        }
        res = await db.partners.insert_one(partner_doc)
        await db.users.insert_one({
            "email": f"contact@{p['slug']}.fr", "passwordHash": _hash("croissant123"),
            "firstName": p["contactName"], "role": C.ROLE_PARTNER,
            "partnerId": str(res.inserted_id),
            "plan": C.PLAN_FREE, "ccBalance": 0, "consentRGPD": True,
            "createdAt": paris_now().isoformat(), "active": True,
        })

    # Walkers with history
    if await db.users.count_documents({"role": C.ROLE_WALKER}) == 0:
        rng = random.Random(42)
        today = paris_now().date()
        for i, name in enumerate(WALKER_NAMES):
            plan = C.PLAN_PREMIUM if i % 4 == 0 else C.PLAN_FREE
            email = "marie@croissmarche.fr" if name == "Marie" else f"{name.lower()}{i}@croissmarche.fr"
            res = await db.users.insert_one({
                "email": email, "passwordHash": _hash("croissant123"),
                "firstName": name, "role": C.ROLE_WALKER,
                "plan": plan, "ccBalance": 0, "consentRGPD": True,
                "createdAt": paris_now().isoformat(), "active": True,
            })
            user = await db.users.find_one({"_id": res.inserted_id})
            src = SimulatedStepSource(seed=1000 + i)
            for d in range(C.ONBOARDING_DAYS):
                date_str = (today - timedelta(days=d)).strftime("%Y-%m-%d")
                await recompute_day(db, user, date_str, src.steps_for(date_str), "SIMULATED")


async def onboard_new_walker(db, user: dict):
    """On signup, import the last 7 days so the walker starts with a balance."""
    src = SimulatedStepSource(seed=random.randint(0, 1_000_000))
    today = paris_now().date()
    for d in range(C.ONBOARDING_DAYS):
        date_str = (today - timedelta(days=d)).strftime("%Y-%m-%d")
        await recompute_day(db, user, date_str, src.steps_for(date_str), "SIMULATED")
