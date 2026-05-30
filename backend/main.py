from collections import defaultdict, deque
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
import datetime
import json
import os
import re
import secrets
import uuid

from fastapi import Cookie, Depends, FastAPI, File, Header, HTTPException, Request, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import jwt
import bcrypt
from bson.objectid import ObjectId

from mongo_db import init_mongo, users_collection, countries_collection, commits_collection, reminders_collection

app = FastAPI(title="Europa Explorer CMS API - MongoDB")

@app.on_event("startup")
def startup():
    init_mongo()

APP_ENV = os.getenv("APP_ENV", "development").lower()
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_ROOT = (BASE_DIR / "uploads").resolve()
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", ",".join(DEFAULT_ALLOWED_ORIGINS)).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def enforce_trusted_origin(request: Request, call_next):
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        origin = request.headers.get("origin")
        if origin and origin not in ALLOWED_ORIGINS:
            return JSONResponse({"detail": "Origin not allowed"}, status_code=403)
    return await call_next(request)

SECRET_KEY = os.getenv("JWT_SECRET_KEY") or os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if APP_ENV in {"prod", "production"}:
        raise RuntimeError("JWT_SECRET_KEY must be configured in production.")
    SECRET_KEY = secrets.token_urlsafe(64)

ALGORITHM = "HS256"
SESSION_SECONDS = int(os.getenv("SESSION_SECONDS", str(8 * 60 * 60)))
AUTH_COOKIE_NAME = os.getenv("AUTH_COOKIE_NAME", "europa_session")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "true" if APP_ENV in {"prod", "production"} else "false").lower() == "true"
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax").lower()
LOGIN_WINDOW_SECONDS = int(os.getenv("LOGIN_WINDOW_SECONDS", "900"))
LOGIN_MAX_ATTEMPTS = int(os.getenv("LOGIN_MAX_ATTEMPTS", "5"))
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(5 * 1024 * 1024)))

_login_attempts = defaultdict(deque)

class LoginRequest(BaseModel):
    username: str
    password: str

class CommitProposal(BaseModel):
    country_id: str
    message: str
    diff: Dict[str, Any]

class RejectRequest(BaseModel):
    note: str

class ProfileUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None

class ReminderCreate(BaseModel):
    title: str
    due_at: Optional[datetime.datetime] = None
    urgency: Optional[str] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None

class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    due_at: Optional[datetime.datetime] = None
    urgency: Optional[str] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None
    completed: Optional[bool] = None

class AdminUserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    cargo: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None

ONLINE_WINDOW_SECONDS = 45
SAFE_HTML_TAGS = {
    "b", "strong", "i", "em", "u", "s", "br", "p", "div", "span",
    "ul", "ol", "li", "blockquote", "h1", "h2", "h3", "h4", "small",
    "sub", "sup", "a"
}
SAFE_HTML_ATTRS = {
    "a": {"href", "title", "target", "rel"},
}
BLOCKED_HTML_TAGS = {"script", "style", "iframe", "object", "embed", "svg", "math", "link", "meta"}
ALLOWED_IMAGE_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
ALLOWED_IMAGE_EXTENSIONS = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
}
ALLOWED_CSS_PROPERTIES = {
    "background-color",
    "color",
    "font-size",
    "font-style",
    "font-weight",
    "letter-spacing",
    "line-height",
    "text-align",
    "text-decoration",
    "text-shadow",
    "text-transform",
}


class SafeHtmlParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.blocked_depth = 0

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in BLOCKED_HTML_TAGS:
            self.blocked_depth += 1
            return
        if self.blocked_depth or tag not in SAFE_HTML_TAGS:
            return

        safe_attrs = []
        allowed_attrs = SAFE_HTML_ATTRS.get(tag, set())
        for name, value in attrs:
            name = name.lower()
            if name.startswith("on") or name not in allowed_attrs:
                continue
            value = (value or "").strip()
            if name == "href" and not is_safe_url(value, allow_upload_only=False):
                continue
            if name == "target" and value not in {"_blank", "_self"}:
                continue
            if name == "rel":
                value = "noopener noreferrer"
            safe_attrs.append(f'{name}="{escape(value, quote=True)}"')

        attr_text = f" {' '.join(safe_attrs)}" if safe_attrs else ""
        if tag == "br":
            self.parts.append("<br>")
        else:
            self.parts.append(f"<{tag}{attr_text}>")

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in BLOCKED_HTML_TAGS and self.blocked_depth:
            self.blocked_depth -= 1
            return
        if not self.blocked_depth and tag in SAFE_HTML_TAGS and tag != "br":
            self.parts.append(f"</{tag}>")

    def handle_data(self, data):
        if not self.blocked_depth:
            self.parts.append(escape(data, quote=False))

    def handle_entityref(self, name):
        if not self.blocked_depth:
            self.parts.append(f"&{name};")

    def handle_charref(self, name):
        if not self.blocked_depth:
            self.parts.append(f"&#{name};")

    def get_html(self):
        return "".join(self.parts)


def sanitize_html_fragment(value: str, max_length: int = 20000) -> str:
    value = strip_control_chars(value)[:max_length]
    parser = SafeHtmlParser()
    parser.feed(value)
    parser.close()
    return parser.get_html()


def strip_control_chars(value: str) -> str:
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", value or "")


def sanitize_plain_text(value: str, max_length: int = 500) -> str:
    value = strip_control_chars(value).strip()[:max_length]
    if "<" in value or ">" in value:
        raise HTTPException(status_code=400, detail="Invalid text content")
    return value


def sanitize_country_id(value: str) -> str:
    value = sanitize_plain_text(value, max_length=32)
    if not re.fullmatch(r"[A-Za-z0-9_-]+", value):
        raise HTTPException(status_code=400, detail="Invalid country id")
    return value


def is_safe_url(value: str, allow_upload_only: bool = True) -> bool:
    if not value:
        return False
    parsed = urlparse(value)
    if parsed.scheme in {"javascript", "data", "vbscript", "file"}:
        return False
    if allow_upload_only:
        if parsed.scheme in {"http", "https"}:
            return parsed.path.startswith("/uploads/")
        return value.startswith("/uploads/")
    return parsed.scheme in {"", "http", "https"} and not value.startswith("//")


def sanitize_style(value: str) -> str:
    safe_parts = []
    for raw_rule in strip_control_chars(value)[:2000].split(";"):
        if ":" not in raw_rule:
            continue
        prop, raw_value = raw_rule.split(":", 1)
        prop = prop.strip().lower()
        css_value = raw_value.strip()
        lowered = css_value.lower()
        if prop not in ALLOWED_CSS_PROPERTIES:
            continue
        if any(blocked in lowered for blocked in ("url(", "expression", "javascript:", "@import", "<", ">")):
            continue
        if not re.fullmatch(r"[#(),.%\w\s+-]+", css_value):
            continue
        safe_parts.append(f"{prop}: {css_value}")
    return "; ".join(safe_parts)


def sanitize_document(value: Any, field_name: str = "root", depth: int = 0) -> Any:
    if depth > 12:
        raise HTTPException(status_code=400, detail="Payload too deeply nested")
    if isinstance(value, dict):
        if len(value) > 200:
            raise HTTPException(status_code=400, detail="Payload has too many fields")
        sanitized = {}
        for key, item in value.items():
            if not isinstance(key, str) or key.startswith("$") or "." in key:
                raise HTTPException(status_code=400, detail="Invalid payload field")
            sanitized[key] = sanitize_document(item, key, depth + 1)
        return sanitized
    if isinstance(value, list):
        if len(value) > 500:
            raise HTTPException(status_code=400, detail="Payload list is too large")
        return [sanitize_document(item, field_name, depth + 1) for item in value]
    if isinstance(value, str):
        normalized_field = field_name.lower()
        if normalized_field in {"url", "src", "avatar"}:
            if not is_safe_url(value):
                raise HTTPException(status_code=400, detail="Invalid URL")
            return value
        if normalized_field == "style":
            return sanitize_style(value)
        return sanitize_html_fragment(value)
    if isinstance(value, (int, float, bool)) or value is None:
        return value
    raise HTTPException(status_code=400, detail="Unsupported payload value")


