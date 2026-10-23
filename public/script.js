
const $ = id => document.getElementById(id);

async function api(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options.headers
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Request failed.");
    }

    return data;
}

function notify(message, error = false) {
    const box = $("message");
    box.textContent = message;
    box.style.background = error ? "#b42318" : "#172033";
    box.style.display = "block";

    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => box.style.display = "none", 3500);
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;",
        '"': "&quot;", "'": "&#39;"
    })[c]);
}

function money(value) {
    return "₹" + Number(value).toLocaleString("en-IN", {
        maximumFractionDigits: 2
    });
}

function today() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString().slice(0, 10);
}

function tomorrow(date = today()) {
    const d = new Date(date + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
}

function emptyRow(columns, text) {
    return `<tr><td colspan="${columns}">${escapeHtml(text)}</td></tr>`;
}

// Load all rooms and populate the table and type filter.
async function loadRooms() {
    try {
        const rooms = await api("/api/rooms");
        $("totalRooms").textContent = rooms.length;

        $("roomsTable").innerHTML = rooms.length ? rooms.map(r => `
            <tr>
                <td>${escapeHtml(r.room_no)}</td>
                <td>${escapeHtml(r.hotel)}</td>
                <td>${escapeHtml(r.type)}</td>
                <td>${money(r.price)}</td>
                <td><span class="status ${r.status === "Maintenance" ? "maintenance" : ""}">
                    ${escapeHtml(r.status)}
                </span></td>
                <td>
                    <button class="secondary" data-action="edit-room" data-id="${r.id}">Edit</button>
                    <button class="danger" data-action="delete-room" data-id="${r.id}">Delete</button>
                </td>
            </tr>
        `).join("") : emptyRow(6, "No rooms found.");

        const currentType = $("searchType").value;
        const types = [...new Set(rooms.map(r => r.type))].sort();

        $("searchType").innerHTML =
            '<option value="">All Types</option>' +
            types.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");

        if (types.includes(currentType)) $("searchType").value = currentType;

        return rooms;
    } catch (err) {
        notify("Could not load rooms: " + err.message, true);
        return [];
    }
}

// Load bookings.
async function loadBookings() {
    try {
        const bookings = await api("/api/bookings");
        $("totalBookings").textContent = bookings.length;

        $("bookingsTable").innerHTML = bookings.length
            ? bookings.map(b => `
                <tr>
                    <td>${escapeHtml(b.guest_name)}</td>
                    <td>${escapeHtml(b.room_no)}</td>
                    <td>${escapeHtml(b.hotel)}</td>
                    <td>${escapeHtml(b.check_in)}</td>
                    <td>${escapeHtml(b.check_out)}</td>
                    <td>
                        <button class="danger" data-action="cancel-booking" data-id="${b.id}">
                            Cancel
                        </button>
                    </td>
                </tr>
            `).join("")
            : emptyRow(6, "No bookings yet.");
    } catch (err) {
        notify("Could not load bookings: " + err.message, true);
    }
}

// Search available rooms.
async function searchRooms(event) {
    if (event) event.preventDefault();

    const checkIn = $("checkIn").value;
    const checkOut = $("checkOut").value;

    if (!checkIn || !checkOut || checkOut <= checkIn) {
        notify("Check-out must be after check-in.", true);
        return;
    }

    const params = new URLSearchParams({
        check_in: checkIn,
        check_out: checkOut,
        hotel: $("searchHotel").value,
        type: $("searchType").value
    });

    try {
        const rooms = await api("/api/rooms/available?" + params);

        $("searchResults").innerHTML = rooms.length
            ? rooms.map(r => `
                <article class="room-card">
                    <span class="status">AVAILABLE</span>
                    <h3>Room ${escapeHtml(r.room_no)}</h3>
                    <div class="room-meta">${escapeHtml(r.hotel)}</div>
                    <div class="room-meta">Room type: ${escapeHtml(r.type)}</div>
                    <div class="price">${money(r.price)}</div>
                    <div class="room-meta">Per night</div>
                    <button type="button" data-action="book-room"
                        data-id="${r.id}" data-room="${escapeHtml(r.room_no)}">
                        Book Room
                    </button>
                </article>
            `).join("")
            : '<div class="empty">No rooms available for the selected dates.</div>';
    } catch (err) {
        notify(err.message, true);
    }
}

// Open the booking dialog.
function openBooking(roomId, roomNo) {
    const dialog = $("bookingDialog");

    if (!dialog) {
        notify("Booking form is missing from index.html.", true);
        return;
    }

    $("bookingRoomId").value = roomId;
    $("bookingRoomLabel").textContent = roomNo;
    $("bookingCheckIn").value = $("checkIn").value;
    $("bookingCheckOut").value = $("checkOut").value;
    $("bookingCheckIn").min = today();
    $("bookingCheckOut").min = $("bookingCheckIn").value;

    if (typeof dialog.showModal === "function") {
        dialog.showModal();
    } else {
        notify("Your browser does not support the booking dialog.", true);
    }
}

// Handle all buttons using event delegation.
document.addEventListener("click", async event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    const id = Number(button.dataset.id);

    if (action === "book-room") {
        openBooking(id, button.dataset.room);
        return;
    }

    if (action === "delete-room") {
        if (!confirm("Delete this room?")) return;

        try {
            await api(`/api/rooms/${id}`, { method: "DELETE" });
            notify("Room deleted.");
            await loadRooms();
            await searchRooms();
        } catch (err) {
            notify(err.message, true);
        }
        return;
    }

    if (action === "cancel-booking") {
        if (!confirm("Cancel this booking?")) return;

        try {
            await api(`/api/bookings/${id}`, { method: "DELETE" });
            notify("Booking cancelled.");
            await loadBookings();
            await searchRooms();
        } catch (err) {
            notify(err.message, true);
        }
        return;
    }

    if (action === "edit-room") {
        const rooms = await api("/api/rooms").catch(err => {
            notify(err.message, true);
            return [];
        });
        const room = rooms.find(r => r.id === id);
        if (!room) return;

        $("editRoomId").value = room.id;
        $("roomNo").value = room.room_no;
        $("roomNo").readOnly = true;
        $("hotel").value = room.hotel;
        $("roomType").value = room.type;
        $("price").value = room.price;
        $("roomFormTitle").textContent = "Edit Room";
        $("saveRoomButton").textContent = "Save Changes";
        $("cancelEdit").hidden = false;
        $("roomFormTitle").scrollIntoView({ behavior: "smooth" });
    }
});

