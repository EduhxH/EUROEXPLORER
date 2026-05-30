import json
import os
import sqlite3

import bcrypt

DB_PATH = "database.sqlite"


def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def configured_seed_users():
    seed_users = json.loads(os.getenv("SEED_USERS_JSON", "[]"))
    username = os.getenv("SEED_SUPER_ADMIN_USERNAME")
    password = os.getenv("SEED_SUPER_ADMIN_PASSWORD")
    if username and password:
        seed_users.append({"username": username, "password": password, "role": "SUPER_ADMIN"})
    return seed_users


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS countries (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            content TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS commits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            country_id TEXT NOT NULL,
            author_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDING',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            message TEXT,
            diff TEXT NOT NULL,
            rejection_note TEXT,
            FOREIGN KEY (country_id) REFERENCES countries(id),
            FOREIGN KEY (author_id) REFERENCES users(id)
        )
    """)

    cursor.execute("SELECT count(*) as count FROM users")
    row = cursor.fetchone()
    if row["count"] == 0:
        seed_users = configured_seed_users()
        if not seed_users:
            print("No seed users configured; skipping initial user creation.")
        else:
            print("Seeding configured users...")
            for admin in seed_users:
                role = admin.get("role", "STANDARD_ADMIN")
                password = admin.get("password", "")
                if role not in {"SUPER_ADMIN", "STANDARD_ADMIN"}:
                    raise RuntimeError("Seed user role must be SUPER_ADMIN or STANDARD_ADMIN.")
                if len(password) < 10:
                    raise RuntimeError("Seed user password must be at least 10 characters.")
                hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
                cursor.execute(
                    "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
                    (admin["username"], hashed, role),
                )

    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
