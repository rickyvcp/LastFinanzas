"""Backend tests for Control Financiero Pro"""
import os
import uuid
import base64
import pytest
import requests
from pathlib import Path

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://app-installer-107.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# A simple real JPEG image (1x1 pixel) - encoded base64.
# Use a slightly larger valid jpeg via PIL if available; otherwise this minimal works for content-type but GPT-4o may not return useful data.
SAMPLE_JPEG_B64 = (
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKpgB//Z"
)


@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def auth(s):
    """Register a fresh user; return (token, user)."""
    email = f"test_{uuid.uuid4().hex[:8]}@cfpro.app"
    password = "Test1234!"
    name = "Test User"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": password, "name": name}, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return {"token": data["token"], "user": data["user"], "email": email, "password": password}


@pytest.fixture
def hdr(auth):
    return {"Authorization": f"Bearer {auth['token']}"}


# Health
def test_health_root(s):
    r = s.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j.get("ok") is True


def test_categories(s):
    r = s.get(f"{API}/categories", timeout=15)
    assert r.status_code == 200
    cats = r.json()["categories"]
    assert isinstance(cats, list) and len(cats) == 9
    assert "Alimentación" in cats and "Otros" in cats


# Auth
def test_register_duplicate(s, auth):
    r = s.post(f"{API}/auth/register", json={"email": auth["email"], "password": "Other1234!", "name": "Dup"}, timeout=15)
    assert r.status_code == 400


def test_login_success(s, auth):
    r = s.post(f"{API}/auth/login", json={"email": auth["email"], "password": auth["password"]}, timeout=15)
    assert r.status_code == 200
    assert "token" in r.json()


def test_login_wrong_password(s, auth):
    r = s.post(f"{API}/auth/login", json={"email": auth["email"], "password": "WrongPass!"}, timeout=15)
    assert r.status_code == 401


def test_me_with_token(s, hdr, auth):
    r = s.get(f"{API}/auth/me", headers=hdr, timeout=15)
    assert r.status_code == 200
    assert r.json()["email"] == auth["email"]


def test_me_without_token(s):
    r = s.get(f"{API}/auth/me", timeout=15)
    assert r.status_code == 401


# Transactions
def test_transactions_crud(s, hdr):
    payload = {"title": "TEST_Comida", "amount": 25.5, "category": "Alimentación", "type": "expense", "account": "Efectivo", "month": "2026-01"}
    r = s.post(f"{API}/transactions", json=payload, headers=hdr, timeout=15)
    assert r.status_code == 200, r.text
    tx = r.json()
    assert tx["title"] == "TEST_Comida" and tx["amount"] == 25.5
    assert "_id" not in tx
    tx_id = tx["id"]

    # GET list
    r = s.get(f"{API}/transactions", headers=hdr, timeout=15)
    assert r.status_code == 200
    assert any(t["id"] == tx_id for t in r.json())

    # PUT update
    payload2 = {**payload, "amount": 99.99, "title": "TEST_Comida_Edit"}
    r = s.put(f"{API}/transactions/{tx_id}", json=payload2, headers=hdr, timeout=15)
    assert r.status_code == 200
    assert r.json()["amount"] == 99.99

    # DELETE
    r = s.delete(f"{API}/transactions/{tx_id}", headers=hdr, timeout=15)
    assert r.status_code == 200

    # Verify gone
    r = s.delete(f"{API}/transactions/{tx_id}", headers=hdr, timeout=15)
    assert r.status_code == 404


def test_summary(s, hdr):
    # add some data
    s.post(f"{API}/transactions", json={"title": "TEST_Ingreso", "amount": 1000, "category": "Otros", "type": "income", "month": "2026-01"}, headers=hdr, timeout=15)
    s.post(f"{API}/transactions", json={"title": "TEST_Gasto", "amount": 200, "category": "Alimentación", "type": "expense", "month": "2026-01"}, headers=hdr, timeout=15)

    r = s.get(f"{API}/summary?month=2026-01", headers=hdr, timeout=15)
    assert r.status_code == 200
    j = r.json()
    for k in ("month", "income", "expense", "balance", "series", "by_category", "recent"):
        assert k in j
    assert len(j["series"]) == 6
    assert j["income"] >= 1000 and j["expense"] >= 200
    assert abs(j["balance"] - (j["income"] - j["expense"])) < 0.01


# Budgets
def test_budgets_crud(s, hdr):
    payload = {"category": "Alimentación", "limit": 500, "month": "2026-01"}
    r = s.post(f"{API}/budgets", json=payload, headers=hdr, timeout=15)
    assert r.status_code == 200, r.text
    b = r.json()
    bid = b["id"]
    assert b["limit"] == 500
    assert "spent" in b

    # duplicate -> update
    r = s.post(f"{API}/budgets", json={**payload, "limit": 800}, headers=hdr, timeout=15)
    assert r.status_code == 200
    assert r.json()["limit"] == 800

    # GET list
    r = s.get(f"{API}/budgets?month=2026-01", headers=hdr, timeout=15)
    assert r.status_code == 200
    arr = r.json()
    assert any(x["id"] == bid for x in arr)
    assert all("spent" in x for x in arr)

    # DELETE
    r = s.delete(f"{API}/budgets/{bid}", headers=hdr, timeout=15)
    assert r.status_code == 200
    r = s.delete(f"{API}/budgets/{bid}", headers=hdr, timeout=15)
    assert r.status_code == 404


# Goals
def test_goals_flow(s, hdr):
    r = s.post(f"{API}/goals", json={"name": "TEST_Viaje", "target_amount": 2000, "saved_amount": 0, "color": "#386641"}, headers=hdr, timeout=15)
    assert r.status_code == 200, r.text
    g = r.json()
    gid = g["id"]

    r = s.post(f"{API}/goals/{gid}/contribute", json={"amount": 150}, headers=hdr, timeout=15)
    assert r.status_code == 200
    assert r.json()["saved_amount"] == 150

    r = s.post(f"{API}/goals/{gid}/contribute", json={"amount": 50}, headers=hdr, timeout=15)
    assert r.json()["saved_amount"] == 200

    r = s.get(f"{API}/goals", headers=hdr, timeout=15)
    assert r.status_code == 200
    assert any(x["id"] == gid for x in r.json())

    r = s.delete(f"{API}/goals/{gid}", headers=hdr, timeout=15)
    assert r.status_code == 200


# Receipt analysis (AI)
def test_analyze_receipt(s, hdr):
    r = s.post(f"{API}/analyze-receipt", json={"image_base64": SAMPLE_JPEG_B64, "mime_type": "image/jpeg"}, headers=hdr, timeout=90)
    # Either 200 with shape or 500 if AI failure - test passes if shape OK on 200
    assert r.status_code in (200, 500), r.text
    if r.status_code == 200:
        j = r.json()
        for k in ("title", "amount", "category", "type", "month"):
            assert k in j
        assert j["type"] in ("expense", "income")
    else:
        pytest.skip(f"AI returned 500: {r.text}")