// Add a room or save edits.
$("addRoomForm").addEventListener("submit", async event => {
    event.preventDefault();

    const editId = $("editRoomId").value;

    const body = {
        room_no: $("roomNo").value.trim(),
        hotel: $("hotel").value,
        type: $("roomType").value.trim(),
        price: Number($("price").value),
        status: "Available"
    };

    try {
        if (editId) {
            await api(`/api/rooms/${editId}`, {
                method: "PUT",
                body: JSON.stringify(body)
            });
            notify("Room updated successfully.");
        } else {
            await api("/api/rooms", {
                method: "POST",
                body: JSON.stringify(body)
            });
            notify("Room added successfully.");
        }

        resetRoomForm();
        await loadRooms();
        await searchRooms();
    } catch (err) {
        notify(err.message, true);
    }
});

function resetRoomForm() {
    $("addRoomForm").reset();
    $("editRoomId").value = "";
    $("roomNo").readOnly = false;
    $("roomFormTitle").textContent = "Add a Room";
    $("saveRoomButton").textContent = "Add Room";
    $("cancelEdit").hidden = true;
}

$("cancelEdit").addEventListener("click", resetRoomForm);

// Update checkout date if check-in changes.
$("bookingCheckIn").addEventListener("change", () => {
    const start = $("bookingCheckIn").value;
    $("bookingCheckOut").min = start;

    if ($("bookingCheckOut").value <= start) {
        $("bookingCheckOut").value = tomorrow(start);
    }
});

// Confirm booking.
$("bookingForm").addEventListener("submit", async event => {
    event.preventDefault();

    const submitButton = event.submitter;
    if (submitButton) submitButton.disabled = true;

    try {
        await api("/api/bookings", {
            method: "POST",
            body: JSON.stringify({
                room_id: Number($("bookingRoomId").value),
                guest_name: $("guestName").value.trim(),
                check_in: $("bookingCheckIn").value,
                check_out: $("bookingCheckOut").value
            })
        });

        $("bookingDialog").close();
        $("bookingForm").reset();
        notify("Room booked successfully!");

        await loadBookings();
        await searchRooms();
    } catch (err) {
        notify(err.message, true);
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
});

$("closeDialog").addEventListener("click", () => {
    $("bookingDialog").close();
});

$("bookingDialog").addEventListener("click", event => {
    if (event.target === $("bookingDialog")) {
        $("bookingDialog").close();
    }
});

$("searchForm").addEventListener("submit", searchRooms);
$("refreshRooms").addEventListener("click", loadRooms);
$("refreshBookings").addEventListener("click", loadBookings);

$("checkIn").min = today();
$("checkIn").value = today();
$("checkOut").min = tomorrow();
$("checkOut").value = tomorrow();

loadRooms().then(() => searchRooms());
loadBookings();
