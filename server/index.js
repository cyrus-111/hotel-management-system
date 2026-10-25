// Hartwell Hotel - Express API connected to PostgreSQL (hotel_db)
// Run with: npm run server
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';

// Return numbers and dates in a React-friendly format
pg.types.setTypeParser(1700, (v) => parseFloat(v)); // NUMERIC -> number
pg.types.setTypeParser(20, (v) => parseInt(v, 10)); // COUNT (bigint) -> number
pg.types.setTypeParser(1082, (v) => v);             // DATE -> 'YYYY-MM-DD' string

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'hotel_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

const app = express();
app.use(cors());
app.use(express.json());

// Helper: run a query and send rows, or send a clean error
const q = (sql, paramsFn = () => []) => async (req, res) => {
  try {
    const { rows } = await pool.query(sql, paramsFn(req));
    res.json(rows);
  } catch (err) {
    sendError(res, err);
  }
};

// Turn common PostgreSQL errors into readable messages
function sendError(res, err) {
  console.error(err.message);
  const map = {
    '23505': 'Duplicate value: that phone, email or room number already exists.',
    '23503': 'This record is linked to other records, so the action is not allowed.',
    '23514': 'A value breaks a rule (check dates, price or amount).',
    '23502': 'A required field is missing.',
  };
  res.status(400).json({ error: map[err.code] || err.message });
}

// ---------------- DASHBOARD ----------------
app.get('/api/dashboard', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM Guest) AS total_guests,
        (SELECT COUNT(*) FROM Room) AS total_rooms,
        (SELECT COUNT(*) FROM Reservation WHERE status IN ('Booked','Checked-in')) AS active_reservations,
        (SELECT COALESCE(SUM(payment_amount),0) FROM Payment) AS total_revenue`);
    const latest = await pool.query(`
      SELECT r.reservation_id, CONCAT(g.fname,' ',g.lname) AS guest,
             STRING_AGG(rm.room_number, ', ') AS rooms,
             r.check_in_date, r.check_out_date, r.status
      FROM Reservation r
      JOIN Guest g ON r.guest_id = g.guest_id
      LEFT JOIN Reservation_Room rr ON r.reservation_id = rr.reservation_id
      LEFT JOIN Room rm ON rr.room_id = rm.room_id
      GROUP BY r.reservation_id, g.fname, g.lname
      ORDER BY r.booking_date DESC, r.reservation_id DESC
      LIMIT 5`);
    const byMethod = await pool.query(`
      SELECT payment_method, SUM(payment_amount) AS total
      FROM Payment GROUP BY payment_method ORDER BY total DESC`);
    res.json({ ...stats.rows[0], latest_reservations: latest.rows, revenue_by_method: byMethod.rows });
  } catch (err) { sendError(res, err); }
});

// ---------------- GUESTS ----------------
app.get('/api/guests', q(
  `SELECT * FROM Guest
   WHERE ($1 = '' OR fname ILIKE '%'||$1||'%' OR lname ILIKE '%'||$1||'%' OR phone LIKE '%'||$1||'%')
   ORDER BY guest_id`,
  (req) => [req.query.search || '']
));

app.post('/api/guests', async (req, res) => {
  const { fname, minit, lname, phone, email } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO Guest (fname, minit, lname, phone, email)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [fname, minit || null, lname, phone, email || null]);
    res.status(201).json(rows[0]);
  } catch (err) { sendError(res, err); }
});

app.put('/api/guests/:id', async (req, res) => {
  const { fname, minit, lname, phone, email } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE Guest SET fname=$1, minit=$2, lname=$3, phone=$4, email=$5
       WHERE guest_id=$6 RETURNING *`,
      [fname, minit || null, lname, phone, email || null, req.params.id]);
    res.json(rows[0] || {});
  } catch (err) { sendError(res, err); }
});

// ON DELETE CASCADE removes the guest's reservations too
app.delete('/api/guests/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM Guest WHERE guest_id=$1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) { sendError(res, err); }
});

// ---------------- STAFF ----------------
app.get('/api/staff', q('SELECT * FROM Staff ORDER BY staff_id'));

// ---------------- ROOMS ----------------
app.get('/api/rooms', q(
  `SELECT * FROM Room
   WHERE ($1 = '' OR room_type = $1) AND ($2 = '' OR availability = $2)
   ORDER BY room_number`,
  (req) => [req.query.type || '', req.query.availability || '']
));

// Rooms free for a date range (used by the availability bar and the booking form)
app.get('/api/rooms/available', q(
  `SELECT * FROM Room
   WHERE availability <> 'Maintenance'
     AND room_id NOT IN (
       SELECT rr.room_id FROM Reservation_Room rr
       JOIN Reservation r ON rr.reservation_id = r.reservation_id
       WHERE r.status <> 'Cancelled'
         AND r.check_in_date < $2::date
         AND r.check_out_date > $1::date)
   ORDER BY price`,
  (req) => [req.query.checkin, req.query.checkout]
));

