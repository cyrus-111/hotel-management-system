import { FlaskProjectFile } from './flaskSourceFiles';

export const FLASK_TEMPLATE_FILES: FlaskProjectFile[] = [
  {
    path: 'templates/base.html',
    language: 'html',
    description: 'Reusable base template with Hartwell top navigation bar, flash messages banner, and estate footer.',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{% block title %}Hartwell — Boutique • Somerset{% endblock %}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="{{ url_for('static', filename='css/style.css') }}">
</head>
<body>
  <!-- Top Navigation Bar -->
  <header class="site-header no-print">
    <div class="header-inner">
      <div class="brand-lockup">
        <a href="{{ url_for('home') }}" class="brand-wordmark">Hartwell</a>
        <span class="brand-tag">BOUTIQUE &bull; SOMERSET</span>
      </div>

      <button class="mobile-nav-toggle" id="mobileNavToggle" aria-label="Toggle Menu">&#9776;</button>

      <nav class="main-nav" id="mainNav">
        <a href="{{ url_for('home') }}" class="nav-link {% if request.endpoint == 'home' %}active{% endif %}">Home</a>
        <a href="{{ url_for('dashboard') }}" class="nav-link {% if request.endpoint == 'dashboard' %}active{% endif %}">Dashboard</a>
        <a href="{{ url_for('rooms') }}" class="nav-link {% if 'room' in (request.endpoint or '') %}active{% endif %}">Rooms</a>
        <a href="{{ url_for('guests') }}" class="nav-link {% if 'guest' in (request.endpoint or '') %}active{% endif %}">Guests</a>
        <a href="{{ url_for('reservations') }}" class="nav-link {% if 'reservation' in (request.endpoint or '') %}active{% endif %}">Reservations</a>
        <a href="{{ url_for('payments') }}" class="nav-link {% if 'payment' in (request.endpoint or '') %}active{% endif %}">Payments</a>
        <a href="{{ url_for('search') }}" class="nav-link {% if request.endpoint == 'search' %}active{% endif %}">Search</a>
        <a href="{{ url_for('reports') }}" class="nav-link {% if request.endpoint == 'reports' %}active{% endif %}">Reports</a>
      </nav>

      <div class="header-actions">
        <select class="estate-selector" aria-label="Select Estate">
          <option value="somerset">Estate House: Somerset</option>
          <option value="cotswolds">The Cotswolds Manor</option>
          <option value="cornwall">Cornwall Cliff House</option>
          <option value="lakedistrict">Lake District Lodge</option>
          <option value="highlands">Scottish Highlands</option>
        </select>
        <a href="{{ url_for('add_reservation') }}" class="btn btn-rust btn-sm">Book a Stay</a>
        <div class="staff-badge">
          <div class="staff-avatar">EV</div>
          <div class="staff-info">
            <span class="staff-name">Eleanor Vance</span>
            <span class="staff-role">Concierge Desk</span>
          </div>
        </div>
      </div>
    </div>
  </header>

  <!-- Flash Messages Block -->
  {% with messages = get_flashed_messages(with_categories=true) %}
    {% if messages %}
      <div class="flash-container no-print">
        {% for category, message in messages %}
          <div class="flash-banner flash-{{ category }}">
            <span>{{ message }}</span>
            <button type="button" class="flash-close" onclick="this.parentElement.remove()">&times;</button>
          </div>
        {% endfor %}
      </div>
    {% endif %}
  {% endwith %}

  <!-- Page Content -->
  <main class="page-main">
    {% block content %}{% endblock %}
  </main>

  <!-- Footer -->
  <footer class="site-footer no-print">
    <div class="container footer-grid">
      <div class="footer-brand">
        <div class="brand-wordmark">Hartwell</div>
        <p class="footer-subtext">A quiet sanctuary of Georgian limestone, ancient orchards, and unhurried seasonal hospitality in the English countryside.</p>
      </div>
      <div class="footer-col">
        <div class="micro-label">ESTATE LOCATION</div>
        <p>Hartwell Manor House<br>Honeybourne Lane, Chipping Campden Ridge<br>Gloucestershire, GL55 6JH, United Kingdom</p>
      </div>
      <div class="footer-col">
        <div class="micro-label">CONCIERGE DIRECT</div>
        <p>+44 (0) 1386 840 201<br>concierge@hartwell-estate.co.uk</p>
      </div>
      <div class="footer-col">
        <div class="micro-label">ADMINISTRATION</div>
        <ul class="footer-links">
          <li><a href="{{ url_for('dashboard') }}">Estate Dashboard</a></li>
          <li><a href="{{ url_for('rooms') }}">Sanctuary Rooms</a></li>
          <li><a href="{{ url_for('reservations') }}">Reservations Ledger</a></li>
          <li><a href="{{ url_for('reports') }}">Financial Reports (INR ₹)</a></li>
        </ul>
      </div>
    </div>
    <div class="container footer-bottom">
      <span>&copy; {{ today_str[:4] }} Hartwell Country Estates Ltd. All tariffs and accounts maintained in Indian Rupees (₹).</span>
      <div class="footer-legal">
        <a href="{{ url_for('search') }}">Availability Search</a> &bull;
        <a href="{{ url_for('guests') }}">Guest Registry</a> &bull;
        <a href="{{ url_for('payments') }}">Settlements</a>
      </div>
    </div>
  </footer>

  <script src="{{ url_for('static', filename='js/main.js') }}"></script>
</body>
</html>
`
  },
  {
    path: 'templates/home.html',
    language: 'html',
    description: 'Public landing page with hero, floating availability bar, Country Sanctuaries, live DB rooms in ₹, Ethos, and Newsletter.',
    content: `{% extends "base.html" %}
{% block title %}Hartwell — A Refuge in the English Countryside{% endblock %}

{% block content %}
<!-- 1. HERO SECTION -->
<section class="hero-section">
  <div class="hero-backdrop">
    <img src="{{ url_for('static', filename='img/hero_countryside.jpg') }}" alt="Hartwell Somerset Estate at dawn" onerror="this.style.display='none'">
    <div class="hero-scrim"></div>
  </div>
  <div class="hero-content container">
    <div class="hero-kicker">HARTWELL &bull; SOMERSET ESTATE</div>
    <h1 class="hero-headline">A refuge in the English countryside</h1>
    <p class="hero-subtext">Set amidst three hundred acres of misty Somerset pastureland, ancient beech woods, and walled kitchen gardens. Restored for quiet contemplation.</p>
    <div class="hero-buttons">
      <a href="{{ url_for('add_reservation') }}" class="btn btn-rust">Plan Your Retreat</a>
      <a href="#sanctuary-rooms" class="btn btn-outline-light">Explore The Quarters</a>
    </div>
  </div>
</section>

<!-- 2. FLOATING AVAILABILITY BAR -->
<section class="availability-bar-wrap container">
  <form action="{{ url_for('search') }}" method="GET" class="availability-bar">
    <input type="hidden" name="tab" value="availability">
    <div class="avail-field">
      <label class="micro-label" for="avail_in">ARRIVAL DATE</label>
      <input type="date" id="avail_in" name="check_in" value="{{ today_str }}" required>
    </div>
    <div class="avail-field">
      <label class="micro-label" for="avail_out">DEPARTURE DATE</label>
      <input type="date" id="avail_out" name="check_out" required>
    </div>
    <div class="avail-field">
      <label class="micro-label" for="avail_guests">GUESTS</label>
      <select id="avail_guests" name="guests">
        <option value="1">1 Guest</option>
        <option value="2" selected>2 Guests</option>
        <option value="3">3 Guests</option>
        <option value="4">4 Guests</option>
      </select>
    </div>
    <div class="avail-field">
      <label class="micro-label" for="avail_type">ACCOMMODATIONS</label>
      <select id="avail_type" name="room_type">
        <option value="">All Sanctuary Types</option>
        <option value="Single">Single</option>
        <option value="Double">Double</option>
        <option value="Deluxe">Deluxe</option>
        <option value="Suite">Suite</option>
      </select>
    </div>
    <div class="avail-action">
      <button type="submit" class="btn btn-rust btn-block">Check Availability &rarr;</button>
    </div>
  </form>
</section>

<!-- 3. THE COLLECTION - COUNTRY SANCTUARIES -->
<section class="section-cream container">
  <div class="section-header">
    <div>
      <div class="micro-label">THE COLLECTION</div>
      <h2 class="section-title">Country Sanctuaries</h2>
    </div>
    <p class="section-lead">Four distinct architectural estates across Britain, united by unhurried hospitality and deep regional roots.</p>
  </div>

  <div class="collection-grid">
    <article class="collection-card">
      <div class="card-media">
        <img src="{{ url_for('static', filename='img/cotswolds.jpg') }}" alt="The Cotswolds" onerror="this.style.display='none'">
        <span class="corner-tag">Flagship</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">The Cotswolds</h3>
        <p class="card-text">Honey-stone manor house framed by lavender parterres, dry-stone walls, and centuries-old cider orchards.</p>
        <a href="{{ url_for('rooms') }}" class="card-footer-link">Explore Gloucestershire Estate &rarr;</a>
      </div>
    </article>

    <article class="collection-card">
      <div class="card-media">
        <img src="{{ url_for('static', filename='img/cornwall.jpg') }}" alt="Cornwall" onerror="this.style.display='none'">
        <span class="corner-tag">Coastal</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">Cornwall</h3>
        <p class="card-text">Weathered granite cliffside refuge overlooking the Atlantic swell, wild sea thrift paths, and hidden coves.</p>
        <a href="{{ url_for('rooms') }}" class="card-footer-link">Explore Atlantic Sanctuary &rarr;</a>
      </div>
    </article>

    <article class="collection-card">
      <div class="card-media">
        <img src="{{ url_for('static', filename='img/lakedistrict.jpg') }}" alt="Lake District" onerror="this.style.display='none'">
        <span class="corner-tag">Lakefront</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">Lake District</h3>
        <p class="card-text">Cumbrian slate country house with private timber jetty, mirrored fell waters, and birch woodland trails.</p>
        <a href="{{ url_for('rooms') }}" class="card-footer-link">Explore Waterside Quarters &rarr;</a>
      </div>
    </article>

    <article class="collection-card">
      <div class="card-media">
        <img src="{{ url_for('static', filename='img/highlands.jpg') }}" alt="Scottish Highlands" onerror="this.style.display='none'">
        <span class="corner-tag">Wilderness</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">Scottish Highlands</h3>
        <p class="card-text">Secluded glen lodge surrounded by purple heather moors, peat fires, and dramatic Highland ridges.</p>
        <a href="{{ url_for('rooms') }}" class="card-footer-link">Explore Highland Lodge &rarr;</a>
      </div>
    </article>
  </div>
</section>

<!-- 4. SANCTUARY ROOMS & SUITES (LIVE FROM POSTGRESQL) -->
<section class="section-sand" id="sanctuary-rooms">
  <div class="container">
    <div class="section-header">
      <div>
        <div class="micro-label">ACCOMMODATIONS &bull; LIVE INVENTORY</div>
        <h2 class="section-title">Sanctuary Rooms &amp; Suites</h2>
      </div>
      <a href="{{ url_for('rooms') }}" class="text-link">View All Quarters &rarr;</a>
    </div>

    {% if featured_rooms %}
      <div class="rooms-grid-3">
        {% for room in featured_rooms %}
          {% set meta = room_meta.get(room.room_type, room_meta['Double']) %}
          <article class="room-card">
            <div class="room-card-media">
              <img src="{{ url_for('static', filename=meta.img) }}" alt="{{ meta.name }}" onerror="this.style.display='none'">
              <span class="price-badge">{{ room.price | inr }} / night</span>
            </div>
            <div class="room-card-body">
              <div class="room-card-meta">ROOM {{ room.room_number }} &bull; {{ room.room_type | upper }}</div>
              <h3 class="room-card-title">{{ meta.name }}</h3>
              <ul class="room-features">
                <li>{{ meta.features[0] }}</li>
                <li>{{ meta.features[1] }}</li>
              </ul>
              <a href="{{ url_for('add_reservation', room_id=room.room_id) }}" class="btn btn-rust btn-block">Reserve Room</a>
            </div>
          </article>
        {% endfor %}
      </div>
    {% else %}
      <div class="empty-state-box">
        <p>No available rooms currently listed in the database.</p>
        <a href="{{ url_for('rooms') }}" class="btn btn-rust">Manage Rooms</a>
      </div>
    {% endif %}
  </div>
</section>

<!-- 5. ETHOS SECTION -->
<section class="section-cream container">
  <div class="ethos-grid">
    <div class="ethos-photos">
      <div class="ethos-photo-main">
        <img src="{{ url_for('static', filename='img/ethos_glasshouse.jpg') }}" alt="The Glasshouse Restaurant" onerror="this.style.display='none'">
      </div>
      <div class="ethos-photo-subgrid">
        <div class="ethos-photo-small">
          <img src="{{ url_for('static', filename='img/room_suite.jpg') }}" alt="Drawing Room Hearth" onerror="this.style.display='none'">
        </div>
        <div class="ethos-photo-small">
          <img src="{{ url_for('static', filename='img/cotswolds.jpg') }}" alt="Walled Kitchen Garden" onerror="this.style.display='none'">
        </div>
      </div>
    </div>

    <div class="ethos-copy">
      <div class="micro-label">THE ESTATE ETHOS</div>
      <h2 class="section-title">An unhurried tempo governed by the seasons</h2>
      <p class="ethos-lead">At Hartwell, days unfold without schedule. Morning mist rises over the ha-ha wall while heritage apples and Heirloom greens are gathered from our two-acre kitchen garden for the evening table.</p>

      <div class="ethos-boxes">
        <div class="ethos-info-box">
          <h4>The Glasshouse Restaurant</h4>
          <p>Botanical conservatory dining celebrating hyper-seasonal Somerset produce, wood-fired hearth cookery, and estate-pressed perry.</p>
        </div>
        <div class="ethos-info-box">
          <h4>The Estate Library &amp; Drawing Room</h4>
          <p>Three thousand leather-bound volumes, deep linen sofas, and an honesty bar stocked with small-batch botanical distillations.</p>
        </div>
      </div>

      <a href="{{ url_for('reports') }}" class="ethos-link">Read The Estate Chronicles &rarr;</a>
    </div>
  </div>
</section>

<!-- 6. NEWSLETTER & ESTATE COORDINATES -->
<section class="section-sand">
  <div class="container split-bottom-grid">
    <div class="newsletter-card">
      <div class="micro-label">ESTATE LETTERS</div>
      <h3 class="card-title-lg">Seasonal dispatches from the estate grounds</h3>
      <p>Receive quiet notes on garden harvests, autumn foraging walks, and seasonal winter residencies. Sent four times a year.</p>
      <form action="{{ url_for('newsletter') }}" method="POST" class="newsletter-form">
        <input type="email" name="email" placeholder="Your electronic mail address" required>
        <button type="submit" class="btn btn-rust">Subscribe</button>
      </form>
    </div>

    <div class="coordinates-card">
      <div class="micro-label">ESTATE COORDINATES</div>
      <h3 class="card-title-lg">Hartwell Manor House</h3>
      <p class="address-lines">
        Honeybourne Lane, Chipping Campden Ridge<br>
        Gloucestershire, GL55 6JH<br>
        United Kingdom
      </p>
      <div class="coord-divider"></div>
      <div class="coord-meta">
        <div>
          <span class="micro-label">CONCIERGE TELEPHONE</span>
          <strong>+44 (0) 1386 840 201</strong>
        </div>
        <div>
          <span class="micro-label">HELI-PAD &amp; CARRIAGE</span>
          <strong>52&deg; 02' 48" N, 1&deg; 46' 52" W</strong>
        </div>
      </div>
    </div>
  </div>
</section>
{% endblock %}
`
  },
  {
    path: 'templates/dashboard.html',
    language: 'html',
    description: 'Admin Dashboard showing 4 KPIs in ₹, latest 5 reservations with STRING_AGG rooms, and pure CSS bar chart of revenue by method.',
    content: `{% extends "base.html" %}
{% block title %}Dashboard — Hartwell Estate{% endblock %}

{% block content %}
<div class="container admin-page">
  <div class="page-header">
    <div>
      <div class="micro-label">ESTATE ADMINISTRATION</div>
      <h1 class="page-title">Steward's Dashboard</h1>
    </div>
    <div class="header-btn-group">
      <a href="{{ url_for('add_reservation') }}" class="btn btn-rust">+ New Reservation</a>
      <a href="{{ url_for('add_guest') }}" class="btn btn-outline">+ Register Guest</a>
    </div>
  </div>

  <!-- 4 Key Figures -->
  <div class="stats-grid-4">
    <div class="stat-card">
      <div class="micro-label">TOTAL GUESTS</div>
      <div class="stat-value tabular-nums">{{ stats.total_guests }}</div>
      <div class="stat-caption">Registered in estate ledger</div>
    </div>
    <div class="stat-card">
      <div class="micro-label">TOTAL ROOMS</div>
      <div class="stat-value tabular-nums">{{ stats.total_rooms }}</div>
      <div class="stat-caption">Sanctuary rooms &amp; suites</div>
    </div>
    <div class="stat-card">
      <div class="micro-label">ACTIVE RESERVATIONS</div>
      <div class="stat-value tabular-nums">{{ stats.active_reservations }}</div>
      <div class="stat-caption">Status: Booked or Checked-in</div>
    </div>
    <div class="stat-card">
      <div class="micro-label">TOTAL REVENUE</div>
      <div class="stat-value tabular-nums">{{ stats.total_revenue | inr }}</div>
      <div class="stat-caption">Settled payments in Indian Rupees</div>
    </div>
  </div>

  <div class="dashboard-split">
    <!-- Latest 5 Reservations -->
    <div class="panel-card">
      <div class="panel-header">
        <h2 class="panel-title">Latest 5 Reservations</h2>
        <a href="{{ url_for('reservations') }}" class="text-link">All Reservations &rarr;</a>
      </div>
      {% if latest_reservations %}
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>GUEST NAME</th>
                <th>ROOMS</th>
                <th>CHECK-IN</th>
                <th>CHECK-OUT</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {% for r in latest_reservations %}
                <tr>
                  <td class="tabular-nums">#{{ r.reservation_id }}</td>
                  <td><strong>{{ r.fname }} {{ r.minit or '' }} {{ r.lname }}</strong></td>
                  <td class="tabular-nums">Room {{ r.room_numbers }}</td>
                  <td class="tabular-nums">{{ r.check_in_date }}</td>
                  <td class="tabular-nums">{{ r.check_out_date }}</td>
                  <td><span class="status-text status-{{ r.status | lower }}">{{ r.status }}</span></td>
                </tr>
              {% endfor %}
            </tbody>
          </table>
        </div>
      {% else %}
        <div class="empty-state-box">No reservations found.</div>
      {% endif %}
    </div>

    <!-- Pure CSS Bar Chart: Revenue by Payment Method -->
    <div class="panel-card">
      <div class="panel-header">
        <h2 class="panel-title">Revenue by Payment Method</h2>
        <span class="micro-label">INR (₹)</span>
      </div>
      {% if revenue_by_method %}
        <div class="bar-chart-list">
          {% for row in revenue_by_method %}
            {% set pct = ((row.method_total / max_method_rev) * 100) | round(1) %}
            <div class="bar-chart-row">
              <div class="bar-chart-labels">
                <span><strong>{{ row.payment_method }}</strong> ({{ row.tx_count }} tx)</span>
                <span class="tabular-nums">{{ row.method_total | inr }}</span>
              </div>
              <div class="bar-track">
                <div class="bar-fill {% if loop.index0 % 2 == 1 %}bar-olive{% else %}bar-rust{% endif %}" style="width: {{ pct }}%;"></div>
              </div>
            </div>
          {% endfor %}
        </div>
      {% else %}
        <div class="empty-state-box">No payment records available.</div>
      {% endif %}
    </div>
  </div>
</div>
{% endblock %}
`
  },
  {
    path: 'templates/guests.html',
    language: 'html',
    description: 'Guest directory with ILIKE search by name/phone, edit links, and cascade delete confirmation.',
    content: `{% extends "base.html" %}
{% block title %}Guests — Hartwell Estate{% endblock %}

{% block content %}
<div class="container admin-page">
  <div class="page-header">
    <div>
      <div class="micro-label">GUEST REGISTRY</div>
      <h1 class="page-title">Estate Guests</h1>
    </div>
    <a href="{{ url_for('add_guest') }}" class="btn btn-rust">+ Add New Guest</a>
  </div>

  <div class="filter-bar-card">
    <form action="{{ url_for('guests') }}" method="GET" class="inline-search-form">
      <input type="text" name="q" value="{{ q }}" placeholder="Filter by guest name or telephone (ILIKE)...">
      <button type="submit" class="btn btn-rust">Search</button>
      {% if q %}
        <a href="{{ url_for('guests') }}" class="btn btn-outline">Reset</a>
      {% endif %}
    </form>
  </div>

  <div class="panel-card">
    {% if guests %}
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>FULL NAME</th>
              <th>TELEPHONE</th>
              <th>ELECTRONIC MAIL</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {% for g in guests %}
              <tr>
                <td class="tabular-nums">#{{ g.guest_id }}</td>
                <td><strong>{{ g.fname }} {% if g.minit %}{{ g.minit }}. {% endif %}{{ g.lname }}</strong></td>
                <td class="tabular-nums">{{ g.phone }}</td>
                <td>{{ g.email }}</td>
                <td class="actions-cell">
                  <a href="{{ url_for('edit_guest', guest_id=g.guest_id) }}" class="btn-table">Edit</a>
                  <form action="{{ url_for('delete_guest', guest_id=g.guest_id) }}" method="POST" style="display:inline;" onsubmit="return confirm('Delete guest {{ g.fname }} {{ g.lname }}? Please note: all of their reservations and payments will also be removed due to ON DELETE CASCADE.');">
                    <button type="submit" class="btn-table btn-table-danger">Delete</button>
                  </form>
                </td>
              </tr>
            {% endfor %}
          </tbody>
        </table>
      </div>
    {% else %}
      <div class="empty-state-box">No guests found matching your criteria.</div>
    {% endif %}
  </div>
</div>
{% endblock %}
`
  },
  {
    path: 'templates/guest_form.html',
    language: 'html',
    description: 'Form for adding or editing a Guest record.',
    content: `{% extends "base.html" %}
{% block title %}{{ action }} Guest — Hartwell Estate{% endblock %}

{% block content %}
<div class="container admin-page narrow-page">
  <div class="page-header">
    <div>
      <div class="micro-label">GUEST REGISTRY</div>
      <h1 class="page-title">{{ action }} Guest</h1>
    </div>
    <a href="{{ url_for('guests') }}" class="btn btn-outline">&larr; Back to Guests</a>
  </div>

  <div class="panel-card">
    <form method="POST" class="editorial-form">
      <div class="form-row-3">
        <div class="form-group">
          <label class="micro-label" for="fname">FIRST NAME *</label>
          <input type="text" id="fname" name="fname" value="{{ guest.fname or '' }}" required>
        </div>
        <div class="form-group">
          <label class="micro-label" for="minit">MIDDLE INITIAL</label>
          <input type="text" id="minit" name="minit" maxlength="1" value="{{ guest.minit or '' }}">
        </div>
        <div class="form-group">
          <label class="micro-label" for="lname">LAST NAME *</label>
          <input type="text" id="lname" name="lname" value="{{ guest.lname or '' }}" required>
        </div>
      </div>

      <div class="form-row-2">
        <div class="form-group">
          <label class="micro-label" for="phone">TELEPHONE (UNIQUE) *</label>
          <input type="text" id="phone" name="phone" value="{{ guest.phone or '' }}" required>
        </div>
        <div class="form-group">
          <label class="micro-label" for="email">EMAIL ADDRESS (UNIQUE) *</label>
          <input type="email" id="email" name="email" value="{{ guest.email or '' }}" required>
        </div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-rust">{{ action }} Guest</button>
        <a href="{{ url_for('guests') }}" class="btn btn-outline">Cancel</a>
      </div>
    </form>
  </div>
</div>
{% endblock %}
`
  }
];
