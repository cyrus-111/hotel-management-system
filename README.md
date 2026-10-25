# Hartwell: Hotel Reservation System

A DBMS micro project: a working prototype of a hotel reservation system built on a PostgreSQL relational database, with a React frontend and an Express (Node.js) backend.

> **Course:** Database Management Systems (DBMS)
> **Project type:** Micro Project
> **Author:** _Your Name_ | _Roll No / Class_

---

## 1. Problem Statement

**Title:** Hotel Reservation System

**Background:** Hotels manage a large amount of information every day: guests, rooms, bookings, payments and the staff who handle them.

**Existing problem:** When this is done manually or in separate spreadsheets, it leads to double-booked rooms, lost or inconsistent records, slow searching and no clear view of revenue.

**Proposed solution:** A centralized relational database that stores guests, rooms, reservations, payments and staff, with a web interface that lets hotel staff add, update, delete and search records and generate reports.

---

## 2. Features

| Screen | What it does | SQL concepts shown |
|---|---|---|
| Home / Dashboard | Totals for guests, rooms, active reservations and revenue; latest reservations; revenue by payment method | Aggregate functions, subqueries, JOIN, GROUP BY |
| Guests | Add, edit, delete, search by name or phone | INSERT, UPDATE, DELETE, ILIKE, UNIQUE constraints |
| Rooms | Add, edit, delete, filter by type and availability | CHECK constraints, WHERE |
| Reservations | Create a booking with one or more rooms, edit, cancel, delete | Transactions, junction table, foreign keys, ON DELETE CASCADE |
| Payments | Record, edit and delete payments (one per reservation) | UNIQUE foreign key (1:1) |
| Search | Search guests, rooms and reservations in one place | WHERE, LIKE / ILIKE, JOIN |
| Reports | Revenue by payment method, reservation history per guest, staff workload | GROUP BY, HAVING, aggregates, LEFT JOIN |

Other behaviour:
- Room clash prevention: a room cannot be booked for overlapping dates.
- Cancelling a reservation sets its status to `Cancelled` instead of removing it.
- All money values are shown in Indian rupees (₹).

---

## 3. Tech Stack

- **Database:** PostgreSQL (managed with pgAdmin)
- **Backend:** Node.js, Express, `pg` (node-postgres)
- **Frontend:** React, Vite, TypeScript, Tailwind CSS
- **Version control:** Git and GitHub

How the pieces connect:

```
React (localhost:3000)  →  Express API (localhost:5000)  →  PostgreSQL (hotel_db)
```

Vite proxies every `/api` request from the frontend to the Express server.

---

## 4. Database Design

### Entities

- **Guest**: `guest_id` (PK), `fname`, `minit`, `lname`, `phone` (unique), `email` (unique)
- **Staff**: `staff_id` (PK), `fname`, `minit`, `lname`, `phone` (unique), `role`
- **Room**: `room_id` (PK), `room_number` (unique), `room_type`, `price`, `availability`
- **Reservation**: `reservation_id` (PK), `booking_date`, `check_in_date`, `check_out_date`, `status`, `guest_id` (FK), `staff_id` (FK)
- **Reservation_Room**: `(reservation_id, room_id)` composite PK, both columns are foreign keys
- **Payment**: `payment_id` (PK), `payment_date`, `payment_method`, `payment_amount`, `reservation_id` (unique FK)

### Relationships

| Relationship | Cardinality | Implementation |
|---|---|---|
| Guest MAKES Reservation | 1 : N | `guest_id` FK in Reservation |
| Staff MANAGES Reservation | 1 : N | `staff_id` FK in Reservation |
| Reservation INCLUDES Room | M : N | Junction table `Reservation_Room` |
| Reservation HAS Payment | 1 : 1 | UNIQUE `reservation_id` FK in Payment |

### Key constraints

- `CHECK (check_out_date > check_in_date)` on Reservation
- `CHECK (price > 0)` and `CHECK (payment_amount > 0)`
- Allowed values enforced with CHECK for room type, availability, payment method and reservation status
- `ON DELETE CASCADE` from Guest to Reservation, and from Reservation to Reservation_Room and Payment
- `ON DELETE SET NULL` from Staff to Reservation

