"""
Control Financiero Pro - Backend API
FastAPI + MongoDB
Endpoints: auth (JWT + Emergent Google), transactions, budgets, goals, AI receipt analysis.
"""
import os
import uuid
import logging
import base64
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import httpx
import jwt as pyjwt
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Header, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# -----------------------------------------------------------------------------
# Setup
# -----------------------------------------------------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Control Financiero Pro")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("cfpro")

CATEGORIES = [
    "Alimentación", "Transporte", "Vivienda", "Servicios",
    "Salud", "Entretenimiento", "Ropa", "Educación", "Otros",
]

# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class GoogleSessionIn(BaseModel):
    session_id: str

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    auth_provider: str = "email"
    created_at: datetime

class TransactionIn(BaseModel):
    title: str
    amount: float
    category: str
    type: Literal["income", "expense"] = "expense"
    account: str = "Efectivo"
    month: str  # YYYY-MM
    date: Optional[str] = None
    note: str = ""
    is_paid: bool = True

class Transaction(TransactionIn):
    id: str
    user_id: str
    created_at: datetime

class BudgetIn(BaseModel):
    category: str
    limit: float
    month: str

class Budget(BudgetIn):
    id: str
    user_id: str
    spent: float = 0.0
    created_at: datetime

class GoalIn(BaseModel):
    name: str
    target_amount: float
    saved_amount: float = 0.0
    deadline: Optional[str] = None
    color: str = "#386641"

class Goal(GoalIn):
    id: str
    user_id: str
    created_at: datetime

class ContributeIn(BaseModel):
    amount: float

class AnalyzeReceiptIn(BaseModel):
    image_base64: str
    mime_type: str = "image/jpeg"

# -----------------------------------------------------------------------------
# Auth helpers
# -----------------------------------------------------------------------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def make_jwt(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "iat": datetime.now(timezone.utc),
        "type": "jwt",
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def get_current_user(authorization: Optional[str] = Header(None)) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="No autenticado")
    token = authorization.split(" ", 1)[1].strip()

    # Try JWT first
    user_id: Optional[str] = None
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
    except Exception:
        pass

    # Fallback: Emergent session_token
    if not user_id:
        session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
        if not session:
            raise HTTPException(status_code=401, detail="Token inválido")
        expires_at = session.get("expires_at")
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at and expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Sesión expirada")
        user_id = session["user_id"]

    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    user_doc.pop("password_hash", None)
    return User(**user_doc)

# -----------------------------------------------------------------------------
# Health
# -----------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"ok": True, "app": "Control Financiero Pro"}

@api.get("/categories")
async def list_categories():
    return {"categories": CATEGORIES}

# -----------------------------------------------------------------------------
# Auth endpoints
# -----------------------------------------------------------------------------
@api.post("/auth/register")
async def register(payload: RegisterIn):
    existing = await db.users.find_one({"email": payload.email.lower()}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": payload.email.lower(),
        "name": payload.name,
        "picture": None,
        "auth_provider": "email",
        "password_hash": hash_password(payload.password),
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(user_doc)
    token = make_jwt(user_id)
    return {
        "token": token,
        "user": {"user_id": user_id, "email": payload.email.lower(), "name": payload.name, "picture": None, "auth_provider": "email"},
    }

@api.post("/auth/login")
async def login(payload: LoginIn):
    user_doc = await db.users.find_one({"email": payload.email.lower()}, {"_id": 0})
    if not user_doc or not user_doc.get("password_hash"):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    if not verify_password(payload.password, user_doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    token = make_jwt(user_doc["user_id"])
    return {
        "token": token,
        "user": {k: user_doc.get(k) for k in ["user_id", "email", "name", "picture", "auth_provider"]},
    }

@api.post("/auth/google/session")
async def google_session(payload: GoogleSessionIn):
    """Exchange Emergent session_id for our user + session_token."""
    async with httpx.AsyncClient(timeout=15.0) as http_client:
        try:
            r = await http_client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": payload.session_id},
            )
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            logger.exception("Emergent auth exchange failed")
            raise HTTPException(status_code=401, detail=f"No se pudo validar sesión: {e}")

    email = (data.get("email") or "").lower()
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=400, detail="Datos de sesión inválidos")

    user_doc = await db.users.find_one({"email": email}, {"_id": 0})
    if not user_doc:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(user_doc)
    user_id = user_doc["user_id"]

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    return {
        "token": session_token,
        "user": {k: user_doc.get(k) for k in ["user_id", "email", "name", "picture", "auth_provider"]},
    }

@api.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}

