
# Hotel Room Booking System

A full-stack hotel room booking application built using HTML, CSS,
JavaScript, Node.js, Express.js and SQLite.

## Features

- Search rooms by hotel, room type and dates
- Add, edit and delete rooms
- Create and cancel bookings
- Prevent overlapping reservations
- Store room and booking data in SQLite
- REST APIs using JSON
- Dynamic frontend updates using Fetch API
- Import room categories and historical average prices from a Kaggle dataset

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js and Express.js
- Database: SQLite
- Dataset processing: csv-parse

## Setup

1. Install Node.js.
2. Clone this repository.
3. Open a terminal in the project directory.
4. Install dependencies:

   npm install

5. Ensure the Kaggle CSV is available at `hotel_booking.csv`.
6. Import the dataset:

   npm run import

7. Start the server:

   npm start

8. Open http://localhost:3000.

## API Endpoints

### Rooms

- GET /api/rooms
- GET /api/rooms/available
- POST /api/rooms
- PUT /api/rooms/:id
- DELETE /api/rooms/:id

### Bookings

- GET /api/bookings
- POST /api/bookings
- DELETE /api/bookings/:id

## Database

The SQLite database contains two tables:

- `rooms`: room number, hotel, room type, price and status
- `bookings`: guest name, room ID, check-in and check-out dates

## Dataset Note

The Kaggle dataset contains historical hotel reservations. The generated
room inventory is demonstration data derived from hotel and room-type
categories and historical prices; it is not live hotel inventory.

## Limitations

This is an academic demonstration project. It does not process real payments
or connect to live hotel inventory.