### Sample data

10 guests, 6 staff, 10 rooms, 15 reservations, 16 reservation-room links and 14 payments.

---

## 5. Project Structure

```
├── database/
│   ├── hotel_schema_and_data.sql   # DDL + sample data (DML)
│   └── hotel_queries.sql           # SELECT, JOIN, GROUP BY, HAVING, subqueries
├── server/
│   └── index.js                    # Express API connected to PostgreSQL
├── src/                            # React frontend
├── .env.example                    # Environment variable template
├── package.json
└── vite.config.ts
```

---

## 6. Setup and Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer)
- [PostgreSQL](https://www.postgresql.org/download/) and pgAdmin
- Git

### Step 1: Create the database

1. Open pgAdmin, right-click **Databases → Create → Database**, and name it `hotel_db`.
2. Right-click `hotel_db` → **Query Tool**.
3. Open `database/hotel_schema_and_data.sql`, paste it in and run it (**F5**).
4. Check the data loaded:
   ```sql
   SELECT COUNT(*) FROM Guest;   -- should return 10
   ```

### Step 2: Clone and install

```bash
git clone <your-repo-url>
cd <your-repo-folder>
npm install --legacy-peer-deps
```

### Step 3: Configure environment variables

Copy `.env.example` to a new file named `.env` in the project root and fill in your own values:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hotel_db
DB_USER=postgres
DB_PASSWORD=your_password_here
API_PORT=5000
```

`.env` is listed in `.gitignore` and is never committed.

### Step 4: Run the project

Open two terminals in the project folder.

**Terminal 1: backend**
```bash
npm run server
```
Expected output:
```
Connected to PostgreSQL hotel_db
API running at http://localhost:5000
```

**Terminal 2: frontend**
```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## 7. API Endpoints

| Resource | Endpoints |
|---|---|
| Dashboard | `GET /api/dashboard` |
| Guests | `GET /api/guests?search=`, `POST /api/guests`, `PUT /api/guests/:id`, `DELETE /api/guests/:id` |
| Staff | `GET /api/staff` |
| Rooms | `GET /api/rooms?type=&availability=`, `GET /api/rooms/available?checkin=&checkout=`, `POST`, `PUT /:id`, `DELETE /:id` |
| Reservations | `GET /api/reservations`, `POST /api/reservations`, `PUT /api/reservations/:id`, `PATCH /api/reservations/:id/cancel`, `DELETE /api/reservations/:id` |
| Payments | `GET /api/payments`, `POST`, `PUT /:id`, `DELETE /:id` |
| Search | `GET /api/search?q=` |
| Reports | `GET /api/reports/revenue-by-method`, `/guest-history`, `/staff-workload` |

---

## 8. Example Queries

```sql
-- Revenue by payment method (GROUP BY + aggregates)
SELECT payment_method, COUNT(*) AS transactions, SUM(payment_amount) AS total
FROM Payment GROUP BY payment_method;

-- Guests with 2 or more reservations (HAVING)
SELECT guest_id, COUNT(*) AS bookings
FROM Reservation GROUP BY guest_id HAVING COUNT(*) >= 2;

-- Rooms never booked (subquery)
SELECT * FROM Room WHERE room_id NOT IN (SELECT room_id FROM Reservation_Room);
```

More queries are in `database/hotel_queries.sql`.

---

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| `client password must be a string` | `.env` is missing, misnamed, or `DB_PASSWORD` is empty. It must be named exactly `.env` and sit in the project root. |
| `password authentication failed` | The password in `.env` doesn't match your PostgreSQL `postgres` user password. |
| `ECONNREFUSED` | PostgreSQL isn't running. Start the service or connect once in pgAdmin. |
| `npm install` fails with `ERESOLVE` | Use `npm install --legacy-peer-deps`. |
| Website loads but shows no data | Make sure `npm run server` is running and the Vite proxy for `/api` is set in `vite.config.ts`. |