app.post('/api/rooms', async (req, res) => {
  const { room_number, room_type, price, availability } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO Room (room_number, room_type, price, availability)
       VALUES ($1,$2,$3,COALESCE($4,'Available')) RETURNING *`,
      [room_number, room_type, price, availability || null]);
    res.status(201).json(rows[0]);
  } catch (err) { sendError(res, err); }
});

app.put('/api/rooms/:id', async (req, res) => {
  const { room_number, room_type, price, availability } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE Room SET room_number=$1, room_type=$2, price=$3, availability=$4
       WHERE room_id=$5 RETURNING *`,
      [room_number, room_type, price, availability, req.params.id]);
    res.json(rows[0] || {});
  } catch (err) { sendError(res, err); }
});

app.delete('/api/rooms/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM Room WHERE room_id=$1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) { sendError(res, err); }
});

// ---------------- RESERVATIONS ----------------
app.get('/api/reservations', q(
  `SELECT r.reservation_id, r.booking_date, r.check_in_date, r.check_out_date, r.status,
          r.guest_id, CONCAT(g.fname,' ',g.lname) AS guest,
          r.staff_id, CONCAT(s.fname,' ',s.lname) AS staff,
          STRING_AGG(rm.room_number, ', ') AS rooms,
          COALESCE(MAX(p.payment_amount), 0) AS paid,
          CASE WHEN MAX(p.payment_id) IS NULL THEN 'Pending' ELSE 'Paid' END AS payment_status
   FROM Reservation r
   JOIN Guest g ON r.guest_id = g.guest_id
   LEFT JOIN Staff s ON r.staff_id = s.staff_id
   LEFT JOIN Reservation_Room rr ON r.reservation_id = rr.reservation_id
   LEFT JOIN Room rm ON rr.room_id = rm.room_id
   LEFT JOIN Payment p ON r.reservation_id = p.reservation_id
   GROUP BY r.reservation_id, g.fname, g.lname, s.fname, s.lname
   ORDER BY r.reservation_id DESC`
));

// Create reservation + room links (+ optional payment) in ONE transaction
app.post('/api/reservations', async (req, res) => {
  const { guest_id, staff_id, check_in_date, check_out_date, room_ids, payment } = req.body;
  const client = await pool.connect();
  try {
    if (!Array.isArray(room_ids) || room_ids.length === 0) {
      return res.status(400).json({ error: 'Select at least one room.' });
    }
    await client.query('BEGIN');

    // Block rooms that are already booked for these dates
    const clash = await client.query(
      `SELECT rm.room_number FROM Reservation_Room rr
       JOIN Reservation r ON rr.reservation_id = r.reservation_id
       JOIN Room rm ON rr.room_id = rm.room_id
       WHERE rr.room_id = ANY($1::int[]) AND r.status <> 'Cancelled'
         AND r.check_in_date < $3::date AND r.check_out_date > $2::date`,
      [room_ids, check_in_date, check_out_date]);
    if (clash.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Room(s) already booked: ${clash.rows.map((x) => x.room_number).join(', ')}`,
      });
    }

    const r = await client.query(
      `INSERT INTO Reservation (booking_date, check_in_date, check_out_date, guest_id, staff_id, status)
       VALUES (CURRENT_DATE, $1, $2, $3, $4, 'Booked') RETURNING *`,
      [check_in_date, check_out_date, guest_id, staff_id || null]);
    const id = r.rows[0].reservation_id;

    for (const room_id of room_ids) {
      await client.query(
        'INSERT INTO Reservation_Room (reservation_id, room_id) VALUES ($1,$2)', [id, room_id]);
    }
    if (payment && payment.amount > 0) {
      await client.query(
        `INSERT INTO Payment (payment_date, payment_method, payment_amount, reservation_id)
         VALUES (CURRENT_DATE, $1, $2, $3)`, [payment.method, payment.amount, id]);
    }
    await client.query('COMMIT');
    res.status(201).json(r.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    sendError(res, err);
  } finally {
    client.release();
  }
});

app.put('/api/reservations/:id', async (req, res) => {
  const { check_in_date, check_out_date, staff_id, status } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE Reservation SET check_in_date=$1, check_out_date=$2, staff_id=$3, status=$4
       WHERE reservation_id=$5 RETURNING *`,
      [check_in_date, check_out_date, staff_id || null, status, req.params.id]);
    res.json(rows[0] || {});
  } catch (err) { sendError(res, err); }
});

