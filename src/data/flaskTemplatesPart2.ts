import { FlaskProjectFile } from './flaskSourceFiles';

export const FLASK_TEMPLATE_FILES_PART2: FlaskProjectFile[] = [
  {
    path: 'templates/rooms.html',
    language: 'html',
    description: 'Rooms inventory grid & table with photo by type, ₹ price, availability filter, and safe delete.',
    content: `{% extends "base.html" %}
{% block title %}Rooms & Suites — Hartwell Estate{% endblock %}

{% block content %}
<div class="container admin-page">
  <div class="page-header">
    <div>
      <div class="micro-label">ACCOMMODATIONS INVENTORY</div>
      <h1 class="page-title">Sanctuary Rooms &amp; Suites</h1>
    </div>
    <a href="{{ url_for('add_room') }}" class="btn btn-rust">+ Add Room</a>
  </div>

  <!-- Filter by Type and Availability -->
  <div class="filter-bar-card">
    <form action="{{ url_for('rooms') }}" method="GET" class="inline-search-form">
      <select name="room_type">
        <option value="">All Sanctuary Types</option>
        {% for t in ['Single', 'Double', 'Deluxe', 'Suite'] %}
          <option value="{{ t }}" {% if selected_type == t %}selected{% endif %}>{{ t }}</option>
        {% endfor %}
      </select>

      <select name="availability">
        <option value="">All Availability States</option>
        {% for a in ['Available', 'Occupied', 'Maintenance'] %}
          <option value="{{ a }}" {% if selected_availability == a %}selected{% endif %}>{{ a }}</option>
        {% endfor %}
      </select>

      <button type="submit" class="btn btn-rust">Filter</button>
      {% if selected_type or selected_availability %}
        <a href="{{ url_for('rooms') }}" class="btn btn-outline">Reset</a>
      {% endif %}
    </form>
  </div>

  {% if rooms %}
    <div class="rooms-grid-3">
      {% for r in rooms %}
        {% set meta = room_meta.get(r.room_type, room_meta['Double']) %}
        <article class="room-card">
          <div class="room-card-media">
            <img src="{{ url_for('static', filename=meta.img) }}" alt="Room {{ r.room_number }}" onerror="this.style.display='none'">
            <span class="price-badge">{{ r.price | inr }} / night</span>
          </div>
          <div class="room-card-body">
            <div class="room-card-meta">
              <span>ROOM {{ r.room_number }} &bull; {{ r.room_type | upper }}</span>
              <span class="status-text status-{{ r.availability | lower }}">{{ r.availability }}</span>
            </div>
            <h3 class="room-card-title">{{ meta.name }}</h3>
            <ul class="room-features">
              <li>{{ meta.features[0] }}</li>
              <li>{{ meta.features[1] }}</li>
            </ul>
            <div class="room-card-actions">
              {% if r.availability == 'Available' %}
                <a href="{{ url_for('add_reservation', room_id=r.room_id) }}" class="btn btn-rust btn-sm">Reserve</a>
              {% endif %}
              <a href="{{ url_for('edit_room', room_id=r.room_id) }}" class="btn btn-outline btn-sm">Edit</a>
              <form action="{{ url_for('delete_room', room_id=r.room_id) }}" method="POST" style="display:inline;" onsubmit="return confirm('Delete Room {{ r.room_number }}? Rooms linked in Reservation_Room are protected.');">
                <button type="submit" class="btn-table btn-table-danger">Delete</button>
              </form>
            </div>
          </div>
        </article>
      {% endfor %}
    </div>
  {% else %}
    <div class="empty-state-box">No rooms found matching the selected filters.</div>
  {% endif %}
</div>
{% endblock %}
`
  },
  {
    path: 'templates/room_form.html',
    language: 'html',
    description: 'Form for adding or editing a Room record with tariff in ₹.',
    content: `{% extends "base.html" %}
{% block title %}{{ action }} Room — Hartwell Estate{% endblock %}

{% block content %}
<div class="container admin-page narrow-page">
  <div class="page-header">
    <div>
      <div class="micro-label">ACCOMMODATIONS INVENTORY</div>
      <h1 class="page-title">{{ action }} Sanctuary Room</h1>
    </div>
    <a href="{{ url_for('rooms') }}" class="btn btn-outline">&larr; Back to Rooms</a>
  </div>

  <div class="panel-card">
    <form method="POST" class="editorial-form">
      <div class="form-row-2">
        <div class="form-group">
          <label class="micro-label" for="room_number">ROOM NUMBER (UNIQUE) *</label>
          <input type="text" id="room_number" name="room_number" value="{{ room.room_number or '' }}" required>
        </div>
        <div class="form-group">
          <label class="micro-label" for="room_type">ROOM TYPE *</label>
          <select id="room_type" name="room_type" required>
            {% for t in ['Single', 'Double', 'Deluxe', 'Suite'] %}
              <option value="{{ t }}" {% if room.room_type == t %}selected{% endif %}>{{ t }}</option>
            {% endfor %}
          </select>
        </div>
      </div>

      <div class="form-row-2">
        <div class="form-group">
          <label class="micro-label" for="price">NIGHTLY TARIFF IN INR (₹) *</label>
          <input type="number" step="0.01" min="1" id="price" name="price" value="{{ room.price or '' }}" required>
        </div>
        <div class="form-group">
          <label class="micro-label" for="availability">AVAILABILITY STATUS *</label>
          <select id="availability" name="availability" required>
            {% for a in ['Available', 'Occupied', 'Maintenance'] %}
              <option value="{{ a }}" {% if room.availability == a %}selected{% endif %}>{{ a }}</option>
            {% endfor %}
          </select>
        </div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-rust">{{ action }} Room</button>
        <a href="{{ url_for('rooms') }}" class="btn btn-outline">Cancel</a>
      </div>
    </form>
  </div>
</div>
{% endblock %}
`
  },
  {
    path: 'templates/reservations.html',
    language: 'html',
    description: 'Reservations ledger with guest name, multi-room numbers, status, payment state in ₹, Edit, Cancel, and Delete.',
    content: `{% extends "base.html" %}
{% block title %}Reservations — Hartwell Estate{% endblock %}

{% block content %}
<div class="container admin-page">
  <div class="page-header">
    <div>
      <div class="micro-label">RESERVATIONS LEDGER</div>
      <h1 class="page-title">Guest Reservations</h1>
    </div>
    <a href="{{ url_for('add_reservation') }}" class="btn btn-rust">+ New Reservation</a>
  </div>

  <div class="panel-card">
    {% if reservations %}
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>GUEST</th>
              <th>ROOMS</th>
              <th>CHECK-IN</th>
              <th>CHECK-OUT</th>
              <th>STATUS</th>
              <th>PAYMENT STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {% for r in reservations %}
              <tr>
                <td class="tabular-nums">#{{ r.reservation_id }}</td>
                <td>
                  <strong>{{ r.guest_fname }} {{ r.guest_lname }}</strong>
                  {% if r.staff_fname %}
                    <div class="table-sub">Steward: {{ r.staff_fname }} {{ r.staff_lname }}</div>
                  {% endif %}
                </td>
                <td class="tabular-nums">Room {{ r.room_numbers }}</td>
                <td class="tabular-nums">{{ r.check_in_date }}</td>
                <td class="tabular-nums">{{ r.check_out_date }}</td>
                <td><span class="status-text status-{{ r.status | lower }}">{{ r.status }}</span></td>
                <td>
                  {% if r.payment_id %}
                    <span class="status-text status-paid">Paid &bull; {{ r.payment_amount | inr }} ({{ r.payment_method }})</span>
                  {% else %}
                    <span class="status-text status-pending">Pending</span>
                  {% endif %}
                </td>
                <td class="actions-cell">
                  <a href="{{ url_for('edit_reservation', reservation_id=r.reservation_id) }}" class="btn-table">Edit</a>
                  {% if r.status != 'Cancelled' %}
                    <form action="{{ url_for('cancel_reservation', reservation_id=r.reservation_id) }}" method="POST" style="display:inline;" onsubmit="return confirm('Mark Reservation #{{ r.reservation_id }} as Cancelled?');">
                      <button type="submit" class="btn-table">Cancel</button>
                    </form>
                  {% endif %}
                  <form action="{{ url_for('delete_reservation', reservation_id=r.reservation_id) }}" method="POST" style="display:inline;" onsubmit="return confirm('Permanently delete Reservation #{{ r.reservation_id }}?');">
                    <button type="submit" class="btn-table btn-table-danger">Delete</button>
                  </form>
                </td>
              </tr>
            {% endfor %}
          </tbody>
        </table>
      </div>
    {% else %}
      <div class="empty-state-box">No reservations found.</div>
    {% endif %}
  </div>
</div>
{% endblock %}
`
  },
  {
    path: 'templates/reservation_form.html',
    language: 'html',
    description: 'New/Edit Reservation form with multi-room selection, live ₹ total calculation, and optional atomic payment.',
    content: `{% extends "base.html" %}
{% block title %}{{ action }} Reservation — Hartwell Estate{% endblock %}

{% block content %}
<div class="container admin-page narrow-page">
  <div class="page-header">
    <div>
      <div class="micro-label">RESERVATIONS LEDGER</div>
      <h1 class="page-title">{{ action }} Reservation</h1>
    </div>
    <a href="{{ url_for('reservations') }}" class="btn btn-outline">&larr; Back to Reservations</a>
  </div>

  <div class="panel-card">
    {% if action == 'Add' %}
      <form method="POST" class="editorial-form" id="newReservationForm">
        <div class="form-row-2">
          <div class="form-group">
            <label class="micro-label" for="guest_id">GUEST *</label>
            <select id="guest_id" name="guest_id" required>
              <option value="">Select a registered guest...</option>
              {% for g in guests %}
                <option value="{{ g.guest_id }}">{{ g.fname }} {{ g.lname }} ({{ g.phone }})</option>
              {% endfor %}
            </select>
          </div>
          <div class="form-group">
            <label class="micro-label" for="staff_id">ASSIGNED CONCIERGE / STAFF</label>
            <select id="staff_id" name="staff_id">
              <option value="">Unassigned</option>
              {% for s in staff %}
                <option value="{{ s.staff_id }}" {% if loop.first %}selected{% endif %}>{{ s.fname }} {{ s.lname }} — {{ s.role }}</option>
              {% endfor %}
            </select>
          </div>
        </div>

        <div class="form-row-2">
          <div class="form-group">
            <label class="micro-label" for="res_check_in">CHECK-IN DATE *</label>
            <input type="date" id="res_check_in" name="check_in_date" value="{{ default_in }}" min="{{ today_str }}" required>
          </div>
          <div class="form-group">
            <label class="micro-label" for="res_check_out">CHECK-OUT DATE *</label>
            <input type="date" id="res_check_out" name="check_out_date" value="{{ default_out }}" required>
          </div>
        </div>

        <div class="form-group">
          <label class="micro-label">SELECT AVAILABLE ROOMS (MULTI-SELECT FOR DATES) *</label>
          <div id="freeRoomsContainer" class="room-checkbox-grid">
            {% for rm in rooms %}
              <label class="room-check-card">
                <input type="checkbox" name="room_ids" value="{{ rm.room_id }}" data-price="{{ rm.price }}" {% if preselect_room_id == rm.room_id %}checked{% endif %}>
                <div class="room-check-info">
                  <strong>Room {{ rm.room_number }} &bull; {{ rm.room_type }}</strong>
                  <span class="tabular-nums">{{ rm.price | inr }} / night</span>
                </div>
              </label>
            {% endfor %}
          </div>
        </div>

        <!-- Live Total Calculation Box -->
        <div class="live-total-banner">
          <div>
            <span class="micro-label">ESTIMATED STAY TARIFF</span>
            <div id="liveNightsLabel" class="table-sub">Select dates and rooms to calculate</div>
          </div>
          <div id="liveTotalDisplay" class="live-total-amount tabular-nums">₹0</div>
        </div>

        <!-- Optional Atomic Payment Section -->
        <div class="optional-payment-box">
          <label class="checkbox-inline">
            <input type="checkbox" id="record_payment" name="record_payment" value="yes">
            <strong>Record initial payment in the same transaction</strong>
          </label>
          <div id="optionalPaymentFields" class="form-row-3" style="display:none; margin-top: 1rem;">
            <div class="form-group">
              <label class="micro-label" for="payment_method">PAYMENT METHOD</label>
              <select id="payment_method" name="payment_method">
                <option value="Card">Card</option>
                <option value="UPI">UPI</option>
                <option value="NetBanking">NetBanking</option>
                <option value="Cash">Cash</option>
              </select>
            </div>
            <div class="form-group">
              <label class="micro-label" for="payment_amount">AMOUNT (INR ₹)</label>
              <input type="number" step="0.01" id="payment_amount" name="payment_amount">
            </div>
            <div class="form-group">
              <label class="micro-label" for="payment_date">PAYMENT DATE</label>
              <input type="date" id="payment_date" name="payment_date" value="{{ today_str }}">
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-rust">Confirm Reservation</button>
          <a href="{{ url_for('reservations') }}" class="btn btn-outline">Cancel</a>
        </div>
      </form>
    {% else %}
      <!-- Edit Reservation Form -->
      <form method="POST" class="editorial-form">
        <div class="form-row-2">
          <div class="form-group">
            <label class="micro-label" for="edit_in">CHECK-IN DATE *</label>
            <input type="date" id="edit_in" name="check_in_date" value="{{ reservation.check_in_date }}" required>
          </div>
          <div class="form-group">
            <label class="micro-label" for="edit_out">CHECK-OUT DATE *</label>
            <input type="date" id="edit_out" name="check_out_date" value="{{ reservation.check_out_date }}" required>
          </div>
        </div>

        <div class="form-row-2">
          <div class="form-group">
            <label class="micro-label" for="edit_staff">ASSIGNED STAFF</label>
            <select id="edit_staff" name="staff_id">
              <option value="">Unassigned</option>
              {% for s in staff %}
                <option value="{{ s.staff_id }}" {% if reservation.staff_id == s.staff_id %}selected{% endif %}>{{ s.fname }} {{ s.lname }} ({{ s.role }})</option>
              {% endfor %}
            </select>
          </div>
          <div class="form-group">
            <label class="micro-label" for="edit_status">RESERVATION STATUS *</label>
            <select id="edit_status" name="status" required>
              {% for st in ['Booked', 'Checked-in', 'Checked-out', 'Cancelled'] %}
                <option value="{{ st }}" {% if reservation.status == st %}selected{% endif %}>{{ st }}</option>
              {% endfor %}
            </select>
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-rust">Update Reservation</button>
          <a href="{{ url_for('reservations') }}" class="btn btn-outline">Cancel</a>
        </div>
      </form>
    {% endif %}
  </div>
</div>
{% endblock %}
`
  }
];
