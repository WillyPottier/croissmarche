"""End-to-end integration tests for Croiss'Marche public API.
Covers: auth (3 roles + signup), walker home/partners/voucher, partner
validation flow (success + double-use + wrong bakery), partner stats/billing,
admin metrics/users/partners (500 m exclusivity), and admin dev panel.
"""
import time
import uuid
import pytest
import requests

BASE = None  # filled in via base_url fixture


def _post(session, url, headers, body, expect=200):
    r = session.post(url, headers=headers, json=body)
    return r


# --- Auth (login for all 3 roles + signup RGPD) ---
class TestAuth:
    def test_login_walker_ok(self, walker_auth):
        assert walker_auth["user"]["role"] == "walker"
        assert walker_auth["user"]["email"] == "marie@croissmarche.fr"

    def test_login_partner_ok(self, partner_auth):
        assert partner_auth["user"]["role"] == "partner"

    def test_login_admin_ok(self, admin_auth):
        assert admin_auth["user"]["role"] == "admin"

    def test_login_bad_password(self, session, base_url):
        r = session.post(f"{base_url}/api/auth/login",
                         json={"email": "marie@croissmarche.fr",
                               "password": "wrong"})
        assert r.status_code == 401

    def test_signup_refuses_no_consent(self, session, base_url):
        email = f"test_{uuid.uuid4().hex[:8]}@croissmarche.fr"
        r = session.post(f"{base_url}/api/auth/signup", json={
            "email": email, "password": "abcdef", "firstName": "Test",
            "consentRGPD": False,
        })
        assert r.status_code == 400
        assert "RGPD" in r.text or "consent" in r.text.lower()

    def test_signup_success_with_consent(self, session, base_url):
        email = f"test_{uuid.uuid4().hex[:8]}@croissmarche.fr"
        r = session.post(f"{base_url}/api/auth/signup", json={
            "email": email, "password": "abcdef", "firstName": "TestUser",
            "consentRGPD": True,
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert "token" in body and body["user"]["role"] == "walker"
        assert body["user"]["email"] == email


# --- Walker endpoints ---
class TestWalkerHome:
    def test_home_shape(self, session, walker_auth, base_url):
        r = session.get(f"{base_url}/api/walker/home",
                        headers=walker_auth["headers"])
        assert r.status_code == 200, r.text
        j = r.json()
        for k in ("ccBalance", "voucherCost", "progress", "sentence",
                  "stepsToday", "ccToday", "stepsToNextCC", "firstName"):
            assert k in j, f"Missing key {k}"
        assert j["voucherCost"] == 60
        # Sentence must contain a number
        assert any(c.isdigit() for c in j["sentence"]), \
            f"Sentence has no number: {j['sentence']}"

    def test_partners_sorted_by_distance(self, session, walker_auth, base_url):
        r = session.get(f"{base_url}/api/walker/partners",
                        headers=walker_auth["headers"])
        assert r.status_code == 200
        partners = r.json()
        assert len(partners) >= 1
        dists = [p["distanceM"] for p in partners]
        assert dists == sorted(dists), "Partners not sorted by distance"
        for p in partners:
            assert "availableNow" in p and "windowText" in p


# --- Voucher flow (create + validate) ---
class TestVoucherFlow:
    @pytest.fixture(scope="class", autouse=True)
    def _topup_marie(self, session, admin_auth, base_url):
        # Ensure Marie has >=120 CC via dev panel (allow 2 voucher creations).
        users = session.get(f"{base_url}/api/admin/users",
                            headers=admin_auth["headers"]).json()
        marie = next(u for u in users if u["email"] == "marie@croissmarche.fr")
        # Inject 240 CC directly to guarantee sufficient balance regardless of
        # prior spends. `monthsAgo=0` keeps them valid ~6 months.
        for _ in range(4):
            session.post(f"{base_url}/api/admin/dev/age-cc",
                         headers=admin_auth["headers"],
                         json={"userId": marie["id"], "amount": 60, "monthsAgo": 0})

    @pytest.fixture(scope="class")
    def castillet_partner_id(self, session, walker_auth, base_url):
        r = session.get(f"{base_url}/api/walker/partners",
                        headers=walker_auth["headers"])
        for p in r.json():
            if "Castillet" in p["businessName"] or "Fournil du Castillet" in p["businessName"]:
                return p["id"]
        pytest.skip("Castillet partner not found in seeded data")

    @pytest.fixture(scope="class")
    def other_partner_id(self, session, walker_auth, base_url):
        r = session.get(f"{base_url}/api/walker/partners",
                        headers=walker_auth["headers"])
        for p in r.json():
            if "Castillet" not in p["businessName"]:
                return p["id"]
        pytest.skip("No non-Castillet partner")

    def test_walker_can_create_voucher_at_castillet(
            self, session, walker_auth, base_url, castillet_partner_id):
        # Ensure balance >= 60 by bumping steps via admin dev endpoint
        # Instead just try; if not enough CC, admin can top up (handled below).
        # First check balance
        home = session.get(f"{base_url}/api/walker/home",
                           headers=walker_auth["headers"]).json()
        if home["ccBalance"] < 60:
            pytest.skip("Walker has <60 CC — top-up done in TestAdmin.")

        # Clear any active voucher first by GET (server auto-expires stale)
        # If one active exists we may need to skip create-second test only
        v = session.get(f"{base_url}/api/walker/voucher",
                        headers=walker_auth["headers"]).json()
        if v.get("voucher"):
            # cannot create; test the double-active refusal below
            pytest.skip("Active voucher already present; covered by other test.")

        r = session.post(f"{base_url}/api/walker/voucher",
                         headers=walker_auth["headers"],
                         json={"partnerId": castillet_partner_id})
        assert r.status_code == 200, r.text
        voucher = r.json()["voucher"]
        assert voucher["status"] == "ACTIVE"
        assert len(voucher["code"]) == 4 and voucher["code"].isdigit()
        pytest.voucher_code = voucher["code"]

    def test_second_create_while_active_refused(
            self, session, walker_auth, base_url, castillet_partner_id):
        r = session.post(f"{base_url}/api/walker/voucher",
                         headers=walker_auth["headers"],
                         json={"partnerId": castillet_partner_id})
        # Should refuse because one is active
        assert r.status_code == 400
        assert "contremarque" in r.text.lower() or "active" in r.text.lower()

    def test_partner_validate_success(self, session, partner_auth, base_url):
        code = getattr(pytest, "voucher_code", None)
        if not code:
            pytest.skip("No voucher created")
        r = session.post(f"{base_url}/api/partner/validate",
                         headers=partner_auth["headers"],
                         json={"code": code})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["ok"] is True
        assert "rewardName" in j and "minPurchaseCents" in j
        assert isinstance(j["isNewCustomer"], bool)

    def test_partner_validate_double_refused(self, session, partner_auth, base_url):
        code = getattr(pytest, "voucher_code", None)
        if not code:
            pytest.skip("No voucher created")
        r = session.post(f"{base_url}/api/partner/validate",
                         headers=partner_auth["headers"],
                         json={"code": code})
        assert r.status_code == 400
        assert "déjà" in r.text or "utilis" in r.text.lower()

    def test_partner_validate_wrong_bakery(
            self, session, walker_auth, other_partner_auth, base_url,
            castillet_partner_id):
        # Create a new voucher at Castillet, try to redeem at another partner.
        v = session.get(f"{base_url}/api/walker/voucher",
                        headers=walker_auth["headers"]).json()
        if v.get("voucher"):
            pytest.skip("Existing active voucher blocks creation")
        home = session.get(f"{base_url}/api/walker/home",
                           headers=walker_auth["headers"]).json()
        if home["ccBalance"] < 60:
            pytest.skip("<60 CC")
        r = session.post(f"{base_url}/api/walker/voucher",
                         headers=walker_auth["headers"],
                         json={"partnerId": castillet_partner_id})
        assert r.status_code == 200, r.text
        code = r.json()["voucher"]["code"]

        r2 = session.post(f"{base_url}/api/partner/validate",
                          headers=other_partner_auth["headers"],
                          json={"code": code})
        assert r2.status_code == 400
        # Message can be "n'appartient pas" or generic invalid
        assert "boulangerie" in r2.text.lower() or "invalide" in r2.text.lower()


class TestVoucherInsufficientBalance:
    """Signup a fresh walker (0 CC), attempt voucher → refused."""
    def test_insufficient_balance_refused(self, session, base_url):
        email = f"poor_{uuid.uuid4().hex[:8]}@croissmarche.fr"
        r = session.post(f"{base_url}/api/auth/signup", json={
            "email": email, "password": "abcdef", "firstName": "Poor",
            "consentRGPD": True})
        assert r.status_code == 200
        token = r.json()["token"]
        hdr = {"Authorization": f"Bearer {token}",
               "Content-Type": "application/json"}
        partners = session.get(f"{base_url}/api/walker/partners",
                               headers=hdr).json()
        castillet = next((p for p in partners if "Castillet" in p["businessName"]), None)
        if not castillet:
            pytest.skip("No Castillet")

        home = session.get(f"{base_url}/api/walker/home", headers=hdr).json()
        if home["ccBalance"] >= 60:
            pytest.skip("Newly seeded walker got >=60 CC from backfill")

        r = session.post(f"{base_url}/api/walker/voucher", headers=hdr,
                         json={"partnerId": castillet["id"]})
        assert r.status_code == 400
        assert "insuffisant" in r.text.lower() or "solde" in r.text.lower()


# --- Partner stats/billing/settings ---
class TestPartner:
    def test_stats(self, session, partner_auth, base_url):
        r = session.get(f"{base_url}/api/partner/stats",
                        headers=partner_auth["headers"])
        assert r.status_code == 200, r.text
        j = r.json()
        for k in ("totalRedemptions", "newCustomers", "returningCustomers",
                  "estimatedRevenueCents", "partnerCostCents"):
            assert k in j

    def test_billing(self, session, partner_auth, base_url):
        r = session.get(f"{base_url}/api/partner/billing",
                        headers=partner_auth["headers"])
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["subscriptionCents"] == 4900  # 49 EUR
        # per-redemption 100 cents each
        assert j["totalCents"] == 4900 + j["redemptionCount"] * 100

    def test_settings_update(self, session, partner_auth, base_url):
        r = session.put(f"{base_url}/api/partner/settings",
                        headers=partner_auth["headers"],
                        json={"reward": "1 chouquette", "plan": "ACTIVE"})
        assert r.status_code == 200, r.text
        assert r.json()["reward"] == "1 chouquette"


# --- Admin ---
class TestAdmin:
    def test_metrics(self, session, admin_auth, base_url):
        r = session.get(f"{base_url}/api/admin/metrics",
                        headers=admin_auth["headers"])
        assert r.status_code == 200, r.text
        j = r.json()
        for k in ("activeWalkers", "activePartners", "totalRedemptions",
                  "monthlyRevenueCents", "perPartner"):
            assert k in j
        assert isinstance(j["perPartner"], list)

    def test_users(self, session, admin_auth, base_url):
        r = session.get(f"{base_url}/api/admin/users",
                        headers=admin_auth["headers"])
        assert r.status_code == 200
        users = r.json()
        assert len(users) >= 1
        assert all("ccBalance" in u for u in users)

    def test_partners_list(self, session, admin_auth, base_url):
        r = session.get(f"{base_url}/api/admin/partners",
                        headers=admin_auth["headers"])
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_500m_exclusivity_conflict_then_force(self, session, admin_auth, base_url):
        body = {
            "businessName": f"TEST_ExclCheck_{uuid.uuid4().hex[:6]}",
            "address": "TEST addr",
            "lat": 42.7020, "lng": 2.8955,
            "phone": "", "contactName": "",
            "offPeakStart": "14:00", "offPeakEnd": "17:00",
            "offPeakDays": [0, 1, 2, 3, 4],
            "reward": "1 chouquette",
            "force": False,
        }
        r = session.post(f"{base_url}/api/admin/partners",
                         headers=admin_auth["headers"], json=body)
        assert r.status_code == 409, f"Expected 409, got {r.status_code}: {r.text}"

        body["force"] = True
        body["businessName"] = f"TEST_ExclForced_{uuid.uuid4().hex[:6]}"
        r2 = session.post(f"{base_url}/api/admin/partners",
                          headers=admin_auth["headers"], json=body)
        assert r2.status_code == 200, r2.text
        created_id = r2.json()["id"]
        # cleanup: pause it
        session.delete(f"{base_url}/api/admin/partners/{created_id}",
                       headers=admin_auth["headers"])

    def test_dev_set_steps(self, session, admin_auth, base_url):
        # Grab marie's id from admin/users
        users = session.get(f"{base_url}/api/admin/users",
                            headers=admin_auth["headers"]).json()
        marie = next(u for u in users if u["email"] == "marie@croissmarche.fr")
        r = session.post(f"{base_url}/api/admin/dev/set-steps",
                         headers=admin_auth["headers"],
                         json={"userId": marie["id"], "steps": 8000})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["steps"] == 8000
        # PREMIUM plan on Marie → 8000 * 2 // 1000 = 16
        assert j["ccEarned"] == 16 or j["ccEarned"] == 8

    def test_dev_backfill(self, session, admin_auth, base_url):
        users = session.get(f"{base_url}/api/admin/users",
                            headers=admin_auth["headers"]).json()
        marie = next(u for u in users if u["email"] == "marie@croissmarche.fr")
        r = session.post(f"{base_url}/api/admin/dev/backfill",
                         headers=admin_auth["headers"],
                         json={"userId": marie["id"], "days": 3})
        assert r.status_code == 200, r.text
        assert "ccAdded" in r.json()

    def test_dev_set_plan(self, session, admin_auth, base_url):
        users = session.get(f"{base_url}/api/admin/users",
                            headers=admin_auth["headers"]).json()
        marie = next(u for u in users if u["email"] == "marie@croissmarche.fr")
        r = session.post(f"{base_url}/api/admin/dev/set-plan",
                         headers=admin_auth["headers"],
                         json={"userId": marie["id"], "plan": "PREMIUM"})
        assert r.status_code == 200
        assert r.json()["plan"] == "PREMIUM"

    def test_dev_age_cc(self, session, admin_auth, base_url):
        users = session.get(f"{base_url}/api/admin/users",
                            headers=admin_auth["headers"]).json()
        marie = next(u for u in users if u["email"] == "marie@croissmarche.fr")
        r = session.post(f"{base_url}/api/admin/dev/age-cc",
                         headers=admin_auth["headers"],
                         json={"userId": marie["id"], "amount": 10, "monthsAgo": 7})
        assert r.status_code == 200

    def test_notifications_run_daily(self, session, admin_auth, base_url):
        r = session.post(f"{base_url}/api/admin/notifications/run-daily",
                         headers=admin_auth["headers"], json={})
        assert r.status_code == 200
        assert r.json()["queued"] >= 1