def parse_object_id(value: str, label: str = "id") -> ObjectId:
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid {label}")


def prune_login_attempts(key: str):
    now = datetime.datetime.utcnow()
    attempts = _login_attempts[key]
    while attempts and (now - attempts[0]).total_seconds() > LOGIN_WINDOW_SECONDS:
        attempts.popleft()
    return attempts


def login_rate_limited(request: Request, username: str) -> bool:
    client_host = request.client.host if request.client else "unknown"
    key = f"{client_host}:{username.lower()}"
    return len(prune_login_attempts(key)) >= LOGIN_MAX_ATTEMPTS


def record_failed_login(request: Request, username: str):
    client_host = request.client.host if request.client else "unknown"
    key = f"{client_host}:{username.lower()}"
    prune_login_attempts(key).append(datetime.datetime.utcnow())


def clear_failed_logins(request: Request, username: str):
    client_host = request.client.host if request.client else "unknown"
    _login_attempts.pop(f"{client_host}:{username.lower()}", None)


def create_access_token(user_doc: dict) -> str:
    now = datetime.datetime.utcnow()
    payload = {
        "sub": str(user_doc["_id"]),
        "username": user_doc.get("username"),
        "role": user_doc.get("role"),
        "iat": now,
        "exp": now + datetime.timedelta(seconds=SESSION_SECONDS),
        "jti": secrets.token_urlsafe(24),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        AUTH_COOKIE_NAME,
        token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=SESSION_SECONDS,
        path="/",
    )


def clear_auth_cookie(response: Response):
    response.delete_cookie(AUTH_COOKIE_NAME, path="/")


def normalize_declared_mime(value: Optional[str]) -> str:
    mime = (value or "").split(";", 1)[0].strip().lower()
    return "image/jpeg" if mime == "image/jpg" else mime


def detect_image_mime(data: bytes) -> Optional[str]:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"GIF87a") or data.startswith(b"GIF89a"):
        return "image/gif"
    if len(data) >= 12 and data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp"
    return None


async def save_image_upload(file: UploadFile, subdir: str = "") -> str:
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File is too large")

    detected_mime = detect_image_mime(raw)
    declared_mime = normalize_declared_mime(file.content_type)
    extension = Path(file.filename or "").suffix.lower()

    if not detected_mime or declared_mime != detected_mime:
        raise HTTPException(status_code=400, detail="Only valid image uploads are allowed")
    if extension not in ALLOWED_IMAGE_EXTENSIONS or ALLOWED_IMAGE_EXTENSIONS[extension] != detected_mime:
        raise HTTPException(status_code=400, detail="Invalid image extension")

    directory = (UPLOAD_ROOT / subdir).resolve()
    if UPLOAD_ROOT not in directory.parents and directory != UPLOAD_ROOT:
        raise HTTPException(status_code=400, detail="Invalid upload path")
    directory.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{ALLOWED_IMAGE_MIME_TYPES[detected_mime]}"
    target = directory / filename
    with target.open("xb") as file_object:
        file_object.write(raw)

    relative_path = target.relative_to(UPLOAD_ROOT).as_posix()
    return f"/uploads/{relative_path}"

def serialize_datetime(value):
    if isinstance(value, datetime.datetime):
        return value.isoformat()
    return value

def get_user_doc(user_id: str):
    try:
        return users_collection.find_one({"_id": ObjectId(user_id)})
    except Exception:
        return None