// Cancel = UPDATE status (keeps the record)
app.patch('/api/reservations/:id/cancel', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE Reservation SET status='Cancelled' WHERE reservation_id=$1 RETURNING *`,
      [req.params.id]);
    res.json(rows[0] || {});
  } catch (err) { sendError(res, err); }
});

app.delete('/api/reservations/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM Reservation WHERE reservation_id=$1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) { sendError(res, err); }
});

// ---------------- PAYMENTS ----------------
app.get('/api/payments', q(
  `SELECT p.payment_id, p.payment_date, p.payment_method, p.payment_amount, p.reservation_id,
          CONCAT(g.fname,' ',g.lname) AS guest
   FROM Payment p
   JOIN Reservation r ON p.reservation_id = r.reservation_id
   JOIN Guest g ON r.guest_id = g.guest_id
   ORDER BY p.payment_date DESC, p.payment_id DESC`
));

app.post('/api/payments', async (req, res) => {
  const { reservation_id, payment_method, payment_amount, payment_date } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO Payment (payment_date, payment_method, payment_amount, reservation_id)
       VALUES (COALESCE($1::date, CURRENT_DATE), $2, $3, $4) RETURNING *`,
      [payment_date || null, payment_method, payment_amount, reservation_id]);
    res.status(201).json(rows[0]);
  } catch (err) { sendError(res, err); }
});

app.put('/api/payments/:id', async (req, res) => {
  const { payment_method, payment_amount } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE Payment SET payment_method=$1, payment_amount=$2
       WHERE payment_id=$3 RETURNING *`,
      [payment_method, payment_amount, req.params.id]);
    res.json(rows[0] || {});
  } catch (err) { sendError(res, err); }
});

app.delete('/api/payments/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM Payment WHERE payment_id=$1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) { sendError(res, err); }
});

// ---------------- SEARCH ----------------
app.get('/api/search', async (req, res) => {
  const term = req.query.q || '';
  try {
    const guests = await pool.query(
      `SELECT * FROM Guest WHERE fname ILIKE '%'||$1||'%' OR lname ILIKE '%'||$1||'%'
       OR phone LIKE '%'||$1||'%' OR email ILIKE '%'||$1||'%'`, [term]);
    const rooms = await pool.query(
      `SELECT * FROM Room WHERE room_number ILIKE '%'||$1||'%'
       OR room_type ILIKE '%'||$1||'%' OR availability ILIKE '%'||$1||'%'`, [term]);
    const reservations = await pool.query(
      `SELECT r.reservation_id, CONCAT(g.fname,' ',g.lname) AS guest,
              r.check_in_date, r.check_out_date, r.status
       FROM Reservation r JOIN Guest g ON r.guest_id = g.guest_id
       WHERE g.fname ILIKE '%'||$1||'%' OR g.lname ILIKE '%'||$1||'%'
          OR r.status ILIKE '%'||$1||'%'`, [term]);
    res.json({ guests: guests.rows, rooms: rooms.rows, reservations: reservations.rows });
  } catch (err) { sendError(res, err); }
});

// ---------------- REPORTS ----------------
// Report 1: GROUP BY + aggregates
app.get('/api/reports/revenue-by-method', q(
  `SELECT payment_method, COUNT(*) AS transactions,
          SUM(payment_amount) AS total_revenue, AVG(payment_amount) AS avg_payment
   FROM Payment GROUP BY payment_method ORDER BY total_revenue DESC`
));

// Report 2: multi-table JOIN
app.get('/api/reports/guest-history', q(
  `SELECT g.guest_id, CONCAT(g.fname,' ',g.lname) AS guest, r.reservation_id,
          STRING_AGG(rm.room_number, ', ') AS rooms,
          r.check_in_date, r.check_out_date, r.status,
          COALESCE(p.payment_amount, 0) AS paid
   FROM Guest g
   JOIN Reservation r ON g.guest_id = r.guest_id
   JOIN Reservation_Room rr ON r.reservation_id = rr.reservation_id
   JOIN Room rm ON rr.room_id = rm.room_id
   LEFT JOIN Payment p ON r.reservation_id = p.reservation_id
   GROUP BY g.guest_id, g.fname, g.lname, r.reservation_id, p.payment_amount
   ORDER BY r.check_in_date DESC`
));

// Report 3: LEFT JOIN staff workload
app.get('/api/reports/staff-workload', q(
  `SELECT s.staff_id, CONCAT(s.fname,' ',s.lname) AS staff, s.role,
          COUNT(r.reservation_id) AS reservations_handled
   FROM Staff s LEFT JOIN Reservation r ON s.staff_id = r.staff_id
   GROUP BY s.staff_id, s.fname, s.lname, s.role
   ORDER BY reservations_handled DESC`
));

// ---------------- START ----------------
const PORT = process.env.API_PORT || 5000;
pool.query('SELECT current_database() AS db')
  .then((r) => {
    console.log(`Connected to PostgreSQL ${r.rows[0].db}`);
    app.listen(PORT, () => console.log(`API running at http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Could not connect to PostgreSQL:', err.message);
    console.error('Check DB_PASSWORD in .env and that PostgreSQL is running.');
  });