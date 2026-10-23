
const express = require("express");
const path = require("path");
const db = require("./database");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function validDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return false;
    const d = new Date(date + "T00:00:00Z");
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

function validRange(start, end) {
    return validDate(start) && validDate(end) && end > start;
}

// GET all rooms
app.get("/api/rooms", (req, res) => {
    db.all("SELECT * FROM rooms ORDER BY id", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST add room
app.post("/api/rooms", (req, res) => {
    const { room_no, hotel, type, price } = req.body;

    if (
        typeof room_no !== "string" || !room_no.trim() ||
        typeof hotel !== "string" || !hotel.trim() ||
        typeof type !== "string" || !type.trim() ||
        price === "" || price === null || price === undefined ||
        !Number.isFinite(Number(price)) || Number(price) < 0
    ) {
        return res.status(400).json({ error: "Enter valid room details." });
    }

    db.run(
        `INSERT INTO rooms (room_no, hotel, type, price, status)
         VALUES (?, ?, ?, ?, 'Available')`,
        [room_no.trim(), hotel.trim(), type.trim(), Number(price)],
        function (err) {
            if (err) {
                const duplicate = err.message.includes("UNIQUE");
                return res.status(duplicate ? 409 : 500).json({
                    error: duplicate ? "Room number already exists." : err.message
                });
            }
            res.status(201).json({ id: this.lastID, message: "Room added." });
        }
    );
});

// PUT update room
app.put("/api/rooms/:id", (req, res) => {
    const { hotel, type, price, status } = req.body;

    if (
        typeof hotel !== "string" || !hotel.trim() ||
        typeof type !== "string" || !type.trim() ||
        price === "" || price === null || price === undefined ||
        !Number.isFinite(Number(price)) || Number(price) < 0 ||
        !["Available", "Maintenance"].includes(status)
    ) {
        return res.status(400).json({ error: "Enter valid room details." });
    }

    db.run(
        `UPDATE rooms SET hotel=?, type=?, price=?, status=? WHERE id=?`,
        [hotel.trim(), type.trim(), Number(price), status, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (!this.changes) return res.status(404).json({ error: "Room not found." });
            res.json({ message: "Room updated." });
        }
    );
});

// DELETE room
app.delete("/api/rooms/:id", (req, res) => {
    db.get(
        "SELECT COUNT(*) AS count FROM bookings WHERE room_id=?",
        [req.params.id],
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });

            if (row.count > 0) {
                return res.status(409).json({
                    error: "Cannot delete a room with booking history."
                });
            }

            db.run("DELETE FROM rooms WHERE id=?", [req.params.id], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                if (!this.changes) return res.status(404).json({ error: "Room not found." });
                res.json({ message: "Room deleted." });
            });
        }
    );
});

// GET available rooms by dates, hotel and type
app.get("/api/rooms/available", (req, res) => {
    const { check_in, check_out, hotel = "", type = "" } = req.query;

    if (!validRange(check_in, check_out)) {
        return res.status(400).json({
            error: "Check-out must be after check-in. Please select valid dates."
        });
    }

    const sql = `
        SELECT r.*
        FROM rooms r
        WHERE r.status = 'Available'
          AND (? = '' OR r.hotel = ?)
          AND (? = '' OR r.type = ?)
          AND NOT EXISTS (
              SELECT 1 FROM bookings b
              WHERE b.room_id = r.id
                AND b.check_in < ?
                AND b.check_out > ?
          )
        ORDER BY r.price
    `;

    db.all(sql, [hotel, hotel, type, type, check_out, check_in], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// GET bookings
app.get("/api/bookings", (req, res) => {
    const sql = `
        SELECT b.id, b.guest_name, b.check_in, b.check_out,
               r.room_no, r.hotel, r.type, r.price
        FROM bookings b
        JOIN rooms r ON r.id = b.room_id
        ORDER BY b.id DESC
    `;

    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST create booking
app.post("/api/bookings", (req, res) => {
    const { room_id, guest_name, check_in, check_out } = req.body;
    const id = Number(room_id);

    if (
        !Number.isInteger(id) || id <= 0 ||
        typeof guest_name !== "string" || !guest_name.trim() ||
        !validRange(check_in, check_out)
    ) {
        return res.status(400).json({
            error: "Enter a guest name, valid room and valid dates."
        });
    }

    db.get("SELECT * FROM rooms WHERE id=?", [id], (err, room) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!room) return res.status(404).json({ error: "Room not found." });

        if (room.status !== "Available") {
            return res.status(409).json({ error: "Room is under maintenance." });
        }

        db.get(
            `SELECT id FROM bookings
             WHERE room_id=? AND check_in < ? AND check_out > ?
             LIMIT 1`,
            [id, check_out, check_in],
            (err, existing) => {
                if (err) return res.status(500).json({ error: err.message });

                if (existing) {
                    return res.status(409).json({
                        error: "Room is already booked for these dates."
                    });
                }

                db.run(
                    `INSERT INTO bookings (room_id, guest_name, check_in, check_out)
                     VALUES (?, ?, ?, ?)`,
                    [id, guest_name.trim(), check_in, check_out],
                    function (err) {
                        if (err) return res.status(500).json({ error: err.message });
                        res.status(201).json({
                            id: this.lastID,
                            message: "Booking created successfully."
                        });
                    }
                );
            }
        );
    });
});

// DELETE cancel booking
app.delete("/api/bookings/:id", (req, res) => {
    db.run("DELETE FROM bookings WHERE id=?", [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (!this.changes) return res.status(404).json({ error: "Booking not found." });
        res.json({ message: "Booking cancelled." });
    });
});

app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) {
        return next();
    }

    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
    console.log(`Hotel Booking System running at http://localhost:${PORT}`);
});