def public_user(user_doc: dict):
    now = datetime.datetime.utcnow()
    last_seen = user_doc.get("last_seen")
    online = isinstance(last_seen, datetime.datetime) and (now - last_seen).total_seconds() <= ONLINE_WINDOW_SECONDS
    latest_commit = commits_collection.find_one(
        {"$or": [{"author_id": str(user_doc["_id"])}, {"author_name": user_doc.get("username")}]},
        sort=[("created_at", -1)]
    )

    return {
        "id": str(user_doc["_id"]),
        "username": user_doc.get("username"),
        "name": user_doc.get("username"),
        "email": user_doc.get("email"),
        "cargo": user_doc.get("cargo"),
        "role": user_doc.get("role"),
        "avatar": user_doc.get("avatar"),
        "last_seen": serialize_datetime(last_seen),
        "last_activity": serialize_datetime(latest_commit.get("created_at")) if latest_commit else None,
        "online": online,
        "commit_count": commits_collection.count_documents({
            "$or": [{"author_id": str(user_doc["_id"])}, {"author_name": user_doc.get("username")}]
        }),
    }

def serialize_commit(commit: dict):
    return {
        **commit,
        "_id": str(commit["_id"]),
        "created_at": serialize_datetime(commit.get("created_at")),
    }

def serialize_reminder(reminder: dict):
    return {
        **reminder,
        "_id": str(reminder["_id"]),
        "created_at": serialize_datetime(reminder.get("created_at")),
        "updated_at": serialize_datetime(reminder.get("updated_at")),
        "due_at": serialize_datetime(reminder.get("due_at")),
        "completed_at": serialize_datetime(reminder.get("completed_at")),
    }

def time_tracker_response(user_doc: dict):
    tracker = user_doc.get("time_tracker") or {}
    state = tracker.get("state", "stopped")
    elapsed_ms = int(tracker.get("elapsed_ms", 0) or 0)
    started_at = tracker.get("started_at")

    if state == "running" and isinstance(started_at, datetime.datetime):
        elapsed_ms = max(0, elapsed_ms + int((datetime.datetime.utcnow() - started_at).total_seconds() * 1000))

    return {
        "state": state,
        "elapsed_ms": elapsed_ms,
        "started_at": serialize_datetime(started_at),
        "updated_at": serialize_datetime(tracker.get("updated_at")),
    }

def permissions_for_role(role: str):
    if role == "SUPER_ADMIN":
        return ["review_commits", "manage_reminders", "view_users", "edit_own_profile"]
    return ["submit_commits", "edit_own_profile"]

def get_current_user(
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(default=None, alias=AUTH_COOKIE_NAME),
):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
    elif session_token:
        token = session_token

    if not token:
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_doc = get_user_doc(payload.get("sub"))
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid token")

    return {
        "sub": str(user_doc["_id"]),
        "username": user_doc.get("username"),
        "role": user_doc.get("role"),
        "jti": payload.get("jti"),
    }

def require_super_admin(user: dict = Depends(get_current_user)):
    if user.get("role") != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Super Admin required")
    return user

@app.post("/api/auth/login")
def login(req: LoginRequest, response: Response, request: Request):
    username = sanitize_plain_text(req.username, max_length=80)
    if login_rate_limited(request, username):
        raise HTTPException(status_code=429, detail="Too many login attempts")

    user = users_collection.find_one({"username": username})
    password_hash = (user or {}).get("password")
    valid_password = bool(
        password_hash and bcrypt.checkpw(req.password.encode("utf-8"), password_hash.encode("utf-8"))
    )

    if not user or not valid_password:
        record_failed_login(request, username)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    clear_failed_logins(request, username)
    token = create_access_token(user)
    set_auth_cookie(response, token)
    users_collection.update_one({"_id": user["_id"]}, {"$set": {"last_seen": datetime.datetime.utcnow()}})

    refreshed_user = users_collection.find_one({"_id": user["_id"]})
    return {"user": public_user(refreshed_user)}

@app.post("/api/auth/logout")
def logout(response: Response):
    clear_auth_cookie(response)
    return {"logged_out": True}

