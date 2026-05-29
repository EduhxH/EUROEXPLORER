const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const initDb = () => {
    db.serialize(() => {
        // Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL -- 'SUPER_ADMIN' or 'STANDARD_ADMIN'
        )`);

        // Countries content Table (JSON storage for flexibility like NoSQL)
        db.run(`CREATE TABLE IF NOT EXISTS countries (
            id TEXT PRIMARY KEY, -- ex: 'PT'
            name TEXT NOT NULL,
            content JSON NOT NULL
        )`);

        // Commits (Proposals) Table
        db.run(`CREATE TABLE IF NOT EXISTS commits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            country_id TEXT NOT NULL,
            author_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            message TEXT,
            diff JSON NOT NULL,
            rejection_note TEXT,
            FOREIGN KEY (country_id) REFERENCES countries(id),
            FOREIGN KEY (author_id) REFERENCES users(id)
        )`);

        // Seed users if empty
        db.get("SELECT count(*) as count FROM users", async (err, row) => {
            if (row.count === 0) {
                console.log("Seeding initial users...");
                const saltRounds = 10;
                const superAdmins = [
                    { u: 'EduDev', p: 'eduardo0099' },
                    { u: 'filipe', p: 'pass22314' },
                    { u: 'Valeri', p: 'pass23145' }
                ];
                const standardAdmins = [
                    { u: 'Afonso', p: 'c2GIoePJ3eyc' },
                    { u: 'André', p: 'o487FIvGdeUL' },
                    { u: 'Cauã', p: '8iP6x2P2R05A' },
                    { u: 'Claudio', p: 'bc1BKUXpIryc' },
                    { u: 'Damian', p: 'fbi5FCd3uFwm' },
                    { u: 'David', p: 'SfWYesp8SRob' },
                    { u: 'Diogo', p: '9HbFrrUj7yHy' },
                    { u: 'Henry', p: 'nY1nx96jbHtq' },
                    { u: 'Krysthyan', p: 'RkDcYK8nq8lp' },
                    { u: 'Martim fofo', p: 'vwpJq17vyGQR' },
                    { u: 'Raphel', p: 'FdMe1OJrGl1H' },
                    { u: 'Simão Baptista', p: 'QnmI758R2fuw' },
                    { u: 'Simão Babão', p: 'VC3Doa6bsn89' },
                    { u: 'Thiago', p: 'SMPwtPXUJAmN' },
                    { u: 'Tomás', p: 'b6RHQ3peHBKZ' },
                    { u: 'Vicente', p: '5TVm9KX6sj39' },
                    { u: 'Caleb', p: 't3ujqDtEPm30' }
                ];

                const stmt = db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)");
                for (let admin of superAdmins) {
                    const hash = await bcrypt.hash(admin.p, saltRounds);
                    stmt.run(admin.u, hash, 'SUPER_ADMIN');
                }
                for (let admin of standardAdmins) {
                    const hash = await bcrypt.hash(admin.p, saltRounds);
                    stmt.run(admin.u, hash, 'STANDARD_ADMIN');
                }
                stmt.finalize();
                console.log("Users seeded.");
            }
        });
    });
};

initDb();

module.exports = db;
