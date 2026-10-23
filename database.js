
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "hotel.db");
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Database connection failed:", err.message);
    } else {
        console.log("Connected to SQLite database.");
    }
});

// Enable foreign key constraints.
db.run("PRAGMA foreign_keys = ON");

// Create the database tables.
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_no TEXT UNIQUE NOT NULL,
            hotel TEXT NOT NULL,
            type TEXT NOT NULL,
            price REAL NOT NULL CHECK (price >= 0),
            status TEXT NOT NULL DEFAULT 'Available'
                CHECK (status IN ('Available', 'Maintenance'))
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id INTEGER NOT NULL,
            guest_name TEXT NOT NULL,
            check_in TEXT NOT NULL,
            check_out TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (room_id) REFERENCES rooms(id),
            CHECK (check_out > check_in)
        )
    `);

    console.log("Rooms and bookings tables are ready.");
});

module.exports = db;