@app.post("/api/admin/heartbeat")
def heartbeat(user: dict = Depends(get_current_user)):
    user_doc = get_user_doc(user["sub"])
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.datetime.utcnow()
    users_collection.update_one({"_id": user_doc["_id"]}, {"$set": {"last_seen": now}})
    return {"last_seen": serialize_datetime(now)}

@app.get("/api/admin/me")
def get_me(user: dict = Depends(get_current_user)):
    user_doc = get_user_doc(user["sub"])
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    return public_user(user_doc)

@app.patch("/api/admin/me")
def update_me(payload: ProfileUpdate, user: dict = Depends(get_current_user)):
    user_doc = get_user_doc(user["sub"])
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    updates = {}
    if payload.username is not None:
        username = sanitize_plain_text(payload.username, max_length=80)
        if not username:
            raise HTTPException(status_code=400, detail="Username cannot be empty")
        existing = users_collection.find_one({"username": username, "_id": {"$ne": user_doc["_id"]}})
        if existing:
            raise HTTPException(status_code=409, detail="Username already exists")
        updates["username"] = username

    if payload.email is not None:
        updates["email"] = sanitize_plain_text(payload.email, max_length=120) or None

    if payload.password:
        if len(payload.password) < 10:
            raise HTTPException(status_code=400, detail="Password must be at least 10 characters")
        updates["password"] = bcrypt.hashpw(payload.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    if updates:
        updates["updated_at"] = datetime.datetime.utcnow()
        users_collection.update_one({"_id": user_doc["_id"]}, {"$set": updates})

    return public_user(users_collection.find_one({"_id": user_doc["_id"]}))

@app.post("/api/admin/me/avatar")
async def update_avatar(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    user_doc = get_user_doc(user["sub"])
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    avatar_url = await save_image_upload(file, "profiles")
    users_collection.update_one(
        {"_id": user_doc["_id"]},
        {"$set": {"avatar": avatar_url, "updated_at": datetime.datetime.utcnow()}}
    )
    return public_user(users_collection.find_one({"_id": user_doc["_id"]}))

@app.get("/api/admin/users")
def list_users(user: dict = Depends(require_super_admin)):
    users = list(users_collection.find().sort("username", 1))
    return [public_user(doc) for doc in users]

@app.get("/api/admin/users/{user_id}")
def user_details(user_id: str, user: dict = Depends(require_super_admin)):
    user_doc = get_user_doc(user_id)
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    commits = list(commits_collection.find({
        "$or": [{"author_id": str(user_doc["_id"])}, {"author_name": user_doc.get("username")}]
    }).sort("created_at", -1).limit(10))

    return {
        "user": public_user(user_doc),
        "recent_commits": [serialize_commit(commit) for commit in commits],
        "permissions": permissions_for_role(user_doc.get("role")),
    }

@app.patch("/api/admin/users/{user_id}")
def update_user(user_id: str, payload: AdminUserUpdate, user: dict = Depends(require_super_admin)):
    target = get_user_doc(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    updates = {}
    if payload.username is not None:
        username = sanitize_plain_text(payload.username, max_length=80)
        if not username:
            raise HTTPException(status_code=400, detail="Username cannot be empty")
        existing = users_collection.find_one({"username": username, "_id": {"$ne": target["_id"]}})
        if existing:
            raise HTTPException(status_code=409, detail="Username already exists")
        updates["username"] = username
    if payload.email is not None:
        updates["email"] = sanitize_plain_text(payload.email, max_length=120) or None
    if payload.cargo is not None:
        updates["cargo"] = sanitize_plain_text(payload.cargo, max_length=120) or None
    if payload.role is not None:
        if payload.role not in ["SUPER_ADMIN", "STANDARD_ADMIN"]:
            raise HTTPException(status_code=400, detail="Invalid role")
        updates["role"] = payload.role
    if payload.password:
        if len(payload.password) < 10:
            raise HTTPException(status_code=400, detail="Password must be at least 10 characters")
        updates["password"] = bcrypt.hashpw(payload.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    if updates:
        updates["updated_at"] = datetime.datetime.utcnow()
        users_collection.update_one({"_id": target["_id"]}, {"$set": updates})

    return public_user(users_collection.find_one({"_id": target["_id"]}))

@app.get("/api/countries")
def get_countries():
    countries = list(countries_collection.find({}, {"content": 0}))
    for c in countries: c["_id"] = str(c["_id"])
    return countries

@app.get("/api/countries/{country_id}")
def get_country(country_id: str):
    country_id = sanitize_country_id(country_id)
    country = countries_collection.find_one({"id": country_id})
    if not country:
        raise HTTPException(status_code=404, detail="Country not found")
    country["_id"] = str(country["_id"])
    country["content"] = sanitize_document(country.get("content") or {}, "content")
    return country

@app.post("/api/commits")
def create_commit(proposal: CommitProposal, user: dict = Depends(get_current_user)):
    user_doc = get_user_doc(user["sub"])
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    country_id = sanitize_country_id(proposal.country_id)
    message = sanitize_plain_text(proposal.message, max_length=300)
    diff = sanitize_document(proposal.diff, "diff")

    if user_doc.get("role") == "STANDARD_ADMIN":
        restricted_stats = {"capital", "population", "area", "currency", "language", "eu_since"}
        submitted_stats = set((diff.get("stats") or {}).keys())
        top_level_stats = restricted_stats.intersection(diff.keys())
        if submitted_stats or top_level_stats:
            raise HTTPException(
                status_code=403,
                detail="Apenas SUPER ADMINS podem editar estes dados."
            )

    if not countries_collection.find_one({"id": country_id}):
        countries_collection.insert_one({
            "id": country_id,
            "content": {},
            "created_at": datetime.datetime.utcnow()
        })

    commit_doc = {
        "country_id": country_id,
        "author_id": str(user_doc["_id"]),
        "author_name": user_doc["username"],
        "author_role": user_doc.get("role"),
        "status": "PENDING",
        "created_at": datetime.datetime.utcnow(),
        "message": message,
        "diff": diff,
        "rejection_note": None
    }
    commits_collection.insert_one(commit_doc)
    return {"message": "Proposal submitted successfully"}

@app.put("/api/countries/{country_id}/content")
def publish_country_content(country_id: str, payload: Dict[str, Any], user: dict = Depends(require_super_admin)):
    country_id = sanitize_country_id(country_id)
    payload = sanitize_document(payload, "content")
    now = datetime.datetime.utcnow()
    countries_collection.update_one(
        {"id": country_id},
        {
            "$set": {
                "content": payload,
                "updated_at": now,
                "updated_by": user.get("username")
            },
            "$setOnInsert": {"id": country_id, "created_at": now}
        },
        upsert=True
    )
    return {"message": "Country content published successfully", "updated_at": serialize_datetime(now)}

@app.get("/api/commits")
def list_commits(user: dict = Depends(require_super_admin)):
    commits = list(commits_collection.find().sort("created_at", -1))
    return [serialize_commit(commit) for commit in commits]

@app.get("/api/commits/me")
def list_my_commits(user: dict = Depends(get_current_user)):
    commits = list(commits_collection.find({"author_id": user['sub']}).sort("created_at", -1))
    return [serialize_commit(commit) for commit in commits]

@app.post("/api/commits/{commit_id}/approve")
def approve_commit(commit_id: str, user: dict = Depends(require_super_admin)):
    object_id = parse_object_id(commit_id, "commit id")
    commit = commits_collection.find_one({"_id": object_id})
    if not commit: raise HTTPException(status_code=404, detail="Commit not found")
    if commit['status'] != 'PENDING': raise HTTPException(status_code=400, detail="Commit already processed")

    country = countries_collection.find_one({"id": commit['country_id']}) or {}
    current_content = country.get("content") or {}
    next_content = sanitize_document(commit['diff'], "diff")
    if commit.get("author_role") == "STANDARD_ADMIN":
        allowed_diff = {key: value for key, value in next_content.items() if key != "stats"}
        next_content = {**current_content, **allowed_diff, "stats": current_content.get("stats", {})}

    countries_collection.update_one(
        {"id": commit['country_id']},
        {"$set": {"content": next_content}}
    )
    commits_collection.update_one({"_id": object_id}, {"$set": {"status": "APPROVED"}})
    return {"message": "Approved and applied"}

@app.post("/api/commits/{commit_id}/reject")
def reject_commit(commit_id: str, req: RejectRequest, user: dict = Depends(require_super_admin)):
    object_id = parse_object_id(commit_id, "commit id")
    note = sanitize_plain_text(req.note, max_length=500)
    result = commits_collection.update_one(
        {"_id": object_id},
        {"$set": {"status": "REJECTED", "rejection_note": note}}
    )
    if result.matched_count == 0: raise HTTPException(status_code=404, detail="Commit not found")
    return {"message": "Rejected"}

@app.get("/api/admin/analytics")
def analytics(user: dict = Depends(require_super_admin)):
    commits = list(commits_collection.find().sort("created_at", -1))
    by_user = {}
    by_day = {}
    by_week = {}
    by_month = {}
    by_status = {"PENDING": 0, "APPROVED": 0, "REJECTED": 0}

    for commit in commits:
        author = commit.get("author_name")
        created_at = commit.get("created_at")
        status_value = commit.get("status")

        if author:
            by_user[author] = by_user.get(author, 0) + 1
        if status_value in by_status:
            by_status[status_value] += 1
        if isinstance(created_at, datetime.datetime):
            by_day[created_at.date().isoformat()] = by_day.get(created_at.date().isoformat(), 0) + 1
            iso_year, iso_week, _ = created_at.isocalendar()
            week_key = f"{iso_year}-W{str(iso_week).zfill(2)}"
            by_week[week_key] = by_week.get(week_key, 0) + 1
            month_key = f"{created_at.year}-{str(created_at.month).zfill(2)}"
            by_month[month_key] = by_month.get(month_key, 0) + 1

    processed = by_status["APPROVED"] + by_status["REJECTED"]
    return {
        "total": len(commits),
        "by_user": by_user,
        "by_day": by_day,
        "by_week": by_week,
        "by_month": by_month,
        "by_status": by_status,
        "approval_rate": (by_status["APPROVED"] / processed) if processed else None,
        "rejection_rate": (by_status["REJECTED"] / processed) if processed else None,
    }

@app.get("/api/time-tracker")
def get_time_tracker(user: dict = Depends(get_current_user)):
    user_doc = get_user_doc(user["sub"])
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    return time_tracker_response(user_doc)

@app.post("/api/time-tracker/start")
def start_time_tracker(user: dict = Depends(get_current_user)):
    user_doc = get_user_doc(user["sub"])
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.datetime.utcnow()
    tracker = {
        "state": "running",
        "elapsed_ms": 0,
        "started_at": now,
        "updated_at": now,
    }
    users_collection.update_one({"_id": user_doc["_id"]}, {"$set": {"time_tracker": tracker, "last_seen": now}})
    return time_tracker_response(users_collection.find_one({"_id": user_doc["_id"]}))

@app.post("/api/time-tracker/resume")
def resume_time_tracker(user: dict = Depends(get_current_user)):
    user_doc = get_user_doc(user["sub"])
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    current = time_tracker_response(user_doc)
    now = datetime.datetime.utcnow()
    tracker = {
        "state": "running",
        "elapsed_ms": current["elapsed_ms"],
        "started_at": now,
        "updated_at": now,
    }
    users_collection.update_one({"_id": user_doc["_id"]}, {"$set": {"time_tracker": tracker, "last_seen": now}})
    return time_tracker_response(users_collection.find_one({"_id": user_doc["_id"]}))

@app.post("/api/time-tracker/pause")
def pause_time_tracker(user: dict = Depends(get_current_user)):
    user_doc = get_user_doc(user["sub"])
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    current = time_tracker_response(user_doc)
    now = datetime.datetime.utcnow()
    tracker = {
        "state": "paused",
        "elapsed_ms": current["elapsed_ms"],
        "started_at": None,
        "updated_at": now,
    }
    users_collection.update_one({"_id": user_doc["_id"]}, {"$set": {"time_tracker": tracker, "last_seen": now}})
    return time_tracker_response(users_collection.find_one({"_id": user_doc["_id"]}))

@app.post("/api/time-tracker/stop")
def stop_time_tracker(user: dict = Depends(get_current_user)):
    user_doc = get_user_doc(user["sub"])
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    current = time_tracker_response(user_doc)
    now = datetime.datetime.utcnow()
    tracker = {
        "state": "stopped",
        "elapsed_ms": current["elapsed_ms"],
        "started_at": None,
        "updated_at": now,
    }
    users_collection.update_one({"_id": user_doc["_id"]}, {"$set": {"time_tracker": tracker, "last_seen": now}})
    return time_tracker_response(users_collection.find_one({"_id": user_doc["_id"]}))

@app.get("/api/reminders")
def list_reminders(user: dict = Depends(require_super_admin)):
    reminders = list(reminders_collection.find().sort([("completed", 1), ("due_at", 1), ("created_at", -1)]))
    return [serialize_reminder(reminder) for reminder in reminders]

@app.post("/api/reminders")
def create_reminder(payload: ReminderCreate, user: dict = Depends(require_super_admin)):
    title = sanitize_plain_text(payload.title, max_length=160)
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")

    now = datetime.datetime.utcnow()
    reminder = {
        "title": title,
        "notes": sanitize_plain_text(payload.notes, max_length=1000) if payload.notes else None,
        "urgency": sanitize_plain_text(payload.urgency, max_length=20) if payload.urgency else None,
        "due_at": payload.due_at,
        "assigned_to": sanitize_plain_text(payload.assigned_to, max_length=80) if payload.assigned_to else None,
        "created_by": user["sub"],
        "created_by_name": user.get("username"),
        "completed": False,
        "completed_at": None,
        "created_at": now,
        "updated_at": now,
    }
    result = reminders_collection.insert_one(reminder)
    return serialize_reminder(reminders_collection.find_one({"_id": result.inserted_id}))

@app.patch("/api/reminders/{reminder_id}")
def update_reminder(reminder_id: str, payload: ReminderUpdate, user: dict = Depends(require_super_admin)):
    try:
        object_id = ObjectId(reminder_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid reminder id")

    update_fields = payload.dict(exclude_unset=True)
    if "title" in update_fields:
        update_fields["title"] = sanitize_plain_text(update_fields["title"] or "", max_length=160)
        if not update_fields["title"]:
            raise HTTPException(status_code=400, detail="Title cannot be empty")
    if "notes" in update_fields and update_fields["notes"] is not None:
        update_fields["notes"] = sanitize_plain_text(update_fields["notes"], max_length=1000)
    if "urgency" in update_fields and update_fields["urgency"] is not None:
        update_fields["urgency"] = sanitize_plain_text(update_fields["urgency"], max_length=20)
    if "assigned_to" in update_fields and update_fields["assigned_to"] is not None:
        update_fields["assigned_to"] = sanitize_plain_text(update_fields["assigned_to"], max_length=80)
    if "completed" in update_fields:
        update_fields["completed_at"] = datetime.datetime.utcnow() if update_fields["completed"] else None
    update_fields["updated_at"] = datetime.datetime.utcnow()

    result = reminders_collection.update_one({"_id": object_id}, {"$set": update_fields})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return serialize_reminder(reminders_collection.find_one({"_id": object_id}))

@app.delete("/api/reminders/{reminder_id}")
def delete_reminder(reminder_id: str, user: dict = Depends(require_super_admin)):
    try:
        object_id = ObjectId(reminder_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid reminder id")

    result = reminders_collection.delete_one({"_id": object_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return {"deleted": True}

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    return {"url": await save_image_upload(file)}

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_ROOT)), name="uploads")
