from pathlib import Path
from urllib.parse import quote_plus

from pymongo import ASCENDING, DESCENDING, MongoClient
import bcrypt
import json
import os

DEFAULT_MONGO_DB_NAME = "europa_explorer"


def _load_env_file():
    env_paths = [
        Path(__file__).with_name(".env"),
        Path(__file__).resolve().parent.parent / ".env",
    ]

    for env_path in env_paths:
        if not env_path.exists():
            continue

        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue

            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key:
                os.environ.setdefault(key, value)


def _build_mongo_uri():
    configured_uri = os.getenv("MONGO_URI")
    if configured_uri:
        return configured_uri

    app_env = os.getenv("APP_ENV", "development").lower()
    username = os.getenv("MONGO_USERNAME")
    password = os.getenv("MONGO_PASSWORD")
    cluster = os.getenv("MONGO_CLUSTER")
    app_name = os.getenv("MONGO_APP_NAME", "EuropaExplorer")

    if not all([username, password, cluster]):
        if app_env in {"prod", "production"}:
            raise RuntimeError("MONGO_URI or MONGO_USERNAME/MONGO_PASSWORD/MONGO_CLUSTER must be configured.")
        return "mongodb://localhost:27017"

    return (
        f"mongodb+srv://{quote_plus(username)}:{quote_plus(password)}@"
        f"{cluster}/?appName={quote_plus(app_name)}"
    )


_load_env_file()

MONGO_URI = _build_mongo_uri()
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", DEFAULT_MONGO_DB_NAME)
MONGO_TIMEOUT_MS = int(os.getenv("MONGO_TIMEOUT_MS", "10000"))

client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=MONGO_TIMEOUT_MS)
db = client[MONGO_DB_NAME]

users_collection = db['users']
countries_collection = db['countries']
commits_collection = db['commits']
reminders_collection = db['reminders']
password_resets_collection = db['password_resets']

def _configured_seed_users():
    raw_users = os.getenv("SEED_USERS_JSON")
    if raw_users:
        users = json.loads(raw_users)
        if not isinstance(users, list):
            raise RuntimeError("SEED_USERS_JSON must be a JSON array.")
        return users

    username = os.getenv("SEED_SUPER_ADMIN_USERNAME")
    password = os.getenv("SEED_SUPER_ADMIN_PASSWORD")
    if username and password:
        return [{"username": username, "password": password, "role": "SUPER_ADMIN"}]

    return []

def init_mongo():
    client.admin.command("ping")
    users_collection.create_index("username", unique=True)
    countries_collection.create_index("id", unique=True)
    commits_collection.create_index([("created_at", DESCENDING)])
    commits_collection.create_index([("author_id", ASCENDING), ("created_at", DESCENDING)])
    reminders_collection.create_index([("created_by", ASCENDING), ("due_at", ASCENDING)])
    reminders_collection.create_index([("assigned_to", ASCENDING), ("completed", ASCENDING)])
    password_resets_collection.create_index([("username", ASCENDING), ("created_at", DESCENDING)])
    password_resets_collection.create_index([("status", ASCENDING), ("created_at", DESCENDING)])
    password_resets_collection.create_index("expires_at", expireAfterSeconds=0)
    users_collection.create_index([("last_seen", DESCENDING)])

    if users_collection.count_documents({}) == 0:
        seed_users = _configured_seed_users()
        if not seed_users:
            print("No seed users configured; skipping initial user creation.")
            return

        print("Seeding configured users to MongoDB...")
        users_to_insert = []
        for admin in seed_users:
            username = str(admin.get("username", "")).strip()
            password = str(admin.get("password", ""))
            if not username or len(password) < 10:
                raise RuntimeError("Seed users require username and password with at least 10 characters.")
            role = admin.get('role', 'STANDARD_ADMIN')
            if role not in {"SUPER_ADMIN", "STANDARD_ADMIN"}:
                raise RuntimeError("Seed user role must be SUPER_ADMIN or STANDARD_ADMIN.")
            hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            users_to_insert.append({
                'username': username,
                'password': hashed,
                'role': role,
                'avatar': None
            })

        users_collection.insert_many(users_to_insert)
        print("Users seeded successfully.")

if __name__ == "__main__":
    init_mongo()
