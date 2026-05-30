const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

function configuredSeedUsers() {
    const users = JSON.parse(process.env.SEED_USERS_JSON || '[]');
    if (process.env.SEED_SUPER_ADMIN_USERNAME && process.env.SEED_SUPER_ADMIN_PASSWORD) {
        users.push({
            username: process.env.SEED_SUPER_ADMIN_USERNAME,
            password: process.env.SEED_SUPER_ADMIN_PASSWORD,
            role: 'SUPER_ADMIN',
        });
    }
    return users;
}

const initDb = () => {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS countries (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            content JSON NOT NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS commits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            country_id TEXT NOT NULL,
            author_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDING',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            message TEXT,
            diff JSON NOT NULL,
            rejection_note TEXT,
            FOREIGN KEY (country_id) REFERENCES countries(id),
            FOREIGN KEY (author_id) REFERENCES users(id)
        )`);

        db.get('SELECT count(*) as count FROM users', async (err, row) => {
            if (err || row.count !== 0) return;

            const seedUsers = configuredSeedUsers();
            if (!seedUsers.length) {
                console.log('No seed users configured; skipping initial user creation.');
                return;
            }

            console.log('Seeding configured users...');
            const stmt = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)');
            for (const admin of seedUsers) {
                const role = admin.role || 'STANDARD_ADMIN';
                if (!['SUPER_ADMIN', 'STANDARD_ADMIN'].includes(role)) {
                    throw new Error('Seed user role must be SUPER_ADMIN or STANDARD_ADMIN.');
                }
                if (!admin.password || admin.password.length < 10) {
                    throw new Error('Seed user password must be at least 10 characters.');
                }
                const hash = await bcrypt.hash(admin.password, 12);
                stmt.run(admin.username, hash, role);
            }
            stmt.finalize();
        });
    });
};

initDb();

module.exports = db;
