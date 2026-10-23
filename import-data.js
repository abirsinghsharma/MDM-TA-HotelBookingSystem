
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const db = require("./database");

const csvPath = path.join(__dirname, "hotel_booking.csv");

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

async function importRooms() {
    try {
        if (!fs.existsSync(csvPath)) {
            throw new Error("hotel_booking.csv was not found.");
        }

        const records = parse(fs.readFileSync(csvPath, "utf8"), {
            columns: true,
            skip_empty_lines: true,
            bom: true
        });

        const categories = new Map();

        for (const row of records) {
            const hotel = row.hotel?.trim();
            const type = (
                row.assigned_room_type || row.reserved_room_type || ""
            ).trim();
            const price = Number(row.adr);

            if (
                !hotel ||
                !type ||
                !Number.isFinite(price) ||
                price < 0
            ) {
                continue;
            }

            const key = `${hotel}|${type}`;

            if (!categories.has(key)) {
                categories.set(key, {
                    hotel,
                    type,
                    total: 0,
                    count: 0
                });
            }

            const item = categories.get(key);
            item.total += price;
            item.count++;
        }

        let index = 1;

        for (const item of categories.values()) {
            const averagePrice = Number(
                (item.total / item.count).toFixed(2)
            );

            await run(
                `INSERT OR IGNORE INTO rooms
                 (room_no, hotel, type, price, status)
                 VALUES (?, ?, ?, ?, 'Available')`,
                [
                    `D${String(index).padStart(3, "0")}`,
                    item.hotel,
                    item.type,
                    averagePrice
                ]
            );

            index++;
        }

        console.log(`CSV records read: ${records.length}`);
        console.log(`Room categories processed: ${categories.size}`);
        console.log("Demo rooms imported successfully.");
    } catch (error) {
        console.error("Import error:", error.message);
        process.exitCode = 1;
    } finally {
        db.close();
    }
}

importRooms();
