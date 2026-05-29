import sqlite3
import json
import bcrypt
import os

DB_PATH = "database.sqlite"

def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Users
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL
        )
    """)
    
    # Countries
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS countries (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            content TEXT NOT NULL
        )
    """)
    
    # Commits
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
    
    # Seed Users
    cursor.execute("SELECT count(*) as count FROM users")
    row = cursor.fetchone()
    if row['count'] == 0:
        print("Seeding initial users...")
        super_admins = [
            {'u': 'EduDev', 'p': 'eduardo0099'},
            {'u': 'filipe', 'p': 'pass22314'},
            {'u': 'Valeri', 'p': 'pass23145'}
        ]
        standard_admins = [
            {'u': 'Afonso', 'p': 'c2GIoePJ3eyc'},
            {'u': 'André', 'p': 'o487FIvGdeUL'},
            {'u': 'Cauã', 'p': '8iP6x2P2R05A'},
            {'u': 'Claudio', 'p': 'bc1BKUXpIryc'},
            {'u': 'Damian', 'p': 'fbi5FCd3uFwm'},
            {'u': 'David', 'p': 'SfWYesp8SRob'},
            {'u': 'Diogo', 'p': '9HbFrrUj7yHy'},
            {'u': 'Henry', 'p': 'nY1nx96jbHtq'},
            {'u': 'Krysthyan', 'p': 'RkDcYK8nq8lp'},
            {'u': 'Martim fofo', 'p': 'vwpJq17vyGQR'},
            {'u': 'Raphel', 'p': 'FdMe1OJrGl1H'},
            {'u': 'Simão Baptista', 'p': 'QnmI758R2fuw'},
            {'u': 'Simão Babão', 'p': 'VC3Doa6bsn89'},
            {'u': 'Thiago', 'p': 'SMPwtPXUJAmN'},
            {'u': 'Tomás', 'p': 'b6RHQ3peHBKZ'},
            {'u': 'Vicente', 'p': '5TVm9KX6sj39'},
            {'u': 'Caleb', 'p': 't3ujqDtEPm30'}
        ]
        
        for admin in super_admins:
            hashed = bcrypt.hashpw(admin['p'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            cursor.execute("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", (admin['u'], hashed, 'SUPER_ADMIN'))
            
        for admin in standard_admins:
            hashed = bcrypt.hashpw(admin['p'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            cursor.execute("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", (admin['u'], hashed, 'STANDARD_ADMIN'))
            
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
