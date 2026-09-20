"""Shared fixtures for Croiss'Marche pytest suite."""
import os
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
PASSWORD = "croissant123"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(session, email, password=PASSWORD):
    r = session.post(f"{BASE_URL}/api/auth/login",
                     json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def walker_auth(session):
    data = _login(session, "marie@croissmarche.fr")
    return {"token": data["token"], "user": data["user"],
            "headers": {"Authorization": f"Bearer {data['token']}",
                        "Content-Type": "application/json"}}


@pytest.fixture(scope="session")
def partner_auth(session):
    data = _login(session, "contact@castillet.fr")
    return {"token": data["token"], "user": data["user"],
            "headers": {"Authorization": f"Bearer {data['token']}",
                        "Content-Type": "application/json"}}


@pytest.fixture(scope="session")
def other_partner_auth(session):
    data = _login(session, "contact@saint-jean.fr")
    return {"token": data["token"], "user": data["user"],
            "headers": {"Authorization": f"Bearer {data['token']}",
                        "Content-Type": "application/json"}}


@pytest.fixture(scope="session")
def admin_auth(session):
    data = _login(session, "admin@croissmarche.fr")
    return {"token": data["token"], "user": data["user"],
            "headers": {"Authorization": f"Bearer {data['token']}",
                        "Content-Type": "application/json"}}