# -----------------------------------------------------------------------------
# Transactions
# -----------------------------------------------------------------------------
@api.get("/transactions")
async def list_transactions(
    month: Optional[str] = None,
    type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    q: dict = {"user_id": current_user.user_id}
    if month:
        q["month"] = month
    if type in ("income", "expense"):
        q["type"] = type
    rows = await db.transactions.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return rows

@api.post("/transactions")
async def create_transaction(payload: TransactionIn, current_user: User = Depends(get_current_user)):
    if payload.category not in CATEGORIES:
        payload.category = "Otros"
    doc = {
        "id": f"tx_{uuid.uuid4().hex[:12]}",
        "user_id": current_user.user_id,
        "created_at": datetime.now(timezone.utc),
        **payload.model_dump(),
    }
    await db.transactions.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc

@api.put("/transactions/{tx_id}")
async def update_transaction(tx_id: str, payload: TransactionIn, current_user: User = Depends(get_current_user)):
    res = await db.transactions.update_one(
        {"id": tx_id, "user_id": current_user.user_id},
        {"$set": payload.model_dump()},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="No encontrado")
    doc = await db.transactions.find_one({"id": tx_id}, {"_id": 0})
    return doc

@api.delete("/transactions/{tx_id}")
async def delete_transaction(tx_id: str, current_user: User = Depends(get_current_user)):
    res = await db.transactions.delete_one({"id": tx_id, "user_id": current_user.user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No encontrado")
    return {"ok": True}

# -----------------------------------------------------------------------------
# Dashboard summary
# -----------------------------------------------------------------------------
@api.get("/summary")
async def summary(month: Optional[str] = None, current_user: User = Depends(get_current_user)):
    if not month:
        month = datetime.now(timezone.utc).strftime("%Y-%m")

    pipeline = [
        {"$match": {"user_id": current_user.user_id, "month": month}},
        {"$group": {"_id": "$type", "total": {"$sum": "$amount"}}},
    ]
    agg = await db.transactions.aggregate(pipeline).to_list(10)
    income = next((x["total"] for x in agg if x["_id"] == "income"), 0.0)
    expense = next((x["total"] for x in agg if x["_id"] == "expense"), 0.0)

    # by category (expenses only)
    pipeline2 = [
        {"$match": {"user_id": current_user.user_id, "month": month, "type": "expense"}},
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}}},
        {"$sort": {"total": -1}},
    ]
    by_cat = await db.transactions.aggregate(pipeline2).to_list(50)
    by_category = [{"category": x["_id"] or "Otros", "total": x["total"]} for x in by_cat]

    # last 6 months series
    months: list[str] = []
    year, mo = int(month[:4]), int(month[5:7])
    for _ in range(6):
        months.append(f"{year:04d}-{mo:02d}")
        mo -= 1
        if mo == 0:
            mo = 12
            year -= 1
    months = list(reversed(months))

    pipeline3 = [
        {"$match": {"user_id": current_user.user_id, "month": {"$in": months}}},
        {"$group": {"_id": {"m": "$month", "t": "$type"}, "total": {"$sum": "$amount"}}},
    ]
    series_raw = await db.transactions.aggregate(pipeline3).to_list(200)
    series = []
    for m in months:
        inc = next((x["total"] for x in series_raw if x["_id"]["m"] == m and x["_id"]["t"] == "income"), 0.0)
        exp = next((x["total"] for x in series_raw if x["_id"]["m"] == m and x["_id"]["t"] == "expense"), 0.0)
        series.append({"month": m, "income": inc, "expense": exp})

    recent = await db.transactions.find(
        {"user_id": current_user.user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)

    return {
        "month": month,
        "income": income,
        "expense": expense,
        "balance": income - expense,
        "by_category": by_category,
        "series": series,
        "recent": recent,
    }

# -----------------------------------------------------------------------------
# Budgets
# -----------------------------------------------------------------------------
async def compute_budget_spent(user_id: str, category: str, month: str) -> float:
    pipeline = [
        {"$match": {"user_id": user_id, "category": category, "month": month, "type": "expense"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    r = await db.transactions.aggregate(pipeline).to_list(1)
    return r[0]["total"] if r else 0.0

@api.get("/budgets")
async def list_budgets(month: Optional[str] = None, current_user: User = Depends(get_current_user)):
    if not month:
        month = datetime.now(timezone.utc).strftime("%Y-%m")
    rows = await db.budgets.find({"user_id": current_user.user_id, "month": month}, {"_id": 0}).to_list(200)
    for b in rows:
        b["spent"] = await compute_budget_spent(current_user.user_id, b["category"], b["month"])
    return rows

@api.post("/budgets")
async def create_budget(payload: BudgetIn, current_user: User = Depends(get_current_user)):
    if payload.category not in CATEGORIES:
        payload.category = "Otros"
    # If budget for same category+month exists, update it instead
    existing = await db.budgets.find_one({
        "user_id": current_user.user_id,
        "category": payload.category,
        "month": payload.month,
    }, {"_id": 0})
    if existing:
        await db.budgets.update_one(
            {"id": existing["id"]},
            {"$set": {"limit": payload.limit}},
        )
        existing["limit"] = payload.limit
        existing["spent"] = await compute_budget_spent(current_user.user_id, payload.category, payload.month)
        return existing
    doc = {
        "id": f"bdg_{uuid.uuid4().hex[:12]}",
        "user_id": current_user.user_id,
        "created_at": datetime.now(timezone.utc),
        **payload.model_dump(),
    }
    await db.budgets.insert_one(doc.copy())
    doc.pop("_id", None)
    doc["spent"] = 0.0
    return doc

@api.delete("/budgets/{bid}")
async def delete_budget(bid: str, current_user: User = Depends(get_current_user)):
    res = await db.budgets.delete_one({"id": bid, "user_id": current_user.user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No encontrado")
    return {"ok": True}

# -----------------------------------------------------------------------------
# Goals
# -----------------------------------------------------------------------------
@api.get("/goals")
async def list_goals(current_user: User = Depends(get_current_user)):
    rows = await db.goals.find({"user_id": current_user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return rows

@api.post("/goals")
async def create_goal(payload: GoalIn, current_user: User = Depends(get_current_user)):
    doc = {
        "id": f"goal_{uuid.uuid4().hex[:12]}",
        "user_id": current_user.user_id,
        "created_at": datetime.now(timezone.utc),
        **payload.model_dump(),
    }
    await db.goals.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc

@api.post("/goals/{gid}/contribute")
async def contribute_goal(gid: str, payload: ContributeIn, current_user: User = Depends(get_current_user)):
    res = await db.goals.update_one(
        {"id": gid, "user_id": current_user.user_id},
        {"$inc": {"saved_amount": payload.amount}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="No encontrado")
    goal = await db.goals.find_one({"id": gid}, {"_id": 0})
    return goal

@api.delete("/goals/{gid}")
async def delete_goal(gid: str, current_user: User = Depends(get_current_user)):
    res = await db.goals.delete_one({"id": gid, "user_id": current_user.user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No encontrado")
    return {"ok": True}

# -----------------------------------------------------------------------------
# AI Receipt Analysis (GPT-4o vision via Emergent LLM key)
# -----------------------------------------------------------------------------
@api.post("/analyze-receipt")
async def analyze_receipt(payload: AnalyzeReceiptIn, current_user: User = Depends(get_current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY no configurado")

    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

    system = (
        "Eres un asistente que extrae información de recibos. "
        "Devuelve SOLO un objeto JSON con estas claves exactas: "
        "title (string corto, ej. 'Supermercado'), amount (number, total del recibo), "
        f"category (uno de: {', '.join(CATEGORIES)}), "
        "type ('expense' o 'income', normalmente 'expense'), "
        "month (formato YYYY-MM). "
        "Si no puedes determinar un campo, usa valores razonables. "
        "Responde SOLO con el JSON, sin texto adicional."
    )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"receipt_{current_user.user_id}_{uuid.uuid4().hex[:8]}",
        system_message=system,
    ).with_model("openai", "gpt-4o-mini")

    msg = UserMessage(
        text="Analiza este recibo y extrae los datos en JSON.",
        file_contents=[ImageContent(image_base64=payload.image_base64)],
    )

    try:
        response = await chat.send_message(msg)
    except Exception as e:
        logger.exception("AI analysis failed")
        msg_str = str(e)
        if "Budget" in msg_str or "budget" in msg_str:
            raise HTTPException(status_code=402, detail="Saldo insuficiente en Emergent LLM Key. Recarga desde Perfil → Universal Key.")
        raise HTTPException(status_code=500, detail=f"Error de análisis IA: {e}")

    # Try to find JSON in response
    import json, re
    text = str(response).strip()
    # Strip code fences
    text = re.sub(r"^```(json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise HTTPException(status_code=500, detail="No se pudo extraer JSON del análisis")
    try:
        data = json.loads(match.group(0))
    except Exception:
        raise HTTPException(status_code=500, detail="JSON inválido del análisis")

    # Normalize
    result = {
        "title": str(data.get("title") or "Recibo"),
        "amount": float(data.get("amount") or 0),
        "category": data.get("category") if data.get("category") in CATEGORIES else "Otros",
        "type": data.get("type") if data.get("type") in ("expense", "income") else "expense",
        "month": data.get("month") or datetime.now(timezone.utc).strftime("%Y-%m"),
    }
    return result

# -----------------------------------------------------------------------------
# Mount + CORS
# -----------------------------------------------------------------------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
