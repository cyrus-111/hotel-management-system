export interface FlaskProjectFile {
  path: string;
  language: 'python' | 'html' | 'css' | 'javascript' | 'text' | 'ini';
  description: string;
  content: string;
}

export const FLASK_PROJECT_FILES: FlaskProjectFile[] = [
  {
    path: 'requirements.txt',
    language: 'text',
    description: 'Python dependencies for Flask, PostgreSQL (psycopg2-binary), and .env loading.',
    content: `Flask==3.0.3
psycopg2-binary==2.9.9
python-dotenv==1.0.1
`
  },
  {
    path: '.env',
    language: 'ini',
    description: 'Environment configuration placeholders for PostgreSQL (hotel_db) and Flask secret key.',
    content: `DB_HOST=localhost
DB_PORT=5432
DB_NAME=hotel_db
DB_USER=postgres
DB_PASSWORD=your_password_here
SECRET_KEY=change_me
`
  },
  {
    path: 'db.py',
    language: 'python',
    description: 'PostgreSQL database connection helper returning RealDictCursor rows and safe transaction wrappers.',
    content: `import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

def get_db_connection():
    """
    Opens and returns a new PostgreSQL database connection using credentials
    from the .env file. Uses RealDictCursor so rows behave like dictionaries.
    """
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        dbname=os.getenv("DB_NAME", "hotel_db"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "your_password_here"),
        cursor_factory=RealDictCursor
    )
    return conn


def query_db(sql, params=None, one=False):
    """
    Executes a parameterized SELECT query (%s) and returns dictionary rows.
    """
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(sql, params or ())
            rows = cur.fetchall()
            if one:
                return rows[0] if rows else None
            return rows
    finally:
        if conn:
            conn.close()


def execute_db(sql, params=None, fetch_one=False):
    """
    Executes an INSERT, UPDATE, or DELETE statement inside a transaction block.
    Rolls back automatically on error and re-raises for route handling.
    """
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(sql, params or ())
            result = cur.fetchone() if fetch_one else None
        conn.commit()
        return result
    except Exception as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        if conn:
            conn.close()
`
  },
  {
    path: 'app.py',
    language: 'python',
    description: 'Main Flask application with Indian Rupee (inr) Jinja filter, parameterized SQL routes, and transaction handling.',
    content: `import os
from datetime import date, datetime
from decimal import Decimal
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from dotenv import load_dotenv
from db import get_db_connection, query_db, execute_db

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "change_me")


# =====================================================
# JINJA FILTER: Indian Rupee (₹) Digit Grouping
# =====================================================
@app.template_filter("inr")
def format_inr(value):
    """
    Formats a number using the Indian digit grouping system with the ₹ symbol.
    Examples:
      12000   -> ₹12,000
      120000  -> ₹1,20,000
      4500.5  -> ₹4,500.50
    Never uses pound or dollar symbols.
    """
    if value is None or value == "":
        return "₹0"
    try:
        num = Decimal(str(value))
    except Exception:
        return "₹0"

    is_negative = num < 0
    num = abs(num)

    # Check if value has non-zero fractional paise
    quantized = num.quantize(Decimal("0.01"))
    int_part_val = int(quantized)
    frac_part = quantized - Decimal(int_part_val)

    s = str(int_part_val)
    if len(s) <= 3:
        formatted_int = s
    else:
        last_three = s[-3:]
        remaining = s[:-3]
        groups = []
        while remaining:
            groups.insert(0, remaining[-2:])
            remaining = remaining[:-2]
        formatted_int = ",".join(groups) + "," + last_three

    sign = "-" if is_negative else ""
    if frac_part > 0:
        dec_str = f"{quantized:.2f}".split(".")[1]
        return f"{sign}₹{formatted_int}.{dec_str}"
    return f"{sign}₹{formatted_int}"


# Helper to map room_type to local image and editorial metadata
ROOM_META = {
    "Suite": {
        "name": "The Somerset Manor Suite",
        "img": "img/room_suite.jpg",
        "features": [
            "Four-poster English oak bed · Limestone hearth",
            "Private garden terrace & soaking tub · 68 sq m"
        ]
    },
    "Deluxe": {
        "name": "Cotswold Meadow Deluxe",
        "img": "img/room_deluxe.jpg",
        "features": [
            "King wool-upholstered bed · Mullioned valley views",
            "Freestanding copper bath & writing bureau · 46 sq m"
        ]
    },
    "Double": {
        "name": "Orchard Courtyard Double",
        "img": "img/room_double.jpg",
        "features": [
            "Queen natural linen bed · Courtyard aspect",
            "Walk-in rain shower & botanical tea service · 32 sq m"
        ]
    },
    "Single": {
        "name": "Gable Study Single",
        "img": "img/room_single.jpg",
        "features": [
            "Bespoke single stead · Orchard outlook",
            "Antique oak writing desk & rain shower · 24 sq m"
        ]
    }
}

@app.context_processor
def inject_helpers():
    return dict(room_meta=ROOM_META, today_str=date.today().isoformat())


# =====================================================
# 1. HOME PAGE & NEWSLETTER
# =====================================================
@app.route("/")
def home():
    featured_rooms = []
    try:
        # Pull up to 3 Available rooms (preferring Suite, Deluxe, Double)
        sql = """
            SELECT * FROM Room
            WHERE availability = 'Available'
            ORDER BY CASE room_type
                WHEN 'Suite' THEN 1
                WHEN 'Deluxe' THEN 2
                WHEN 'Double' THEN 3
                ELSE 4
            END, room_number ASC
            LIMIT 3;
        """
        featured_rooms = query_db(sql)
    except Exception as e:
        flash(f"Database notice: Unable to load rooms ({e}).", "error")

    return render_template("home.html", featured_rooms=featured_rooms)


@app.route("/newsletter", methods=["POST"])
def newsletter():
    email = request.form.get("email", "").strip()
    if email:
        flash("Thank you. Your address has been inscribed for seasonal dispatches from Hartwell Estate.", "success")
    else:
        flash("Please provide a valid electronic mail address.", "error")
    return redirect(url_for("home"))


# =====================================================
# 2. DASHBOARD (/dashboard)
# =====================================================
@app.route("/dashboard")
def dashboard():
    stats = {
        "total_guests": 0,
        "total_rooms": 0,
        "active_reservations": 0,
        "total_revenue": Decimal("0.00")
    }
    latest_reservations = []
    revenue_by_method = []
    max_method_rev = Decimal("1.00")

    try:
        g_row = query_db("SELECT COUNT(*) AS cnt FROM Guest;", one=True)
        r_row = query_db("SELECT COUNT(*) AS cnt FROM Room;", one=True)
        a_row = query_db(
            "SELECT COUNT(*) AS cnt FROM Reservation WHERE status IN ('Booked', 'Checked-in');",
            one=True
        )
        rev_row = query_db("SELECT COALESCE(SUM(payment_amount), 0) AS total FROM Payment;", one=True)

        stats["total_guests"] = g_row["cnt"] if g_row else 0
        stats["total_rooms"] = r_row["cnt"] if r_row else 0
        stats["active_reservations"] = a_row["cnt"] if a_row else 0
        stats["total_revenue"] = rev_row["total"] if rev_row else Decimal("0.00")

        latest_sql = """
            SELECT r.reservation_id, r.booking_date, r.check_in_date, r.check_out_date, r.status,
                   g.fname, g.minit, g.lname,
                   COALESCE(STRING_AGG(rm.room_number, ', ' ORDER BY rm.room_number), 'None') AS room_numbers
            FROM Reservation r
            JOIN Guest g ON r.guest_id = g.guest_id
            LEFT JOIN Reservation_Room rr ON r.reservation_id = rr.reservation_id
            LEFT JOIN Room rm ON rr.room_id = rm.room_id
            GROUP BY r.reservation_id, g.guest_id
            ORDER BY r.booking_date DESC, r.reservation_id DESC
            LIMIT 5;
        """
        latest_reservations = query_db(latest_sql)

        method_sql = """
            SELECT payment_method,
                   COUNT(*) AS tx_count,
                   COALESCE(SUM(payment_amount), 0) AS method_total
            FROM Payment
            GROUP BY payment_method
            ORDER BY method_total DESC;
        """
        revenue_by_method = query_db(method_sql)
        if revenue_by_method:
            highest = max(row["method_total"] for row in revenue_by_method)
            if highest > 0:
                max_method_rev = highest

    except Exception as e:
        flash(f"Error loading dashboard figures: {e}", "error")

    return render_template(
        "dashboard.html",
        stats=stats,
        latest_reservations=latest_reservations,
        revenue_by_method=revenue_by_method,
        max_method_rev=max_method_rev
    )


# =====================================================
# 3. GUESTS (/guests)
# =====================================================
@app.route("/guests")
def guests():
    q = request.args.get("q", "").strip()
    guest_list = []
    try:
        if q:
            pattern = f"%{q}%"
            sql = """
                SELECT * FROM Guest
                WHERE fname ILIKE %s
                   OR lname ILIKE %s
                   OR (fname || ' ' || lname) ILIKE %s
                   OR phone ILIKE %s
                ORDER BY guest_id ASC;
            """
            guest_list = query_db(sql, (pattern, pattern, pattern, pattern))
        else:
            guest_list = query_db("SELECT * FROM Guest ORDER BY guest_id ASC;")
    except Exception as e:
        flash(f"Unable to fetch guests: {e}", "error")

    return render_template("guests.html", guests=guest_list, q=q)


@app.route("/guests/new", methods=["GET", "POST"])
def add_guest():
    if request.method == "POST":
        fname = request.form.get("fname", "").strip()
        minit = request.form.get("minit", "").strip() or None
        lname = request.form.get("lname", "").strip()
        phone = request.form.get("phone", "").strip()
        email = request.form.get("email", "").strip()

        if not fname or not lname or not phone or not email:
            flash("First name, last name, telephone, and email are required.", "error")
            return render_template("guest_form.html", guest=request.form, action="Add")

        try:
            sql = """
                INSERT INTO Guest (fname, minit, lname, phone, email)
                VALUES (%s, %s, %s, %s, %s);
            """
            execute_db(sql, (fname, minit, lname, phone, email))
            flash(f"Guest {fname} {lname} registered in the estate ledger.", "success")
            return redirect(url_for("guests"))
        except Exception as e:
            flash(f"Could not register guest (phone and email must be unique): {e}", "error")
            return render_template("guest_form.html", guest=request.form, action="Add")

    return render_template("guest_form.html", guest={}, action="Add")


@app.route("/guests/<int:guest_id>/edit", methods=["GET", "POST"])
def edit_guest(guest_id):
    guest = query_db("SELECT * FROM Guest WHERE guest_id = %s;", (guest_id,), one=True)
    if not guest:
        flash("Guest record not found.", "error")
        return redirect(url_for("guests"))

    if request.method == "POST":
        fname = request.form.get("fname", "").strip()
        minit = request.form.get("minit", "").strip() or None
        lname = request.form.get("lname", "").strip()
        phone = request.form.get("phone", "").strip()
        email = request.form.get("email", "").strip()

        if not fname or not lname or not phone or not email:
            flash("First name, last name, telephone, and email are required.", "error")
            return render_template("guest_form.html", guest=request.form, action="Edit", guest_id=guest_id)

        try:
            sql = """
                UPDATE Guest
                SET fname = %s, minit = %s, lname = %s, phone = %s, email = %s
                WHERE guest_id = %s;
            """
            execute_db(sql, (fname, minit, lname, phone, email, guest_id))
            flash(f"Guest #{guest_id} details updated.", "success")
            return redirect(url_for("guests"))
        except Exception as e:
            flash(f"Error updating guest: {e}", "error")

    return render_template("guest_form.html", guest=guest, action="Edit", guest_id=guest_id)


@app.route("/guests/<int:guest_id>/delete", methods=["POST"])
def delete_guest(guest_id):
    try:
        execute_db("DELETE FROM Guest WHERE guest_id = %s;", (guest_id,))
        flash(f"Guest #{guest_id} and any associated reservations (ON DELETE CASCADE) have been removed.", "success")
    except Exception as e:
        flash(f"Error deleting guest: {e}", "error")
    return redirect(url_for("guests"))


# =====================================================
# 4. ROOMS (/rooms)
# =====================================================
@app.route("/rooms")
def rooms():
    room_type = request.args.get("room_type", "").strip()
    availability = request.args.get("availability", "").strip()

    conditions = []
    params = []
    if room_type:
        conditions.append("room_type = %s")
        params.append(room_type)
    if availability:
        conditions.append("availability = %s")
        params.append(availability)

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    room_list = []
    try:
        room_list = query_db(f"SELECT * FROM Room {where_clause} ORDER BY room_number ASC;", tuple(params))
    except Exception as e:
        flash(f"Error loading rooms: {e}", "error")

    return render_template(
        "rooms.html",
        rooms=room_list,
        selected_type=room_type,
        selected_availability=availability
    )


@app.route("/rooms/new", methods=["GET", "POST"])
def add_room():
    if request.method == "POST":
        room_number = request.form.get("room_number", "").strip()
        room_type = request.form.get("room_type", "").strip()
        price = request.form.get("price", "").strip()
        availability = request.form.get("availability", "Available").strip()

        if not room_number or room_type not in ("Single", "Double", "Deluxe", "Suite") or not price:
            flash("Please provide a valid room number, sanctuary type, and nightly tariff in ₹.", "error")
            return render_template("room_form.html", room=request.form, action="Add")

        try:
            price_val = Decimal(price)
            if price_val <= 0:
                raise ValueError("Tariff must be positive.")
            sql = """
                INSERT INTO Room (room_number, room_type, price, availability)
                VALUES (%s, %s, %s, %s);
            """
            execute_db(sql, (room_number, room_type, price_val, availability))
            flash(f"Room {room_number} ({room_type}) added to the estate inventory.", "success")
            return redirect(url_for("rooms"))
        except Exception as e:
            flash(f"Could not add room: {e}", "error")
            return render_template("room_form.html", room=request.form, action="Add")

    return render_template("room_form.html", room={"availability": "Available"}, action="Add")


@app.route("/rooms/<int:room_id>/edit", methods=["GET", "POST"])
def edit_room(room_id):
    room = query_db("SELECT * FROM Room WHERE room_id = %s;", (room_id,), one=True)
    if not room:
        flash("Room not found.", "error")
        return redirect(url_for("rooms"))

    if request.method == "POST":
        room_number = request.form.get("room_number", "").strip()
        room_type = request.form.get("room_type", "").strip()
        price = request.form.get("price", "").strip()
        availability = request.form.get("availability", "").strip()

        try:
            price_val = Decimal(price)
            sql = """
                UPDATE Room
                SET room_number = %s, room_type = %s, price = %s, availability = %s
                WHERE room_id = %s;
            """
            execute_db(sql, (room_number, room_type, price_val, availability, room_id))
            flash(f"Room {room_number} updated.", "success")
            return redirect(url_for("rooms"))
        except Exception as e:
            flash(f"Error updating room: {e}", "error")

    return render_template("room_form.html", room=room, action="Edit", room_id=room_id)


@app.route("/rooms/<int:room_id>/delete", methods=["POST"])
def delete_room(room_id):
    try:
        # Delete room only if it has no rows in Reservation_Room
        linked = query_db(
            "SELECT COUNT(*) AS cnt FROM Reservation_Room WHERE room_id = %s;",
            (room_id,),
            one=True
        )
        if linked and linked["cnt"] > 0:
            flash(
                "Cannot delete this room because it is referenced in existing Reservation_Room records.",
                "error"
            )
            return redirect(url_for("rooms"))

        execute_db("DELETE FROM Room WHERE room_id = %s;", (room_id,))
        flash(f"Room #{room_id} deleted from inventory.", "success")
    except Exception as e:
        flash(f"Error deleting room: {e}", "error")
    return redirect(url_for("rooms"))


# =====================================================
# 5. RESERVATIONS (/reservations)
# =====================================================
def get_free_rooms_for_dates(check_in, check_out):
    """
    Returns rooms not in Maintenance and not booked in overlapping active reservations.
    """
    sql = """
        SELECT * FROM Room
        WHERE availability <> 'Maintenance'
          AND room_id NOT IN (
            SELECT rr.room_id FROM Reservation_Room rr
            JOIN Reservation r ON rr.reservation_id = r.reservation_id
            WHERE r.status <> 'Cancelled'
              AND r.check_in_date < %s
              AND r.check_out_date > %s
          )
        ORDER BY room_number ASC;
    """
    return query_db(sql, (check_out, check_in))


@app.route("/api/free-rooms")
def api_free_rooms():
    check_in = request.args.get("check_in", "").strip()
    check_out = request.args.get("check_out", "").strip()
    if not check_in or not check_out or check_out <= check_in:
        return jsonify({"rooms": []})
    try:
        rooms = get_free_rooms_for_dates(check_in, check_out)
        for r in rooms:
            r["price"] = float(r["price"])
        return jsonify({"rooms": rooms})
    except Exception as e:
        return jsonify({"rooms": [], "error": str(e)}), 500


@app.route("/reservations")
def reservations():
    res_list = []
    try:
        sql = """
            SELECT r.reservation_id, r.booking_date, r.check_in_date, r.check_out_date, r.status,
                   g.fname AS guest_fname, g.minit AS guest_minit, g.lname AS guest_lname,
                   s.fname AS staff_fname, s.lname AS staff_lname,
                   COALESCE(STRING_AGG(rm.room_number, ', ' ORDER BY rm.room_number), '—') AS room_numbers,
                   p.payment_id, p.payment_amount, p.payment_method
            FROM Reservation r
            JOIN Guest g ON r.guest_id = g.guest_id
            LEFT JOIN Staff s ON r.staff_id = s.staff_id
            LEFT JOIN Reservation_Room rr ON r.reservation_id = rr.reservation_id
            LEFT JOIN Room rm ON rr.room_id = rm.room_id
            LEFT JOIN Payment p ON r.reservation_id = p.reservation_id
            GROUP BY r.reservation_id, g.guest_id, s.staff_id, p.payment_id
            ORDER BY r.reservation_id DESC;
        """
        res_list = query_db(sql)
    except Exception as e:
        flash(f"Error loading reservations: {e}", "error")

    return render_template("reservations.html", reservations=res_list)


@app.route("/reservations/new", methods=["GET", "POST"])
def add_reservation():
    guests_list = query_db("SELECT * FROM Guest ORDER BY lname ASC, fname ASC;")
    staff_list = query_db("SELECT * FROM Staff ORDER BY lname ASC;")
    preselect_room_id = request.args.get("room_id", type=int)
    default_in = request.args.get("check_in") or date.today().isoformat()
    default_out = request.args.get("check_out") or ""

    if request.method == "POST":
        guest_id = request.form.get("guest_id", type=int)
        staff_id = request.form.get("staff_id", type=int) or None
        check_in_str = request.form.get("check_in_date", "").strip()
        check_out_str = request.form.get("check_out_date", "").strip()
        room_ids = [int(rid) for rid in request.form.getlist("room_ids") if rid.isdigit()]

        record_payment = request.form.get("record_payment") == "yes"
        payment_method = request.form.get("payment_method", "").strip()
        payment_amount = request.form.get("payment_amount", "").strip()
        payment_date = request.form.get("payment_date") or date.today().isoformat()

        # Server-side validation
        try:
            ci_date = datetime.strptime(check_in_str, "%Y-%m-%d").date()
            co_date = datetime.strptime(check_out_str, "%Y-%m-%d").date()
        except ValueError:
            flash("Please provide valid check-in and check-out dates.", "error")
            return redirect(url_for("add_reservation"))

        if ci_date < date.today():
            flash("Check-in date cannot be in the past.", "error")
            return redirect(url_for("add_reservation"))

        if co_date <= ci_date:
            flash("Check-out date must be strictly after check-in date.", "error")
            return redirect(url_for("add_reservation"))

        if not guest_id or not room_ids:
            flash("Please select a guest and at least one available room.", "error")
            return redirect(url_for("add_reservation"))

        # Single atomic database transaction for Reservation + Reservation_Room + optional Payment
        conn = None
        try:
            conn = get_db_connection()
            with conn.cursor() as cur:
                # Verify selected rooms are still free in this date window
                cur.execute(
                    """
                    SELECT room_id, room_number FROM Room
                    WHERE room_id = ANY(%s)
                      AND (
                        availability = 'Maintenance'
                        OR room_id IN (
                            SELECT rr.room_id FROM Reservation_Room rr
                            JOIN Reservation r ON rr.reservation_id = r.reservation_id
                            WHERE r.status <> 'Cancelled'
                              AND r.check_in_date < %s
                              AND r.check_out_date > %s
                        )
                      );
                    """,
                    (room_ids, co_date, ci_date)
                )
                conflicts = cur.fetchall()
                if conflicts:
                    conflict_nums = ", ".join(c["room_number"] for c in conflicts)
                    raise ValueError(f"Room(s) {conflict_nums} are already booked or in maintenance for those dates.")

                # 1. INSERT Reservation (GENERATED ALWAYS AS IDENTITY)
                cur.execute(
                    """
                    INSERT INTO Reservation (booking_date, check_in_date, check_out_date, guest_id, staff_id, status)
                    VALUES (CURRENT_DATE, %s, %s, %s, %s, 'Booked')
                    RETURNING reservation_id;
                    """,
                    (ci_date, co_date, guest_id, staff_id)
                )
                new_res_id = cur.fetchone()["reservation_id"]

                # 2. INSERT one Reservation_Room row per selected room
                for rid in room_ids:
                    cur.execute(
                        "INSERT INTO Reservation_Room (reservation_id, room_id) VALUES (%s, %s);",
                        (new_res_id, rid)
                    )

                # 3. Optionally INSERT Payment
                if record_payment and payment_method and payment_amount:
                    amt_val = Decimal(payment_amount)
                    if amt_val <= 0:
                        raise ValueError("Payment amount must be greater than zero.")
                    cur.execute(
                        """
                        INSERT INTO Payment (payment_date, payment_method, payment_amount, reservation_id)
                        VALUES (%s, %s, %s, %s);
                        """,
                        (payment_date, payment_method, amt_val, new_res_id)
                    )

            conn.commit()
            flash(f"Reservation #{new_res_id} confirmed.", "success")
            return redirect(url_for("reservations"))
        except Exception as e:
            if conn:
                conn.rollback()
            flash(f"Reservation failed and rolled back: {e}", "error")
        finally:
            if conn:
                conn.close()

    # Load initially available rooms
    free_rooms = []
    try:
        if default_in and default_out and default_out > default_in:
            free_rooms = get_free_rooms_for_dates(default_in, default_out)
        else:
            free_rooms = query_db("SELECT * FROM Room WHERE availability <> 'Maintenance' ORDER BY room_number ASC;")
    except Exception:
        pass

    return render_template(
        "reservation_form.html",
        action="Add",
        guests=guests_list,
        staff=staff_list,
        rooms=free_rooms,
        preselect_room_id=preselect_room_id,
        default_in=default_in,
        default_out=default_out,
        reservation={}
    )


@app.route("/reservations/<int:reservation_id>/edit", methods=["GET", "POST"])
def edit_reservation(reservation_id):
    res = query_db("SELECT * FROM Reservation WHERE reservation_id = %s;", (reservation_id,), one=True)
    if not res:
        flash("Reservation not found.", "error")
        return redirect(url_for("reservations"))

    guests_list = query_db("SELECT * FROM Guest ORDER BY lname ASC;")
    staff_list = query_db("SELECT * FROM Staff ORDER BY lname ASC;")

    if request.method == "POST":
        check_in_str = request.form.get("check_in_date", "").strip()
        check_out_str = request.form.get("check_out_date", "").strip()
        staff_id = request.form.get("staff_id", type=int) or None
        status = request.form.get("status", "Booked").strip()

        if check_out_str <= check_in_str:
            flash("Check-out date must be strictly after check-in date.", "error")
            return redirect(url_for("edit_reservation", reservation_id=reservation_id))

        try:
            sql = """
                UPDATE Reservation
                SET check_in_date = %s, check_out_date = %s, staff_id = %s, status = %s
                WHERE reservation_id = %s;
            """
            execute_db(sql, (check_in_str, check_out_str, staff_id, status, reservation_id))
            flash(f"Reservation #{reservation_id} updated.", "success")
            return redirect(url_for("reservations"))
        except Exception as e:
            flash(f"Error updating reservation: {e}", "error")

    return render_template(
        "reservation_form.html",
        action="Edit",
        reservation=res,
        guests=guests_list,
        staff=staff_list,
        rooms=[]
    )


@app.route("/reservations/<int:reservation_id>/cancel", methods=["POST"])
def cancel_reservation(reservation_id):
    try:
        execute_db(
            "UPDATE Reservation SET status = 'Cancelled' WHERE reservation_id = %s;",
            (reservation_id,)
        )
        flash(f"Reservation #{reservation_id} status set to Cancelled.", "success")
    except Exception as e:
        flash(f"Could not cancel reservation: {e}", "error")
    return redirect(url_for("reservations"))


@app.route("/reservations/<int:reservation_id>/delete", methods=["POST"])
def delete_reservation(reservation_id):
    try:
        execute_db("DELETE FROM Reservation WHERE reservation_id = %s;", (reservation_id,))
        flash(f"Reservation #{reservation_id} permanently deleted.", "success")
    except Exception as e:
        flash(f"Could not delete reservation: {e}", "error")
    return redirect(url_for("reservations"))


# =====================================================
# 6. PAYMENTS (/payments)
# =====================================================
@app.route("/payments", methods=["GET", "POST"])
def payments():
    if request.method == "POST":
        reservation_id = request.form.get("reservation_id", type=int)
        payment_date = request.form.get("payment_date") or date.today().isoformat()
        payment_method = request.form.get("payment_method", "").strip()
        payment_amount = request.form.get("payment_amount", "").strip()

        try:
            amt = Decimal(payment_amount)
            if amt <= 0:
                raise ValueError("Amount must be positive.")
            sql = """
                INSERT INTO Payment (payment_date, payment_method, payment_amount, reservation_id)
                VALUES (%s, %s, %s, %s);
            """
            execute_db(sql, (payment_date, payment_method, amt, reservation_id))
            flash(f"Payment recorded for Reservation #{reservation_id}.", "success")
        except Exception as e:
            flash(f"Error recording payment: {e}", "error")
        return redirect(url_for("payments"))

    payment_list = []
    unpaid_reservations = []
    try:
        payment_list = query_db(
            """
            SELECT p.*, g.fname, g.lname, r.check_in_date, r.check_out_date
            FROM Payment p
            JOIN Reservation r ON p.reservation_id = r.reservation_id
            JOIN Guest g ON r.guest_id = g.guest_id
            ORDER BY p.payment_date DESC, p.payment_id DESC;
            """
        )
        unpaid_reservations = query_db(
            """
            SELECT r.reservation_id, r.check_in_date, r.check_out_date, g.fname, g.lname,
                   COALESCE(SUM(rm.price) * (r.check_out_date - r.check_in_date), 0) AS est_total
            FROM Reservation r
            JOIN Guest g ON r.guest_id = g.guest_id
            LEFT JOIN Reservation_Room rr ON r.reservation_id = rr.reservation_id
            LEFT JOIN Room rm ON rr.room_id = rm.room_id
            LEFT JOIN Payment p ON r.reservation_id = p.reservation_id
            WHERE p.payment_id IS NULL AND r.status <> 'Cancelled'
            GROUP BY r.reservation_id, g.guest_id
            ORDER BY r.reservation_id DESC;
            """
        )
    except Exception as e:
        flash(f"Error loading payments: {e}", "error")

    return render_template(
        "payments.html",
        payments=payment_list,
        unpaid_reservations=unpaid_reservations
    )


@app.route("/payments/<int:payment_id>/edit", methods=["POST"])
def edit_payment(payment_id):
    payment_method = request.form.get("payment_method", "").strip()
    payment_amount = request.form.get("payment_amount", "").strip()
    payment_date = request.form.get("payment_date", "").strip()
    try:
        amt = Decimal(payment_amount)
        execute_db(
            """
            UPDATE Payment
            SET payment_method = %s, payment_amount = %s, payment_date = %s
            WHERE payment_id = %s;
            """,
            (payment_method, amt, payment_date, payment_id)
        )
        flash(f"Payment #{payment_id} updated.", "success")
    except Exception as e:
        flash(f"Error updating payment: {e}", "error")
    return redirect(url_for("payments"))


@app.route("/payments/<int:payment_id>/delete", methods=["POST"])
def delete_payment(payment_id):
    try:
        execute_db("DELETE FROM Payment WHERE payment_id = %s;", (payment_id,))
        flash(f"Payment #{payment_id} deleted.", "success")
    except Exception as e:
        flash(f"Error deleting payment: {e}", "error")
    return redirect(url_for("payments"))


# =====================================================
# 7. SEARCH (/search)
# =====================================================
@app.route("/search")
def search():
    tab = request.args.get("tab", "availability")
    check_in = request.args.get("check_in", "").strip()
    check_out = request.args.get("check_out", "").strip()
    room_type = request.args.get("room_type", "").strip()
    availability = request.args.get("availability", "").strip()
    guest_q = request.args.get("guest_q", "").strip()
    res_guest = request.args.get("res_guest", "").strip()
    res_from = request.args.get("res_from", "").strip()
    res_to = request.args.get("res_to", "").strip()

    available_rooms = []
    guest_results = []
    room_results = []
    res_results = []

    try:
        # 1. Available rooms for dates query (used by Home availability bar)
        if check_in and check_out and check_out > check_in:
            sql = """
                SELECT * FROM Room
                WHERE availability <> 'Maintenance'
                  AND room_id NOT IN (
                    SELECT rr.room_id FROM Reservation_Room rr
                    JOIN Reservation r ON rr.reservation_id = r.reservation_id
                    WHERE r.status <> 'Cancelled'
                      AND r.check_in_date < %s
                      AND r.check_out_date > %s
                  )
            """
            params = [check_out, check_in]
            if room_type:
                sql += " AND room_type = %s"
                params.append(room_type)
            sql += " ORDER BY room_number ASC;"
            available_rooms = query_db(sql, tuple(params))

        # 2. Guests by name or phone
        if guest_q:
            pat = f"%{guest_q}%"
            guest_results = query_db(
                """
                SELECT * FROM Guest
                WHERE fname ILIKE %s OR lname ILIKE %s OR phone ILIKE %s
                ORDER BY lname ASC;
                """,
                (pat, pat, pat)
            )

        # 3. Rooms by type / availability
        if tab == "rooms" or room_type or availability:
            conds = []
            r_params = []
            if room_type:
                conds.append("room_type = %s")
                r_params.append(room_type)
            if availability:
                conds.append("availability = %s")
                r_params.append(availability)
            w = ("WHERE " + " AND ".join(conds)) if conds else ""
            room_results = query_db(f"SELECT * FROM Room {w} ORDER BY room_number ASC;", tuple(r_params))

        # 4. Reservations by guest name or date range
        if tab == "reservations" or res_guest or res_from or res_to:
            r_conds = []
            res_params = []
            if res_guest:
                r_conds.append("(g.fname ILIKE %s OR g.lname ILIKE %s)")
                res_params.extend([f"%{res_guest}%", f"%{res_guest}%"])
            if res_from:
                r_conds.append("r.check_in_date >= %s")
                res_params.append(res_from)
            if res_to:
                r_conds.append("r.check_out_date <= %s")
                res_params.append(res_to)
            rw = ("WHERE " + " AND ".join(r_conds)) if r_conds else ""
            res_results = query_db(
                f"""
                SELECT r.*, g.fname, g.lname,
                       COALESCE(STRING_AGG(rm.room_number, ', ' ORDER BY rm.room_number), '—') AS room_numbers
                FROM Reservation r
                JOIN Guest g ON r.guest_id = g.guest_id
                LEFT JOIN Reservation_Room rr ON r.reservation_id = rr.reservation_id
                LEFT JOIN Room rm ON rr.room_id = rm.room_id
                {rw}
                GROUP BY r.reservation_id, g.guest_id
                ORDER BY r.check_in_date DESC;
                """,
                tuple(res_params)
            )
    except Exception as e:
        flash(f"Search error: {e}", "error")

    return render_template(
        "search.html",
        tab=tab,
        check_in=check_in,
        check_out=check_out,
        room_type=room_type,
        availability=availability,
        guest_q=guest_q,
        res_guest=res_guest,
        res_from=res_from,
        res_to=res_to,
        available_rooms=available_rooms,
        guest_results=guest_results,
        room_results=room_results,
        res_results=res_results
    )


# =====================================================
# 8. REPORTS (/reports)
# =====================================================
@app.route("/reports")
def reports():
    sort_order = request.args.get("sort", "desc")
    order_dir = "ASC" if sort_order == "asc" else "DESC"

    revenue_report = []
    revenue_summary = {"total_count": 0, "grand_total": Decimal("0.00"), "overall_avg": Decimal("0.00")}
    guest_history = []
    staff_workload = []

    try:
        # Report 1: Revenue by payment method (GROUP BY + COUNT/SUM/AVG)
        revenue_report = query_db(
            """
            SELECT payment_method,
                   COUNT(*) AS tx_count,
                   SUM(payment_amount) AS total_amount,
                   AVG(payment_amount) AS avg_amount
            FROM Payment
            GROUP BY payment_method
            ORDER BY total_amount DESC;
            """
        )
        summary_row = query_db(
            """
            SELECT COUNT(*) AS total_count,
                   COALESCE(SUM(payment_amount), 0) AS grand_total,
                   COALESCE(AVG(payment_amount), 0) AS overall_avg
            FROM Payment;
            """,
            one=True
        )
        if summary_row:
            revenue_summary = summary_row

        # Report 2: Reservation history per guest
        guest_history = query_db(
            f"""
            SELECT g.guest_id, g.fname, g.minit, g.lname, g.email,
                   r.reservation_id, r.booking_date, r.check_in_date, r.check_out_date, r.status,
                   COALESCE(STRING_AGG(rm.room_number || ' (' || rm.room_type || ')', ', ' ORDER BY rm.room_number), '—') AS rooms_summary,
                   p.payment_method, p.payment_amount
            FROM Guest g
            JOIN Reservation r ON g.guest_id = r.guest_id
            LEFT JOIN Reservation_Room rr ON r.reservation_id = rr.reservation_id
            LEFT JOIN Room rm ON rr.room_id = rm.room_id
            LEFT JOIN Payment p ON r.reservation_id = p.reservation_id
            GROUP BY g.guest_id, r.reservation_id, p.payment_id
            ORDER BY r.check_in_date {order_dir};
            """
        )

        # Report 3: Staff workload
        staff_workload = query_db(
            """
            SELECT s.staff_id, s.fname, s.minit, s.lname, s.role, s.phone,
                   COUNT(r.reservation_id) AS total_assigned,
                   COUNT(CASE WHEN r.status IN ('Booked', 'Checked-in') THEN 1 END) AS active_assigned
            FROM Staff s
            LEFT JOIN Reservation r ON s.staff_id = r.staff_id
            GROUP BY s.staff_id
            ORDER BY total_assigned DESC, s.lname ASC;
            """
        )
    except Exception as e:
        flash(f"Error generating reports: {e}", "error")

    return render_template(
        "reports.html",
        revenue_report=revenue_report,
        revenue_summary=revenue_summary,
        guest_history=guest_history,
        staff_workload=staff_workload,
        sort_order=sort_order
    )


if __name__ == "__main__":
    app.run(debug=True, port=5000)
`
  }
];
