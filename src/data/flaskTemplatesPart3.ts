import { FlaskProjectFile } from './flaskSourceFiles';

export const FLASK_TEMPLATE_FILES_PART3: FlaskProjectFile[] = [
  {
    path: 'templates/payments.html',
    language: 'html',
    description: 'Payments management screen with ₹ amounts, new payment form for unpaid reservations, edit, and delete.',
    content: `{% extends "base.html" %}
{% block title %}Payments — Hartwell Estate{% endblock %}

{% block content %}
<div class="container admin-page">
  <div class="page-header">
    <div>
      <div class="micro-label">ESTATE ACCOUNTS &bull; INR (₹)</div>
      <h1 class="page-title">Payment Settlements</h1>
    </div>
  </div>

  <!-- Add Payment for Unpaid Reservation -->
  <div class="panel-card" style="margin-bottom: 2rem;">
    <div class="panel-header">
      <h2 class="panel-title">Record New Payment</h2>
      <span class="micro-label">1-TO-1 UNIQUE RESERVATION SETTLEMENT</span>
    </div>
    {% if unpaid_reservations %}
      <form action="{{ url_for('payments') }}" method="POST" class="editorial-form">
        <div class="form-row-4">
          <div class="form-group">
            <label class="micro-label" for="reservation_id">UNPAID RESERVATION *</label>
            <select id="reservation_id" name="reservation_id" required onchange="const opt=this.options[this.selectedIndex]; if(opt.dataset.est) document.getElementById('pay_amt').value=opt.dataset.est;">
              <option value="">Select reservation...</option>
              {% for ur in unpaid_reservations %}
                <option value="{{ ur.reservation_id }}" data-est="{{ ur.est_total }}">
                  #{{ ur.reservation_id }} — {{ ur.fname }} {{ ur.lname }} (Est: {{ ur.est_total | inr }})
                </option>
              {% endfor %}
            </select>
          </div>
          <div class="form-group">
            <label class="micro-label" for="pay_method">METHOD *</label>
            <select id="pay_method" name="payment_method" required>
              <option value="Card">Card</option>
              <option value="UPI">UPI</option>
              <option value="NetBanking">NetBanking</option>
              <option value="Cash">Cash</option>
            </select>
          </div>
          <div class="form-group">
            <label class="micro-label" for="pay_amt">AMOUNT IN ₹ *</label>
            <input type="number" step="0.01" min="1" id="pay_amt" name="payment_amount" required>
          </div>
          <div class="form-group">
            <label class="micro-label" for="pay_date">PAYMENT DATE *</label>
            <input type="date" id="pay_date" name="payment_date" value="{{ today_str }}" required>
          </div>
        </div>
        <button type="submit" class="btn btn-rust">Record Payment</button>
      </form>
    {% else %}
      <p class="table-sub">All active reservations have been settled.</p>
    {% endif %}
  </div>

  <!-- Payments Table -->
  <div class="panel-card">
    <div class="panel-header">
      <h2 class="panel-title">Settled Receipts</h2>
    </div>
    {% if payments %}
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>PAYMENT ID</th>
              <th>RESERVATION</th>
              <th>GUEST</th>
              <th>DATE</th>
              <th>METHOD</th>
              <th>AMOUNT (₹)</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {% for p in payments %}
              <tr>
                <td class="tabular-nums">#{{ p.payment_id }}</td>
                <td class="tabular-nums">Reservation #{{ p.reservation_id }}</td>
                <td><strong>{{ p.fname }} {{ p.lname }}</strong></td>
                <td class="tabular-nums">{{ p.payment_date }}</td>
                <td>{{ p.payment_method }}</td>
                <td class="tabular-nums"><strong>{{ p.payment_amount | inr }}</strong></td>
                <td class="actions-cell">
                  <form action="{{ url_for('edit_payment', payment_id=p.payment_id) }}" method="POST" class="inline-edit-payment">
                    <input type="hidden" name="payment_date" value="{{ p.payment_date }}">
                    <select name="payment_method" class="select-sm">
                      {% for m in ['Cash', 'Card', 'UPI', 'NetBanking'] %}
                        <option value="{{ m }}" {% if p.payment_method == m %}selected{% endif %}>{{ m }}</option>
                      {% endfor %}
                    </select>
                    <input type="number" step="0.01" name="payment_amount" value="{{ p.payment_amount }}" class="input-sm tabular-nums" style="width: 110px;">
                    <button type="submit" class="btn-table">Update</button>
                  </form>
                  <form action="{{ url_for('delete_payment', payment_id=p.payment_id) }}" method="POST" style="display:inline;" onsubmit="return confirm('Delete Payment #{{ p.payment_id }}?');">
                    <button type="submit" class="btn-table btn-table-danger">Delete</button>
                  </form>
                </td>
              </tr>
            {% endfor %}
          </tbody>
        </table>
      </div>
    {% else %}
      <div class="empty-state-box">No payments recorded yet.</div>
    {% endif %}
  </div>
</div>
{% endblock %}
`
  },
  {
    path: 'templates/search.html',
    language: 'html',
    description: 'Multi-section search page: available rooms for dates, guests by name/phone, rooms by type/status, reservations by guest/dates.',
    content: `{% extends "base.html" %}
{% block title %}Search & Availability — Hartwell Estate{% endblock %}

{% block content %}
<div class="container admin-page">
  <div class="page-header">
    <div>
      <div class="micro-label">ESTATE DIRECTORY &amp; AVAILABILITY</div>
      <h1 class="page-title">Search Sanctuary Records</h1>
    </div>
  </div>

  <!-- 1. Available Rooms for Dates (Used by Home Availability Bar) -->
  <div class="panel-card" style="margin-bottom: 2rem;">
    <div class="panel-header">
      <h2 class="panel-title">1. Available Sanctuary Rooms by Date Window</h2>
      <span class="micro-label">EXCLUDES MAINTENANCE &amp; OVERLAPPING BOOKINGS</span>
    </div>
    <form action="{{ url_for('search') }}" method="GET" class="editorial-form">
      <input type="hidden" name="tab" value="availability">
      <div class="form-row-4">
        <div class="form-group">
          <label class="micro-label">ARRIVAL (CHECK-IN)</label>
          <input type="date" name="check_in" value="{{ check_in }}" required>
        </div>
        <div class="form-group">
          <label class="micro-label">DEPARTURE (CHECK-OUT)</label>
          <input type="date" name="check_out" value="{{ check_out }}" required>
        </div>
        <div class="form-group">
          <label class="micro-label">ROOM TYPE</label>
          <select name="room_type">
            <option value="">All Types</option>
            {% for t in ['Single', 'Double', 'Deluxe', 'Suite'] %}
              <option value="{{ t }}" {% if room_type == t %}selected{% endif %}>{{ t }}</option>
            {% endfor %}
          </select>
        </div>
        <div class="form-group" style="display:flex; align-items:flex-end;">
          <button type="submit" class="btn btn-rust btn-block">Check Free Rooms</button>
        </div>
      </div>
    </form>

    {% if check_in and check_out %}
      <div style="margin-top: 1.5rem;">
        <div class="micro-label" style="margin-bottom: 0.75rem;">
          FREE ROOMS FOR {{ check_in }} &rarr; {{ check_out }} ({{ available_rooms | length }} FOUND)
        </div>
        {% if available_rooms %}
          <div class="rooms-grid-3">
            {% for rm in available_rooms %}
              {% set meta = room_meta.get(rm.room_type, room_meta['Double']) %}
              <article class="room-card">
                <div class="room-card-media">
                  <img src="{{ url_for('static', filename=meta.img) }}" alt="Room {{ rm.room_number }}" onerror="this.style.display='none'">
                  <span class="price-badge">{{ rm.price | inr }} / night</span>
                </div>
                <div class="room-card-body">
                  <div class="room-card-meta">ROOM {{ rm.room_number }} &bull; {{ rm.room_type | upper }}</div>
                  <h3 class="room-card-title">{{ meta.name }}</h3>
                  <a href="{{ url_for('add_reservation', room_id=rm.room_id, check_in=check_in, check_out=check_out) }}" class="btn btn-rust btn-block">Reserve for These Dates</a>
                </div>
              </article>
            {% endfor %}
          </div>
        {% else %}
          <div class="empty-state-box">No rooms available for the requested dates.</div>
        {% endif %}
      </div>
    {% endif %}
  </div>

  <!-- 2. Search Guests & Reservations -->
  <div class="dashboard-split">
    <div class="panel-card">
      <div class="panel-header">
        <h2 class="panel-title">2. Search Guests by Name or Phone</h2>
      </div>
      <form action="{{ url_for('search') }}" method="GET" class="inline-search-form" style="margin-bottom: 1rem;">
        <input type="hidden" name="tab" value="guests">
        <input type="text" name="guest_q" value="{{ guest_q }}" placeholder="Enter guest name or phone...">
        <button type="submit" class="btn btn-rust">Find Guest</button>
      </form>
      {% if guest_q %}
        {% if guest_results %}
          <table class="data-table">
            <thead>
              <tr><th>ID</th><th>NAME</th><th>PHONE</th><th>EMAIL</th></tr>
            </thead>
            <tbody>
              {% for g in guest_results %}
                <tr>
                  <td class="tabular-nums">#{{ g.guest_id }}</td>
                  <td><strong>{{ g.fname }} {{ g.lname }}</strong></td>
                  <td class="tabular-nums">{{ g.phone }}</td>
                  <td>{{ g.email }}</td>
                </tr>
              {% endfor %}
            </tbody>
          </table>
        {% else %}
          <div class="empty-state-box">No matching guests found.</div>
        {% endif %}
      {% endif %}
    </div>

    <div class="panel-card">
      <div class="panel-header">
        <h2 class="panel-title">3. Search Reservations by Guest or Dates</h2>
      </div>
      <form action="{{ url_for('search') }}" method="GET" class="editorial-form" style="margin-bottom: 1rem;">
        <input type="hidden" name="tab" value="reservations">
        <div class="form-row-3">
          <input type="text" name="res_guest" value="{{ res_guest }}" placeholder="Guest name...">
          <input type="date" name="res_from" value="{{ res_from }}">
          <input type="date" name="res_to" value="{{ res_to }}">
        </div>
        <button type="submit" class="btn btn-rust" style="margin-top: 0.75rem;">Search Reservations</button>
      </form>
      {% if res_results %}
        <table class="data-table">
          <thead>
            <tr><th>ID</th><th>GUEST</th><th>ROOMS</th><th>DATES</th><th>STATUS</th></tr>
          </thead>
          <tbody>
            {% for r in res_results %}
              <tr>
                <td class="tabular-nums">#{{ r.reservation_id }}</td>
                <td><strong>{{ r.fname }} {{ r.lname }}</strong></td>
                <td class="tabular-nums">{{ r.room_numbers }}</td>
                <td class="tabular-nums">{{ r.check_in_date }} &rarr; {{ r.check_out_date }}</td>
                <td>{{ r.status }}</td>
              </tr>
            {% endfor %}
          </tbody>
        </table>
      {% endif %}
    </div>
  </div>
</div>
{% endblock %}
`
  },
  {
    path: 'templates/reports.html',
    language: 'html',
    description: 'Reports page with Revenue by Method (GROUP BY SUM/COUNT/AVG in ₹), Guest History JOINs, Staff Workload, and Print button.',
    content: `{% extends "base.html" %}
{% block title %}Financial & Estate Reports — Hartwell{% endblock %}

{% block content %}
<div class="container admin-page print-container">
  <div class="page-header">
    <div>
      <div class="micro-label">ESTATE AUDIT &amp; CHRONICLES</div>
      <h1 class="page-title">Management Reports (INR ₹)</h1>
    </div>
    <div class="header-btn-group no-print">
      <button type="button" onclick="window.print()" class="btn btn-rust">Print Reports</button>
    </div>
  </div>

  <!-- REPORT 1: Revenue by Payment Method -->
  <div class="panel-card" style="margin-bottom: 2rem;">
    <div class="panel-header">
      <div>
        <div class="micro-label">REPORT 01 &bull; GROUP BY PAYMENT_METHOD</div>
        <h2 class="panel-title">Revenue by Payment Method</h2>
      </div>
      <span class="micro-label">CURRENCY: INDIAN RUPEES (₹)</span>
    </div>
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>PAYMENT METHOD</th>
            <th class="text-right">TRANSACTION COUNT</th>
            <th class="text-right">TOTAL REVENUE (SUM)</th>
            <th class="text-right">AVERAGE RECEIPT (AVG)</th>
          </tr>
        </thead>
        <tbody>
          {% for row in revenue_report %}
            <tr>
              <td><strong>{{ row.payment_method }}</strong></td>
              <td class="tabular-nums text-right">{{ row.tx_count }}</td>
              <td class="tabular-nums text-right">{{ row.total_amount | inr }}</td>
              <td class="tabular-nums text-right">{{ row.avg_amount | inr }}</td>
            </tr>
          {% endfor %}
        </tbody>
        <tfoot>
          <tr class="table-total-row">
            <td><strong>TOTAL / OVERALL</strong></td>
            <td class="tabular-nums text-right"><strong>{{ revenue_summary.total_count }}</strong></td>
            <td class="tabular-nums text-right"><strong>{{ revenue_summary.grand_total | inr }}</strong></td>
            <td class="tabular-nums text-right"><strong>{{ revenue_summary.overall_avg | inr }}</strong></td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>

  <!-- REPORT 2: Reservation History per Guest -->
  <div class="panel-card" style="margin-bottom: 2rem;">
    <div class="panel-header">
      <div>
        <div class="micro-label">REPORT 02 &bull; MULTI-TABLE JOIN LEDGER</div>
        <h2 class="panel-title">Reservation History per Guest</h2>
      </div>
      <div class="no-print">
        <a href="{{ url_for('reports', sort='desc') }}" class="btn-table {% if sort_order == 'desc' %}active{% endif %}">Newest First</a>
        <a href="{{ url_for('reports', sort='asc') }}" class="btn-table {% if sort_order == 'asc' %}active{% endif %}">Oldest First</a>
      </div>
    </div>
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>GUEST</th>
            <th>RESERVATION</th>
            <th>CHECK-IN &rarr; CHECK-OUT</th>
            <th>ROOMS &amp; TYPES</th>
            <th>STATUS</th>
            <th class="text-right">SETTLEMENT (₹)</th>
          </tr>
        </thead>
        <tbody>
          {% for h in guest_history %}
            <tr>
              <td>
                <strong>{{ h.fname }} {{ h.lname }}</strong>
                <div class="table-sub">{{ h.email }}</div>
              </td>
              <td class="tabular-nums">#{{ h.reservation_id }}</td>
              <td class="tabular-nums">{{ h.check_in_date }} &rarr; {{ h.check_out_date }}</td>
              <td>{{ h.rooms_summary }}</td>
              <td>{{ h.status }}</td>
              <td class="tabular-nums text-right">
                {% if h.payment_amount %}
                  <strong>{{ h.payment_amount | inr }}</strong> ({{ h.payment_method }})
                {% else %}
                  <span class="table-sub">Pending</span>
                {% endif %}
              </td>
            </tr>
          {% endfor %}
        </tbody>
      </table>
    </div>
  </div>

  <!-- REPORT 3: Staff Workload -->
  <div class="panel-card">
    <div class="panel-header">
      <div>
        <div class="micro-label">REPORT 03 &bull; LEFT JOIN STAFF TO RESERVATION</div>
        <h2 class="panel-title">Estate Staff &amp; Concierge Workload</h2>
      </div>
    </div>
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>STAFF ID</th>
            <th>STEWARD / CONCIERGE</th>
            <th>ROLE</th>
            <th>TELEPHONE</th>
            <th class="text-right">ACTIVE ASSIGNMENTS</th>
            <th class="text-right">TOTAL RESERVATIONS</th>
          </tr>
        </thead>
        <tbody>
          {% for s in staff_workload %}
            <tr>
              <td class="tabular-nums">#{{ s.staff_id }}</td>
              <td><strong>{{ s.fname }} {{ s.lname }}</strong></td>
              <td>{{ s.role }}</td>
              <td class="tabular-nums">{{ s.phone }}</td>
              <td class="tabular-nums text-right">{{ s.active_assigned }}</td>
              <td class="tabular-nums text-right"><strong>{{ s.total_assigned }}</strong></td>
            </tr>
          {% endfor %}
        </tbody>
      </table>
    </div>
  </div>
</div>
{% endblock %}
`
  },
  {
    path: 'static/css/style.css',
    language: 'css',
    description: 'Hand-written editorial CSS stylesheet matching the warm cream (#FBF7F0), sand (#EFE8DC), and rust-brown (#8B3E1F) palette.',
    content: `/* =====================================================
   HARTWELL — BOUTIQUE COUNTRY HOTEL STYLESHEET
   Palette:
     Cream Background: #FBF7F0
     Sand Band:        #EFE8DC
     Card Surface:     #FFFFFF
     Warm Grey Border: #E2D9C8
     Primary Rust:     #8B3E1F (Hover: #6E2F15)
     Olive Accent:     #5C6446
     Dark Text:        #2B2620
     Muted Text:       #6E655B
   ===================================================== */

:root {
  --bg-cream: #FBF7F0;
  --bg-sand: #EFE8DC;
  --bg-white: #FFFFFF;
  --border-warm: #E2D9C8;
  --rust: #8B3E1F;
  --rust-hover: #6E2F15;
  --olive: #5C6446;
  --text-dark: #2B2620;
  --text-muted: #6E655B;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background-color: var(--bg-cream);
  color: var(--text-dark);
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 15px;
  line-height: 1.6;
}

h1, h2, h3, h4, .brand-wordmark {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 400;
  color: var(--text-dark);
}

.tabular-nums {
  font-variant-numeric: tabular-nums;
}

.container {
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 24px;
}

.micro-label {
  font-family: 'DM Sans', sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-muted);
}

/* Top Navigation Bar */
.site-header {
  background: var(--bg-cream);
  border-bottom: 1px solid var(--border-warm);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-inner {
  max-width: 1360px;
  margin: 0 auto;
  padding: 14px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.brand-lockup {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.brand-wordmark {
  font-size: 24px;
  text-decoration: none;
  color: var(--text-dark);
  letter-spacing: -0.02em;
}

.brand-tag {
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.main-nav {
  display: flex;
  align-items: center;
  gap: 22px;
}

.nav-link {
  text-decoration: none;
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 500;
  padding: 6px 0;
  border-bottom: 2px solid transparent;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.nav-link:hover,
.nav-link.active {
  color: var(--text-dark);
  border-bottom-color: var(--rust);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.estate-selector {
  background: var(--bg-white);
  border: 1px solid var(--border-warm);
  border-radius: 5px;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-dark);
  font-family: inherit;
}

.staff-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 10px;
  border-left: 1px solid var(--border-warm);
}

.staff-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--bg-sand);
  border: 1px solid var(--border-warm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--rust);
}

.staff-info {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.staff-name {
  font-size: 12px;
  font-weight: 600;
}

.staff-role {
  font-size: 10px;
  color: var(--text-muted);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 20px;
  border-radius: 5px;
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background-color 0.15s ease, border-color 0.15s ease;
  font-family: inherit;
}

.btn-rust {
  background-color: var(--rust);
  color: #FFFFFF;
}

.btn-rust:hover {
  background-color: var(--rust-hover);
}

.btn-outline {
  background-color: var(--bg-white);
  color: var(--text-dark);
  border-color: var(--border-warm);
}

.btn-outline-light {
  background-color: rgba(255, 255, 255, 0.14);
  color: #FFFFFF;
  border-color: rgba(255, 255, 255, 0.55);
}

.btn-sm {
  padding: 7px 14px;
  font-size: 12px;
}

.btn-block {
  width: 100%;
}

/* Hero & Sections */
.hero-section {
  position: relative;
  min-height: 540px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #FFFFFF;
  background-color: #3A332C;
  overflow: hidden;
}

.hero-backdrop {
  position: absolute;
  inset: 0;
}

.hero-backdrop img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-scrim {
  position: absolute;
  inset: 0;
  background: rgba(32, 26, 21, 0.46);
}

.hero-content {
  position: relative;
  z-index: 2;
  max-width: 760px;
  padding: 80px 24px 110px;
}

.hero-kicker {
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  margin-bottom: 16px;
  color: #F3ECE0;
}

.hero-headline {
  color: #FFFFFF;
  font-size: clamp(2.4rem, 4.5vw, 3.8rem);
  line-height: 1.12;
  margin-bottom: 18px;
}

.hero-subtext {
  color: rgba(255, 255, 255, 0.9);
  font-size: 16px;
  margin-bottom: 28px;
}

.hero-buttons {
  display: flex;
  gap: 14px;
  justify-content: center;
}

/* Floating Availability Bar */
.availability-bar-wrap {
  position: relative;
  z-index: 10;
  margin-top: -54px;
  margin-bottom: 48px;
}

.availability-bar {
  background: var(--bg-white);
  border: 1px solid var(--border-warm);
  border-radius: 6px;
  padding: 20px 24px;
  display: grid;
  grid-template-columns: repeat(4, 1fr) auto;
  gap: 16px;
  align-items: end;
}

.avail-field input,
.avail-field select {
  width: 100%;
  margin-top: 6px;
  padding: 9px 10px;
  border: 1px solid var(--border-warm);
  border-radius: 4px;
  background: var(--bg-cream);
  font-family: inherit;
}

/* Cards & Grids */
.section-cream {
  padding: 64px 0;
}

.section-sand {
  background-color: var(--bg-sand);
  border-top: 1px solid var(--border-warm);
  border-bottom: 1px solid var(--border-warm);
  padding: 64px 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 32px;
  gap: 24px;
}

.section-title {
  font-size: 32px;
  margin-top: 4px;
}

.collection-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.rooms-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.collection-card,
.room-card,
.panel-card,
.stat-card,
.newsletter-card,
.coordinates-card,
.filter-bar-card {
  background: var(--bg-white);
  border: 1px solid var(--border-warm);
  border-radius: 6px;
  overflow: hidden;
}

.card-media,
.room-card-media {
  position: relative;
  height: 220px;
  background-color: var(--bg-sand);
}

.card-media img,
.room-card-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.corner-tag,
.price-badge {
  position: absolute;
  bottom: 12px;
  left: 12px;
  background: rgba(251, 247, 240, 0.95);
  color: var(--text-dark);
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid var(--border-warm);
}

.card-body,
.room-card-body {
  padding: 20px;
}

/* Tables & Admin */
.admin-page {
  padding: 40px 24px 72px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28px;
}

.stats-grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 32px;
}

.stat-card {
  padding: 22px;
}

.stat-value {
  font-family: 'Fraunces', serif;
  font-size: 30px;
  margin: 8px 0 4px;
}

.panel-card {
  padding: 24px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  text-align: left;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
  padding: 12px 10px;
  border-bottom: 1px solid var(--border-warm);
}

.data-table td {
  padding: 14px 10px;
  border-bottom: 1px solid var(--border-warm);
  font-size: 14px;
}

.bar-track {
  height: 10px;
  background: var(--bg-sand);
  border-radius: 4px;
  overflow: hidden;
  margin-top: 6px;
}

.bar-fill.bar-rust { background: var(--rust); height: 100%; }
.bar-fill.bar-olive { background: var(--olive); height: 100%; }

@media (max-width: 960px) {
  .collection-grid, .rooms-grid-3, .stats-grid-4, .availability-bar {
    grid-template-columns: 1fr;
  }
}

@media print {
  .no-print { display: none !important; }
  body { background: #FFFFFF; }
  .panel-card { border: 1px solid #CCCCCC; }
}
`
  },
  {
    path: 'static/js/main.js',
    language: 'javascript',
    description: 'Vanilla JavaScript for mobile menu, live Indian Rupee (₹) reservation total calculation, and dynamic date filtering.',
    content: `// Hartwell — Minimal Vanilla JavaScript
document.addEventListener("DOMContentLoaded", function () {
  // 1. Mobile navigation toggle
  const navToggle = document.getElementById("mobileNavToggle");
  const mainNav = document.getElementById("mainNav");
  if (navToggle && mainNav) {
    navToggle.addEventListener("click", function () {
      mainNav.classList.toggle("open");
    });
  }

  // 2. Indian Rupee (₹) digit grouping helper in JS
  function formatINR(amount) {
    const num = Math.round(Number(amount) || 0);
    const s = String(Math.abs(num));
    if (s.length <= 3) return "₹" + s;
    const lastThree = s.slice(-3);
    let other = s.slice(0, -3);
    const groups = [];
    while (other.length > 0) {
      groups.unshift(other.slice(-2));
      other = other.slice(0, -2);
    }
    return "₹" + groups.join(",") + "," + lastThree;
  }

  // 3. New Reservation Form: Live Total & Optional Payment Toggle
  const checkInInput = document.getElementById("res_check_in");
  const checkOutInput = document.getElementById("res_check_out");
  const liveTotalDisplay = document.getElementById("liveTotalDisplay");
  const liveNightsLabel = document.getElementById("liveNightsLabel");
  const paymentAmountInput = document.getElementById("payment_amount");
  const recordPaymentCheck = document.getElementById("record_payment");
  const optionalPaymentFields = document.getElementById("optionalPaymentFields");

  if (recordPaymentCheck && optionalPaymentFields) {
    recordPaymentCheck.addEventListener("change", function () {
      optionalPaymentFields.style.display = this.checked ? "grid" : "none";
    });
  }

  function recalculateReservationTotal() {
    if (!checkInInput || !checkOutInput || !liveTotalDisplay) return;
    const inDate = new Date(checkInInput.value);
    const outDate = new Date(checkOutInput.value);
    const diffMs = outDate - inDate;
    const nights = diffMs > 0 ? Math.round(diffMs / (1000 * 60 * 60 * 24)) : 0;

    const checkedBoxes = document.querySelectorAll('input[name="room_ids"]:checked');
    let nightlySum = 0;
    checkedBoxes.forEach(function (cb) {
      nightlySum += parseFloat(cb.getAttribute("data-price") || "0");
    });

    const grandTotal = nights * nightlySum;
    liveTotalDisplay.textContent = formatINR(grandTotal);
    if (liveNightsLabel) {
      liveNightsLabel.textContent =
        nights > 0
          ? checkedBoxes.length + " room(s) × " + nights + " night(s)"
          : "Select valid check-in and check-out dates";
    }
    if (paymentAmountInput && grandTotal > 0) {
      paymentAmountInput.value = grandTotal;
    }
  }

  if (checkInInput && checkOutInput) {
    checkInInput.addEventListener("change", recalculateReservationTotal);
    checkOutInput.addEventListener("change", recalculateReservationTotal);
    document.querySelectorAll('input[name="room_ids"]').forEach(function (cb) {
      cb.addEventListener("change", recalculateReservationTotal);
    });
    recalculateReservationTotal();
  }
});
`
  }
];
