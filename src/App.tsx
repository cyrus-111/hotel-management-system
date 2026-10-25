import React, { useState, useMemo, useEffect } from 'react';
import {
  Guest,
  Staff,
  Room,
  Reservation,
  ReservationRoom,
  Payment,
  RoomType,
  RoomAvailability,
  ReservationStatus,
  PaymentMethod,
  FlashMessage,
  formatInr,
  getRoomImage,
  getRoomFeatures,
  getRoomDisplayName,
} from './data/initialData';
import { FlaskCodeModal } from './components/FlaskCodeModal';
import { Printer, Code2, X, Menu, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

type PageRoute =
  | 'home'
  | 'dashboard'
  | 'rooms'
  | 'room_form'
  | 'guests'
  | 'guest_form'
  | 'reservations'
  | 'reservation_form'
  | 'payments'
  | 'search'
  | 'reports'
  | 'flask_code';

interface DashboardData {
  total_guests: number;
  total_rooms: number;
  active_reservations: number;
  total_revenue: number;
  latest_reservations: {
    reservation_id: number;
    guest: string;
    rooms: string | null;
    check_in_date: string;
    check_out_date: string;
    status: ReservationStatus;
  }[];
  revenue_by_method: {
    payment_method: string;
    total: number;
  }[];
}

interface ReservationRecord extends Reservation {
  guest: string;
  staff: string | null;
  rooms: string | null;
  paid: number;
  payment_status: 'Paid' | 'Pending';
}

interface PaymentRecord extends Payment {
  guest: string;
}

interface SearchResults {
  guests: {
    guest_id: number;
    fname: string;
    lname: string;
    phone: string;
    email: string | null;
  }[];
  rooms: {
    room_number: string;
    room_type: RoomType;
    price: number;
    availability: RoomAvailability;
  }[];
  reservations: {
    reservation_id: number;
    guest: string;
    check_in_date: string;
    check_out_date: string;
    status: ReservationStatus;
  }[];
}

interface RevenueReportRow {
  payment_method: string;
  transactions: number;
  total_revenue: number;
  avg_payment: number;
}

interface GuestHistoryReportRow {
  guest_id: number;
  guest: string;
  reservation_id: number;
  rooms: string | null;
  check_in_date: string;
  check_out_date: string;
  status: ReservationStatus;
  paid: number;
}

interface StaffWorkloadReportRow {
  staff_id: number;
  staff: string;
  role: string;
  reservations_handled: number;
}

const apiErrorMessage = (data: unknown, fallback: string) =>
  typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
    ? data.error
    : fallback;

const isRevenueReport = (value: unknown): value is RevenueReportRow[] =>
  Array.isArray(value) && value.every((row) =>
    typeof row === 'object' && row !== null &&
    'payment_method' in row && typeof row.payment_method === 'string' &&
    'transactions' in row && typeof row.transactions === 'number' &&
    'total_revenue' in row && typeof row.total_revenue === 'number' &&
    'avg_payment' in row && typeof row.avg_payment === 'number'
  );

const isGuestHistoryReport = (value: unknown): value is GuestHistoryReportRow[] =>
  Array.isArray(value) && value.every((row) =>
    typeof row === 'object' && row !== null &&
    'guest_id' in row && typeof row.guest_id === 'number' &&
    'guest' in row && typeof row.guest === 'string' &&
    'reservation_id' in row && typeof row.reservation_id === 'number' &&
    'rooms' in row && (typeof row.rooms === 'string' || row.rooms === null) &&
    'check_in_date' in row && typeof row.check_in_date === 'string' &&
    'check_out_date' in row && typeof row.check_out_date === 'string' &&
    'status' in row && ['Booked', 'Checked-in', 'Checked-out', 'Cancelled'].includes(String(row.status)) &&
    'paid' in row && typeof row.paid === 'number'
  );

const isStaffWorkloadReport = (value: unknown): value is StaffWorkloadReportRow[] =>
  Array.isArray(value) && value.every((row) =>
    typeof row === 'object' && row !== null &&
    'staff_id' in row && typeof row.staff_id === 'number' &&
    'staff' in row && typeof row.staff === 'string' &&
    'role' in row && typeof row.role === 'string' &&
    'reservations_handled' in row && typeof row.reservations_handled === 'number'
  );

const fetchReportRows = async <T,>(
  url: string,
  isReport: (value: unknown) => value is T[],
  signal: AbortSignal
): Promise<T[]> => {
  const response = await fetch(url, { signal });
  const data: unknown = await response.json();
  const apiError = apiErrorMessage(data, '');
  if (!response.ok || apiError) {
    throw new Error(apiError || `Report request failed (${response.status} ${response.statusText}).`);
  }
  if (!isReport(data)) {
    throw new Error('The report response had an unexpected format.');
  }
  return data;
};

const isSearchResults = (value: unknown): value is SearchResults => {
  if (typeof value !== 'object' || value === null || !('guests' in value) ||
    !('rooms' in value) || !('reservations' in value) ||
    !Array.isArray(value.guests) || !Array.isArray(value.rooms) || !Array.isArray(value.reservations)) {
    return false;
  }
  return value.guests.every((guest) =>
    typeof guest === 'object' && guest !== null &&
    'guest_id' in guest && typeof guest.guest_id === 'number' &&
    'fname' in guest && typeof guest.fname === 'string' &&
    'lname' in guest && typeof guest.lname === 'string' &&
    'phone' in guest && typeof guest.phone === 'string' &&
    'email' in guest && (typeof guest.email === 'string' || guest.email === null)
  ) && value.rooms.every((room) =>
    typeof room === 'object' && room !== null &&
    'room_number' in room && typeof room.room_number === 'string' &&
    'room_type' in room && ['Single', 'Double', 'Deluxe', 'Suite'].includes(String(room.room_type)) &&
    'price' in room && typeof room.price === 'number' &&
    'availability' in room && ['Available', 'Occupied', 'Maintenance'].includes(String(room.availability))
  ) && value.reservations.every((reservation) =>
    typeof reservation === 'object' && reservation !== null &&
    'reservation_id' in reservation && typeof reservation.reservation_id === 'number' &&
    'guest' in reservation && typeof reservation.guest === 'string' &&
    'check_in_date' in reservation && typeof reservation.check_in_date === 'string' &&
    'check_out_date' in reservation && typeof reservation.check_out_date === 'string' &&
    'status' in reservation && ['Booked', 'Checked-in', 'Checked-out', 'Cancelled'].includes(String(reservation.status))
  );
};

const isGuest = (value: unknown): value is Guest =>
  typeof value === 'object' &&
  value !== null &&
  'guest_id' in value &&
  typeof value.guest_id === 'number' &&
  'fname' in value &&
  typeof value.fname === 'string' &&
  'minit' in value &&
  (typeof value.minit === 'string' || value.minit === null) &&
  'lname' in value &&
  typeof value.lname === 'string' &&
  'phone' in value &&
  typeof value.phone === 'string' &&
  'email' in value &&
  typeof value.email === 'string';

const isRoom = (value: unknown): value is Room =>
  typeof value === 'object' &&
  value !== null &&
  'room_id' in value &&
  typeof value.room_id === 'number' &&
  'room_number' in value &&
  typeof value.room_number === 'string' &&
  'room_type' in value &&
  ['Single', 'Double', 'Deluxe', 'Suite'].includes(String(value.room_type)) &&
  'price' in value &&
  typeof value.price === 'number' &&
  'availability' in value &&
  ['Available', 'Occupied', 'Maintenance'].includes(String(value.availability));

const isStaff = (value: unknown): value is Staff =>
  typeof value === 'object' &&
  value !== null &&
  'staff_id' in value &&
  typeof value.staff_id === 'number' &&
  'fname' in value &&
  typeof value.fname === 'string' &&
  'lname' in value &&
  typeof value.lname === 'string' &&
  'role' in value &&
  typeof value.role === 'string';

const isReservationRecord = (value: unknown): value is ReservationRecord =>
  typeof value === 'object' &&
  value !== null &&
  'reservation_id' in value &&
  typeof value.reservation_id === 'number' &&
  'booking_date' in value &&
  typeof value.booking_date === 'string' &&
  'check_in_date' in value &&
  typeof value.check_in_date === 'string' &&
  'check_out_date' in value &&
  typeof value.check_out_date === 'string' &&
  'status' in value &&
  ['Booked', 'Checked-in', 'Checked-out', 'Cancelled'].includes(String(value.status)) &&
  'guest_id' in value &&
  typeof value.guest_id === 'number' &&
  'guest' in value &&
  typeof value.guest === 'string' &&
  'staff_id' in value &&
  (typeof value.staff_id === 'number' || value.staff_id === null) &&
  'staff' in value &&
  (typeof value.staff === 'string' || value.staff === null) &&
  'rooms' in value &&
  (typeof value.rooms === 'string' || value.rooms === null) &&
  'paid' in value &&
  typeof value.paid === 'number' &&
  'payment_status' in value &&
  ['Paid', 'Pending'].includes(String(value.payment_status));

const isPaymentRecord = (value: unknown): value is PaymentRecord =>
  typeof value === 'object' &&
  value !== null &&
  'payment_id' in value &&
  typeof value.payment_id === 'number' &&
  'payment_date' in value &&
  typeof value.payment_date === 'string' &&
  'payment_method' in value &&
  ['Cash', 'Card', 'UPI', 'NetBanking'].includes(String(value.payment_method)) &&
  'payment_amount' in value &&
  typeof value.payment_amount === 'number' &&
  'reservation_id' in value &&
  typeof value.reservation_id === 'number' &&
  'guest' in value &&
  typeof value.guest === 'string';

const getDateOffset = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function App() {
  // Backend collections and related view state
  const [guests, setGuests] = useState<Guest[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [reservationRooms, setReservationRooms] = useState<ReservationRoom[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  // Navigation & UI state
  const [route, setRoute] = useState<PageRoute>('home');
  const [editingReservationId, setEditingReservationId] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedEstate, setSelectedEstate] = useState('Somerset House');
  const [flashes, setFlashes] = useState<FlashMessage[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [dashboardRefresh, setDashboardRefresh] = useState(0);
  const [guestsLoading, setGuestsLoading] = useState(false);
  const [guestsError, setGuestsError] = useState<string | null>(null);
  const [guestsRefresh, setGuestsRefresh] = useState(0);
  const [guestResults, setGuestResults] = useState<Guest[]>([]);
  const [guestSaving, setGuestSaving] = useState(false);
  const [guestDraft, setGuestDraft] = useState({ fname: '', minit: '', lname: '', phone: '', email: '' });
  const [guestSearchQuery, setGuestSearchQuery] = useState('');
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [roomsRefresh, setRoomsRefresh] = useState(0);
  const [roomResults, setRoomResults] = useState<Room[]>([]);
  const [roomSaving, setRoomSaving] = useState(false);
  const [roomDraft, setRoomDraft] = useState({
    room_number: '',
    room_type: 'Double' as RoomType,
    price: '6500',
    availability: 'Available' as RoomAvailability,
  });
  const [roomFilterType, setRoomFilterType] = useState<string>('');
  const [roomFilterAvail, setRoomFilterAvail] = useState<string>('');
  const [reservationsLoading, setReservationsLoading] = useState(true);
  const [reservationsError, setReservationsError] = useState<string | null>(null);
  const [reservationSaving, setReservationSaving] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [availableRoomsLoading, setAvailableRoomsLoading] = useState(false);
  const [availableRoomsError, setAvailableRoomsError] = useState<string | null>(null);
  const [reservationDraft, setReservationDraft] = useState({
    guestId: '' as number | '',
    staffId: '' as number | '',
    checkIn: getDateOffset(1),
    checkOut: getDateOffset(3),
    status: 'Booked' as ReservationStatus,
    selectedRoomIds: [] as number[],
    includePayment: false,
    paymentMethod: 'Card' as PaymentMethod,
    customPaymentAmount: '',
  });
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResults>({ guests: [], rooms: [], reservations: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [revenueReport, setRevenueReport] = useState<RevenueReportRow[]>([]);
  const [guestHistoryReport, setGuestHistoryReport] = useState<GuestHistoryReportRow[]>([]);
  const [staffWorkloadReport, setStaffWorkloadReport] = useState<StaffWorkloadReportRow[]>([]);
  const [revenueReportLoading, setRevenueReportLoading] = useState(true);
  const [guestHistoryReportLoading, setGuestHistoryReportLoading] = useState(true);
  const [staffWorkloadReportLoading, setStaffWorkloadReportLoading] = useState(true);
  const [revenueReportError, setRevenueReportError] = useState<string | null>(null);
  const [guestHistoryReportError, setGuestHistoryReportError] = useState<string | null>(null);
  const [staffWorkloadReportError, setStaffWorkloadReportError] = useState<string | null>(null);
  const [homeFeaturedRooms, setHomeFeaturedRooms] = useState<Room[]>([]);
  const [homeFeaturedRoomsLoading, setHomeFeaturedRoomsLoading] = useState(true);
  const [homeFeaturedRoomsError, setHomeFeaturedRoomsError] = useState<string | null>(null);
  const [homeAvailableRooms, setHomeAvailableRooms] = useState<Room[]>([]);
  const [homeAvailabilityLoading, setHomeAvailabilityLoading] = useState(false);
  const [homeAvailabilityError, setHomeAvailabilityError] = useState<string | null>(null);
  const [homeAvailabilitySearched, setHomeAvailabilitySearched] = useState(false);
  const [homeAvailabilityRequest, setHomeAvailabilityRequest] = useState<{ checkIn: string; checkOut: string } | null>(null);
  const [homeArrival, setHomeArrival] = useState(getDateOffset(1));
  const [homeDeparture, setHomeDeparture] = useState(getDateOffset(3));
  const [homeGuestsCount, setHomeGuestsCount] = useState('2');
  const [homeAccommodationType, setHomeAccommodationType] = useState('');
  const [paymentDraft, setPaymentDraft] = useState({
    reservationId: '' as number | '',
    method: 'Card' as PaymentMethod,
    amount: '',
    date: getDateOffset(0),
  });

  useEffect(() => {
    if (route !== 'dashboard') return;

    const controller = new AbortController();
    setDashboardLoading(true);
    setDashboardError(null);

    const loadDashboard = async () => {
      try {
        const response = await fetch('/api/dashboard', { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Dashboard request failed (${response.status} ${response.statusText}).`);
        }
        const data: DashboardData = await response.json();
        setDashboardData(data);
      } catch (error) {
        if (controller.signal.aborted) return;
        setDashboardError(error instanceof Error ? error.message : 'Unable to load dashboard.');
      } finally {
        if (!controller.signal.aborted) setDashboardLoading(false);
      }
    };

    void loadDashboard();
    return () => controller.abort();
  }, [route, dashboardRefresh]);

  useEffect(() => {
    const controller = new AbortController();
    setGuestsLoading(true);
    setGuestsError(null);
    const timeout = window.setTimeout(async () => {
      try {
        const query = new URLSearchParams();
        if (guestSearchQuery.trim()) query.set('search', guestSearchQuery.trim());
        const response = await fetch(`/api/guests${query.size ? `?${query.toString()}` : ''}`, {
          signal: controller.signal,
        });
        const data: unknown = await response.json();
        const apiError = apiErrorMessage(data, '');
        if (!response.ok || apiError) {
          throw new Error(apiError || `Guest request failed (${response.status} ${response.statusText}).`);
        }
        if (!Array.isArray(data) || !data.every(isGuest)) {
          throw new Error('The guest response had an unexpected format.');
        }
        setGuestResults(data);
        if (!guestSearchQuery.trim()) setGuests(data);
      } catch (error) {
        if (controller.signal.aborted) return;
        setGuestsError(error instanceof Error ? error.message : 'Unable to load guests.');
      } finally {
        if (!controller.signal.aborted) setGuestsLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [guestSearchQuery, guestsRefresh]);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams();
    if (roomFilterType) query.set('type', roomFilterType);
    if (roomFilterAvail) query.set('availability', roomFilterAvail);
    setRoomsLoading(true);
    setRoomsError(null);

    const loadRooms = async () => {
      try {
        const response = await fetch(`/api/rooms${query.size ? `?${query.toString()}` : ''}`, {
          signal: controller.signal,
        });
        const data: unknown = await response.json();
        const apiError = apiErrorMessage(data, '');
        if (!response.ok || apiError) {
          throw new Error(apiError || `Room request failed (${response.status} ${response.statusText}).`);
        }
        if (!Array.isArray(data) || !data.every(isRoom)) {
          throw new Error('The room response had an unexpected format.');
        }
        setRoomResults(data);
        if (!roomFilterType && !roomFilterAvail) setRooms(data);
      } catch (error) {
        if (controller.signal.aborted) return;
        setRoomsError(error instanceof Error ? error.message : 'Unable to load rooms.');
      } finally {
        if (!controller.signal.aborted) setRoomsLoading(false);
      }
    };

    void loadRooms();
    return () => controller.abort();
  }, [roomFilterType, roomFilterAvail, roomsRefresh]);

  useEffect(() => {
    const controller = new AbortController();
    const loadReservations = async () => {
      setReservationsLoading(true);
      setReservationsError(null);
      try {
        const response = await fetch('/api/reservations', { signal: controller.signal });
        const data: unknown = await response.json();
        const apiError = apiErrorMessage(data, '');
        if (!response.ok || apiError) {
          throw new Error(apiError || `Reservation request failed (${response.status} ${response.statusText}).`);
        }
        if (!Array.isArray(data) || !data.every(isReservationRecord)) {
          throw new Error('The reservation response had an unexpected format.');
        }
        setReservations(data);
      } catch (error) {
        if (controller.signal.aborted) return;
        setReservationsError(error instanceof Error ? error.message : 'Unable to load reservations.');
      } finally {
        if (!controller.signal.aborted) setReservationsLoading(false);
      }
    };

    void loadReservations();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const pendingReservations = reservations.filter((reservation) => reservation.payment_status === 'Pending');
    if (
      pendingReservations.length > 0 &&
      !pendingReservations.some((reservation) => reservation.reservation_id === paymentDraft.reservationId)
    ) {
      setPaymentDraft((draft) => ({ ...draft, reservationId: pendingReservations[0].reservation_id }));
    } else if (pendingReservations.length === 0 && paymentDraft.reservationId !== '') {
      setPaymentDraft((draft) => ({ ...draft, reservationId: '' }));
    }
  }, [reservations, paymentDraft.reservationId]);

  useEffect(() => {
    const controller = new AbortController();
    const loadPayments = async () => {
      setPaymentsLoading(true);
      setPaymentsError(null);
      try {
        const response = await fetch('/api/payments', { signal: controller.signal });
        const data: unknown = await response.json();
        const apiError = apiErrorMessage(data, '');
        if (!response.ok || apiError) {
          throw new Error(apiError || `Payment request failed (${response.status} ${response.statusText}).`);
        }
        if (!Array.isArray(data) || !data.every(isPaymentRecord)) {
          throw new Error('The payment response had an unexpected format.');
        }
        setPayments(data);
      } catch (error) {
        if (!controller.signal.aborted) {
          setPaymentsError(error instanceof Error ? error.message : 'Unable to load payments.');
        }
      } finally {
        if (!controller.signal.aborted) setPaymentsLoading(false);
      }
    };

    void loadPayments();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (route !== 'search') return;

    const controller = new AbortController();
    setSearchLoading(true);
    setSearchError(null);
    setSearchResults({ guests: [], rooms: [], reservations: [] });

    const timeout = window.setTimeout(async () => {
      try {
        const query = new URLSearchParams({ q: searchQuery.trim() });
        const response = await fetch(`/api/search?${query.toString()}`, { signal: controller.signal });
        const data: unknown = await response.json();
        const apiError = apiErrorMessage(data, '');
        if (!response.ok || apiError) {
          throw new Error(apiError || `Search request failed (${response.status} ${response.statusText}).`);
        }
        if (!isSearchResults(data)) {
          throw new Error('The search response had an unexpected format.');
        }
        setSearchResults(data);
      } catch (error) {
        if (!controller.signal.aborted) {
          setSearchError(error instanceof Error ? error.message : 'Unable to load search results.');
        }
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [route, searchQuery]);

  useEffect(() => {
    if (route !== 'reports') return;

    const controller = new AbortController();
    setRevenueReportLoading(true);
    setGuestHistoryReportLoading(true);
    setStaffWorkloadReportLoading(true);
    setRevenueReportError(null);
    setGuestHistoryReportError(null);
    setStaffWorkloadReportError(null);

    const loadReport = async <T,>(
      url: string,
      isReport: (value: unknown) => value is T[],
      setRows: React.Dispatch<React.SetStateAction<T[]>>,
      setError: React.Dispatch<React.SetStateAction<string | null>>,
      setLoading: React.Dispatch<React.SetStateAction<boolean>>
    ) => {
      try {
        const rows = await fetchReportRows(url, isReport, controller.signal);
        if (!controller.signal.aborted) setRows(rows);
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error instanceof Error ? error.message : 'Unable to load report.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void Promise.all([
      loadReport('/api/reports/revenue-by-method', isRevenueReport, setRevenueReport, setRevenueReportError, setRevenueReportLoading),
      loadReport('/api/reports/guest-history', isGuestHistoryReport, setGuestHistoryReport, setGuestHistoryReportError, setGuestHistoryReportLoading),
      loadReport('/api/reports/staff-workload', isStaffWorkloadReport, setStaffWorkloadReport, setStaffWorkloadReportError, setStaffWorkloadReportLoading),
    ]);

    return () => controller.abort();
  }, [route]);

  useEffect(() => {
    if (route !== 'home') return;

    const controller = new AbortController();
    setHomeFeaturedRoomsLoading(true);
    setHomeFeaturedRoomsError(null);

    const loadFeaturedRooms = async () => {
      try {
        const response = await fetch('/api/rooms?availability=Available', { signal: controller.signal });
        const data: unknown = await response.json();
        const apiError = apiErrorMessage(data, '');
        if (!response.ok || apiError) {
          throw new Error(apiError || `Featured room request failed (${response.status} ${response.statusText}).`);
        }
        if (!Array.isArray(data) || !data.every(isRoom)) {
          throw new Error('The featured room response had an unexpected format.');
        }
        const priority: Record<RoomType, number> = { Suite: 1, Deluxe: 2, Double: 3, Single: 4 };
        setHomeFeaturedRooms(
          data
            .filter((room) => room.room_type === 'Deluxe' || room.room_type === 'Suite' || room.room_type === 'Double')
            .sort((a, b) => priority[a.room_type] - priority[b.room_type] || a.room_number.localeCompare(b.room_number))
            .slice(0, 3)
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          setHomeFeaturedRoomsError(error instanceof Error ? error.message : 'Unable to load featured rooms.');
        }
      } finally {
        if (!controller.signal.aborted) setHomeFeaturedRoomsLoading(false);
      }
    };

    void loadFeaturedRooms();
    return () => controller.abort();
  }, [route]);

  useEffect(() => {
    if (route !== 'home' || !homeAvailabilityRequest) return;

    const controller = new AbortController();
    const query = new URLSearchParams({
      checkin: homeAvailabilityRequest.checkIn,
      checkout: homeAvailabilityRequest.checkOut,
    });
    setHomeAvailabilityLoading(true);
    setHomeAvailabilityError(null);
    setHomeAvailableRooms([]);

    const loadAvailability = async () => {
      try {
        const response = await fetch(`/api/rooms/available?${query.toString()}`, { signal: controller.signal });
        const data: unknown = await response.json();
        const apiError = apiErrorMessage(data, '');
        if (!response.ok || apiError) {
          throw new Error(apiError || `Availability request failed (${response.status} ${response.statusText}).`);
        }
        if (!Array.isArray(data) || !data.every(isRoom)) {
          throw new Error('The available room response had an unexpected format.');
        }
        setHomeAvailableRooms(data.filter((room) => (
          !homeAccommodationType || room.room_type === homeAccommodationType
        )));
      } catch (error) {
        if (!controller.signal.aborted) {
          setHomeAvailabilityError(error instanceof Error ? error.message : 'Unable to check room availability.');
        }
      } finally {
        if (!controller.signal.aborted) setHomeAvailabilityLoading(false);
      }
    };

    void loadAvailability();
    return () => controller.abort();
  }, [route, homeAvailabilityRequest, homeAccommodationType]);

  useEffect(() => {
    const controller = new AbortController();
    const loadStaff = async () => {
      try {
        const response = await fetch('/api/staff', { signal: controller.signal });
        const data: unknown = await response.json();
        const apiError = apiErrorMessage(data, '');
        if (!response.ok || apiError) {
          throw new Error(apiError || `Staff request failed (${response.status} ${response.statusText}).`);
        }
        if (!Array.isArray(data) || !data.every(isStaff)) {
          throw new Error('The staff response had an unexpected format.');
        }
        setStaff(data);
      } catch (error) {
        if (!controller.signal.aborted) {
          setStaffError(error instanceof Error ? error.message : 'Unable to load staff.');
        }
      }
    };

    void loadStaff();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (route !== 'reservation_form' || editingReservationId !== null || !reservationDraft.checkIn ||
        !reservationDraft.checkOut || reservationDraft.checkOut <= reservationDraft.checkIn) {
      setAvailableRooms([]);
      setAvailableRoomsError(null);
      setAvailableRoomsLoading(false);
      return;
    }

    const controller = new AbortController();
    setAvailableRoomsLoading(true);
    setAvailableRoomsError(null);
    setAvailableRooms([]);
    const query = new URLSearchParams({
      checkin: reservationDraft.checkIn,
      checkout: reservationDraft.checkOut,
    });
    const loadAvailableRooms = async () => {
      try {
        const response = await fetch(`/api/rooms/available?${query.toString()}`, { signal: controller.signal });
        const data: unknown = await response.json();
        const apiError = apiErrorMessage(data, '');
        if (!response.ok || apiError) {
          throw new Error(apiError || `Availability request failed (${response.status} ${response.statusText}).`);
        }
        if (!Array.isArray(data) || !data.every(isRoom)) {
          throw new Error('The available room response had an unexpected format.');
        }
        setAvailableRooms(data);
        setReservationDraft((draft) => ({
          ...draft,
          selectedRoomIds: draft.selectedRoomIds.filter((id) => data.some((room) => room.room_id === id)),
        }));
      } catch (error) {
        if (controller.signal.aborted) return;
        setAvailableRoomsError(error instanceof Error ? error.message : 'Unable to load available rooms.');
      } finally {
        if (!controller.signal.aborted) setAvailableRoomsLoading(false);
      }
    };

    void loadAvailableRooms();
    return () => controller.abort();
  }, [route, editingReservationId, reservationDraft.checkIn, reservationDraft.checkOut]);

  useEffect(() => {
    if (route === 'reservation_form' && reservationDraft.guestId === '' && guests.length > 0) {
      setReservationDraft((draft) => ({ ...draft, guestId: guests[0].guest_id }));
    }
  }, [route, reservationDraft.guestId, guests]);

  // Confirmation modal state (replaces window.confirm for iframe compatibility)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Editing / Preselection contexts
  const [editingGuestId, setEditingGuestId] = useState<number | null>(null);
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [preselectedDates, setPreselectedDates] = useState<{ checkIn: string; checkOut: string }>({
    checkIn: getDateOffset(1),
    checkOut: getDateOffset(3),
  });

  // Filter / Search states
  const [reportSortOrder, setReportSortOrder] = useState<'desc' | 'asc'>('desc');

  // Search Page states
  const [searchCheckIn, setSearchCheckIn] = useState('2026-10-25');
  const [searchCheckOut, setSearchCheckOut] = useState('2026-10-28');
  const [searchRoomType, setSearchRoomType] = useState('');

  // Home Availability Bar state
  const [newsletterEmail, setNewsletterEmail] = useState('');

  const addFlash = (message: string, category: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random();
    setFlashes((prev) => [...prev, { id, category, message }]);
  };

  const removeFlash = (id: number) => {
    setFlashes((prev) => prev.filter((f) => f.id !== id));
  };

  const navigate = (target: PageRoute) => {
    setRoute(target);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openGuestForm = (guest: Guest | null) => {
    setEditingGuestId(guest?.guest_id ?? null);
    setGuestDraft({
      fname: guest?.fname ?? '',
      minit: guest?.minit ?? '',
      lname: guest?.lname ?? '',
      phone: guest?.phone ?? '',
      email: guest?.email ?? '',
    });
    setGuestsError(null);
    navigate('guest_form');
  };

  const refreshGuestCollection = async () => {
    const response = await fetch('/api/guests');
    const data: unknown = await response.json();
    const apiError = apiErrorMessage(data, '');
    if (!response.ok || apiError) {
      throw new Error(apiError || `Guest refresh failed (${response.status} ${response.statusText}).`);
    }
    if (!Array.isArray(data) || !data.every(isGuest)) {
      throw new Error('The guest response had an unexpected format.');
    }
    setGuests(data);
  };

  const openRoomForm = (room: Room | null) => {
    setEditingRoomId(room?.room_id ?? null);
    setRoomDraft({
      room_number: room?.room_number ?? '',
      room_type: room?.room_type ?? 'Double',
      price: room ? String(room.price) : '6500',
      availability: room?.availability ?? 'Available',
    });
    setRoomsError(null);
    navigate('room_form');
  };

  const refreshRoomCollection = async () => {
    const response = await fetch('/api/rooms');
    const data: unknown = await response.json();
    const apiError = apiErrorMessage(data, '');
    if (!response.ok || apiError) {
      throw new Error(apiError || `Room refresh failed (${response.status} ${response.statusText}).`);
    }
    if (!Array.isArray(data) || !data.every(isRoom)) {
      throw new Error('The room response had an unexpected format.');
    }
    setRooms(data);
  };

  const refreshReservationCollection = async () => {
    const response = await fetch('/api/reservations');
    const data: unknown = await response.json();
    const apiError = apiErrorMessage(data, '');
    if (!response.ok || apiError) {
      throw new Error(apiError || `Reservation refresh failed (${response.status} ${response.statusText}).`);
    }
    if (!Array.isArray(data) || !data.every(isReservationRecord)) {
      throw new Error('The reservation response had an unexpected format.');
    }
    setReservations(data);
  };

  const refreshPaymentCollection = async () => {
    const response = await fetch('/api/payments');
    const data: unknown = await response.json();
    const apiError = apiErrorMessage(data, '');
    if (!response.ok || apiError) {
      throw new Error(apiError || `Payment refresh failed (${response.status} ${response.statusText}).`);
    }
    if (!Array.isArray(data) || !data.every(isPaymentRecord)) {
      throw new Error('The payment response had an unexpected format.');
    }
    setPayments(data);
  };

  const openReservationForm = (
    reservation: ReservationRecord | null,
    roomId: number | null = null,
    dates?: { checkIn: string; checkOut: string }
  ) => {
    setEditingReservationId(reservation?.reservation_id ?? null);
    if (dates) setPreselectedDates(dates);
    setReservationsError(null);
    setReservationDraft({
      guestId: reservation?.guest_id ?? guests[0]?.guest_id ?? '',
      staffId: reservation?.staff_id ?? '',
      checkIn: reservation?.check_in_date ?? dates?.checkIn ?? preselectedDates.checkIn ?? getDateOffset(1),
      checkOut: reservation?.check_out_date ?? dates?.checkOut ?? preselectedDates.checkOut ?? getDateOffset(3),
      status: reservation?.status ?? 'Booked',
      selectedRoomIds: roomId === null ? [] : [roomId],
      includePayment: false,
      paymentMethod: 'Card',
      customPaymentAmount: '',
    });
    navigate('reservation_form');
  };

  // =====================================================
  // SQL HELPER QUERIES (Mirroring PostgreSQL hotel_db)
  // =====================================================

  // Available rooms for date range query (Section 6F)
  const getFreeRoomsForDates = (checkIn: string, checkOut: string, typeFilter?: string): Room[] => {
    if (!checkIn || !checkOut || checkOut <= checkIn) return [];
    const bookedRoomIds = new Set<number>();
    reservations.forEach((r) => {
      if (r.status !== 'Cancelled' && r.check_in_date < checkOut && r.check_out_date > checkIn) {
        reservationRooms
          .filter((rr) => rr.reservation_id === r.reservation_id)
          .forEach((rr) => bookedRoomIds.add(rr.room_id));
      }
    });

    return rooms
      .filter((rm) => {
        if (rm.availability === 'Maintenance') return false;
        if (bookedRoomIds.has(rm.room_id)) return false;
        if (typeFilter && rm.room_type !== typeFilter) return false;
        return true;
      })
      .sort((a, b) => a.room_number.localeCompare(b.room_number));
  };

  // =====================================================
  // SUB-COMPONENTS FOR EACH SCREEN
  // =====================================================

  // 1. HOME SCREEN
  const renderHome = () => {
    const availabilityCheckIn = homeAvailabilityRequest?.checkIn ?? homeArrival;
    const availabilityCheckOut = homeAvailabilityRequest?.checkOut ?? homeDeparture;
    const sanctuaries = [
      {
        title: 'The Cotswolds',
        tag: 'Flagship',
        img: '/src/assets/images/sanctuary_cotswolds_1792933828102.jpg',
        desc: 'Honey-stone manor house framed by lavender parterres, dry-stone walls, and centuries-old cider orchards.',
        footer: 'Explore Gloucestershire Estate',
      },
      {
        title: 'Cornwall',
        tag: 'Coastal',
        img: '/src/assets/images/sanctuary_cornwall_1792933828983.jpg',
        desc: 'Weathered granite cliffside refuge overlooking the Atlantic swell, wild sea thrift paths, and hidden coves.',
        footer: 'Explore Atlantic Sanctuary',
      },
      {
        title: 'Lake District',
        tag: 'Lakefront',
        img: '/src/assets/images/sanctuary_lakedistrict_1792933830337.jpg',
        desc: 'Cumbrian slate country house with private timber jetty, mirrored fell waters, and birch woodland trails.',
        footer: 'Explore Waterside Quarters',
      },
      {
        title: 'Scottish Highlands',
        tag: 'Wilderness',
        img: '/src/assets/images/sanctuary_highlands_1792933831626.jpg',
        desc: 'Secluded glen lodge surrounded by purple heather moors, peat fires, and dramatic Highland ridges.',
        footer: 'Explore Highland Lodge',
      },
    ];

    const handleAvailabilitySubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!homeArrival || !homeDeparture || homeDeparture <= homeArrival) {
        setHomeAvailabilitySearched(false);
        setHomeAvailabilityError('Departure date must be after arrival date.');
        addFlash('Departure date must be after arrival date.', 'error');
        return;
      }
      setHomeAvailabilityError(null);
      setHomeAvailabilitySearched(true);
      setHomeAvailabilityRequest({ checkIn: homeArrival, checkOut: homeDeparture });
    };

    const handleNewsletterSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newsletterEmail.trim()) return;
      addFlash(
        'Thank you. Your address has been inscribed for seasonal dispatches from the Hartwell estate grounds.',
        'success'
      );
      setNewsletterEmail('');
    };

    return (
      <div>
        {/* 1. Full-width Hero */}
        <section className="relative min-h-[540px] flex items-center justify-center text-center text-white bg-[#2B2620] overflow-hidden">
          <img
            src="/src/assets/images/hero_countryside_estate_1792933826538.jpg"
            alt="Hartwell Somerset Estate in the misty English countryside"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1E1915]/80 via-[#2B2620]/45 to-[#2B2620]/35" />

          <div className="relative z-10 max-w-3xl mx-auto px-6 pt-16 pb-28">
            <div className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#EFE8DC] mb-4">
              Hartwell &bull; Somerset Estate
            </div>
            <h1
              className="text-4xl sm:text-5xl md:text-[56px] text-white leading-[1.1] mb-5 font-serif-editorial"
              style={{ textWrap: 'balance' }}
            >
              A refuge in the English countryside
            </h1>
            <p className="text-base sm:text-lg text-[#FBF7F0]/90 max-w-xl mx-auto mb-8 font-normal leading-relaxed">
              Set amidst three hundred acres of misty Somerset pastureland, ancient beech woods, and walled kitchen
              gardens. Restored for quiet contemplation.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => openReservationForm(null)}
                className="px-6 py-3 bg-[#8B3E1F] hover:bg-[#6E2F15] text-white text-sm font-medium rounded-[5px] transition-colors cursor-pointer"
              >
                Plan Your Retreat
              </button>
              <a
                href="#sanctuary-rooms-section"
                className="px-6 py-3 bg-white/15 hover:bg-white/25 text-white border border-white/50 text-sm font-medium rounded-[5px] transition-colors"
              >
                Explore The Quarters
              </a>
            </div>
          </div>
        </section>

        {/* 2. Floating Availability Bar */}
        <section className="relative z-20 max-w-[1180px] mx-auto px-6 -mt-14 mb-12">
          <form
            onSubmit={handleAvailabilitySubmit}
            className="bg-white border border-[#E2D9C8] rounded-[6px] p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end"
          >
            <div>
              <label className="block text-[11px] font-semibold tracking-[0.14em] uppercase text-[#6E655B] mb-1.5">
                Arrival Date
              </label>
              <input
                type="date"
                value={homeArrival}
                onChange={(e) => setHomeArrival(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px] text-[#2B2620] focus:outline-none focus:border-[#8B3E1F]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold tracking-[0.14em] uppercase text-[#6E655B] mb-1.5">
                Departure Date
              </label>
              <input
                type="date"
                value={homeDeparture}
                onChange={(e) => setHomeDeparture(e.target.value)}
                min={homeArrival}
                required
                className="w-full px-3 py-2 text-sm bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px] text-[#2B2620] focus:outline-none focus:border-[#8B3E1F]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold tracking-[0.14em] uppercase text-[#6E655B] mb-1.5">
                Guests
              </label>
              <select
                value={homeGuestsCount}
                onChange={(e) => setHomeGuestsCount(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px] text-[#2B2620] focus:outline-none focus:border-[#8B3E1F]"
              >
                <option value="1">1 Guest</option>
                <option value="2">2 Guests</option>
                <option value="3">3 Guests</option>
                <option value="4">4 Guests</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold tracking-[0.14em] uppercase text-[#6E655B] mb-1.5">
                Accommodations
              </label>
              <select
                value={homeAccommodationType}
                onChange={(e) => setHomeAccommodationType(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px] text-[#2B2620] focus:outline-none focus:border-[#8B3E1F]"
              >
                <option value="">All Sanctuary Types</option>
                <option value="Single">Single</option>
                <option value="Double">Double</option>
                <option value="Deluxe">Deluxe</option>
                <option value="Suite">Suite</option>
              </select>
            </div>
            <div>
              <button
                type="submit"
                disabled={homeAvailabilityLoading}
                className="w-full py-2.5 px-4 bg-[#8B3E1F] hover:bg-[#6E2F15] text-white text-sm font-medium rounded-[5px] transition-colors cursor-pointer whitespace-nowrap"
              >
                {homeAvailabilityLoading ? 'Checking...' : 'Check Availability →'}
              </button>
            </div>
          </form>
          {(homeAvailabilitySearched || homeAvailabilityError) && (
            <div className="bg-white border border-[#E2D9C8] rounded-[6px] p-5 sm:p-6 mt-4">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-serif-editorial text-[#2B2620]">
                  Available Rooms &bull; {availabilityCheckIn} to {availabilityCheckOut}
                </h2>
                {!homeAvailabilityLoading && !homeAvailabilityError && (
                  <span className="text-xs text-[#6E655B] tabular-nums">{homeAvailableRooms.length} room(s) free</span>
                )}
              </div>
              {homeAvailabilityLoading ? (
                <div role="status" className="py-4 text-center text-sm text-[#6E655B]">Checking available rooms...</div>
              ) : homeAvailabilityError ? (
                <div role="alert" className="py-4 text-center text-sm text-[#8B3E1F]">{homeAvailabilityError}</div>
              ) : homeAvailableRooms.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {homeAvailableRooms.map((room) => (
                    <article key={room.room_id} className="border border-[#E2D9C8] rounded-[5px] p-4 bg-[#FBF7F0]">
                      <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#6E655B]">
                        Room {room.room_number} &middot; {room.room_type}
                      </div>
                      <div className="text-sm font-medium text-[#2B2620] mt-1 mb-3">
                        {formatInr(room.price)} / night
                      </div>
                      <button
                        type="button"
                        onClick={() => openReservationForm(null, room.room_id, {
                          checkIn: availabilityCheckIn,
                          checkOut: availabilityCheckOut,
                        })}
                        className="w-full py-2 px-4 bg-[#8B3E1F] hover:bg-[#6E2F15] text-white text-xs font-medium rounded-[5px] transition-colors cursor-pointer"
                      >
                        Reserve
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="py-4 text-center text-sm text-[#6E655B]">No rooms are available for these dates.</div>
              )}
            </div>
          )}
        </section>

        {/* 3. The Collection – Country Sanctuaries */}
        <section className="max-w-[1240px] mx-auto px-6 py-14">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
            <div>
              <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#6E655B] mb-1.5">
                The Collection
              </div>
              <h2 className="text-3xl sm:text-4xl text-[#2B2620] font-serif-editorial">Country Sanctuaries</h2>
            </div>
            <p className="text-sm text-[#6E655B] max-w-md">
              Four architectural estates across the British Isles, united by unhurried seasonal living and quiet
              pastoral landscapes.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {sanctuaries.map((item) => (
              <article
                key={item.title}
                className="bg-white border border-[#E2D9C8] rounded-[6px] overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-52 bg-[#EFE8DC]">
                    <img
                      src={item.img}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-3 left-3 bg-[#FBF7F0]/95 text-[#2B2620] border border-[#E2D9C8] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] rounded-[4px]">
                      {item.tag}
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="text-xl text-[#2B2620] font-serif-editorial mb-2">{item.title}</h3>
                    <p className="text-sm text-[#6E655B] leading-relaxed">{item.desc}</p>
                  </div>
                </div>
                <div className="px-5 py-3.5 border-t border-[#E2D9C8] flex items-center justify-between text-xs font-medium text-[#8B3E1F] hover:text-[#6E2F15]">
                  <button
                    type="button"
                    onClick={() => navigate('rooms')}
                    className="w-full flex items-center justify-between cursor-pointer text-left"
                  >
                    <span>{item.footer}</span>
                    <span>&rarr;</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* 4. Sanctuary Rooms & Suites on Sand Band (Pulled from DB) */}
        <section id="sanctuary-rooms-section" className="bg-[#EFE8DC] border-y border-[#E2D9C8] py-16">
          <div className="max-w-[1240px] mx-auto px-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
              <div>
                <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#6E655B] mb-1.5">
                  Accommodations &bull; From Estate Database
                </div>
                <h2 className="text-3xl sm:text-4xl text-[#2B2620] font-serif-editorial">
                  Sanctuary Rooms &amp; Suites
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('rooms')}
                className="text-sm font-medium text-[#8B3E1F] hover:text-[#6E2F15] cursor-pointer"
              >
                Inspect All Rooms ({rooms.length}) &rarr;
              </button>
            </div>

            {homeFeaturedRoomsLoading ? (
              <div role="status" className="bg-white border border-[#E2D9C8] rounded-[6px] p-8 text-center text-sm text-[#6E655B]">
                Loading featured rooms...
              </div>
            ) : homeFeaturedRoomsError ? (
              <div role="alert" className="bg-white border border-[#E2D9C8] rounded-[6px] p-8 text-center text-sm text-[#8B3E1F]">
                {homeFeaturedRoomsError}
              </div>
            ) : homeFeaturedRooms.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {homeFeaturedRooms.map((room) => {
                  const features = getRoomFeatures(room.room_type);
                  return (
                    <article
                      key={room.room_id}
                      className="bg-white border border-[#E2D9C8] rounded-[6px] overflow-hidden flex flex-col justify-between"
                    >
                      <div>
                        <div className="relative h-60 bg-[#EFE8DC]">
                          <img
                            src={getRoomImage(room.room_type)}
                            alt={getRoomDisplayName(room.room_type)}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-3 left-3 bg-[#FBF7F0]/95 text-[#2B2620] border border-[#E2D9C8] px-3 py-1 text-xs font-semibold rounded-[4px] tabular-nums">
                            {formatInr(room.price)} / night
                          </span>
                        </div>
                        <div className="p-6">
                          <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#6E655B] mb-1">
                            Room {room.room_number} &middot; {room.room_type}
                          </div>
                          <h3 className="text-2xl text-[#2B2620] font-serif-editorial mb-3">
                            {getRoomDisplayName(room.room_type)}
                          </h3>
                          <div className="space-y-1.5 text-xs text-[#6E655B] border-t border-[#E2D9C8] pt-3 mb-5">
                            <div>&bull; {features[0]}</div>
                            <div>&bull; {features[1]}</div>
                          </div>
                        </div>
                      </div>
                      <div className="px-6 pb-6">
                        <button
                          type="button"
                          onClick={() => openReservationForm(null, room.room_id)}
                          className="w-full py-2.5 px-4 bg-[#8B3E1F] hover:bg-[#6E2F15] text-white text-sm font-medium rounded-[5px] transition-colors cursor-pointer"
                        >
                          Reserve Room
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white border border-[#E2D9C8] rounded-[6px] p-8 text-center text-sm text-[#6E655B]">
                No available rooms currently listed. Visit the Rooms screen to update availability.
              </div>
            )}
          </div>
        </section>

        {/* 5. Ethos Section */}
        <section className="max-w-[1240px] mx-auto px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left: Large interior photo + two small photos */}
            <div className="lg:col-span-6 space-y-4">
              <div className="h-72 sm:h-80 bg-[#EFE8DC] border border-[#E2D9C8] rounded-[6px] overflow-hidden">
                <img
                  src="/src/assets/images/ethos_glasshouse_library_1792933835243.jpg"
                  alt="The Glasshouse Restaurant at Hartwell"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="h-40 bg-[#EFE8DC] border border-[#E2D9C8] rounded-[6px] overflow-hidden">
                  <img
                    src="/src/assets/images/room_suite_interior_1792933833713.jpg"
                    alt="The Estate Library hearth"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="h-40 bg-[#EFE8DC] border border-[#E2D9C8] rounded-[6px] overflow-hidden">
                  <img
                    src="/src/assets/images/sanctuary_cotswolds_1792933828102.jpg"
                    alt="Walled lavender garden"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>

            {/* Right: Editorial text & 2 info boxes */}
            <div className="lg:col-span-6">
              <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#6E655B] mb-2">
                The Estate Ethos
              </div>
              <h2 className="text-3xl sm:text-4xl text-[#2B2620] font-serif-editorial leading-tight mb-4">
                An unhurried tempo governed by the seasons
              </h2>
              <p className="text-sm sm:text-base text-[#6E655B] leading-relaxed mb-6">
                At Hartwell, days unfold without schedule. Morning mist rises over the limestone ha-ha wall while
                heritage apples, wild fennel, and heirloom greens are gathered from our two-acre kitchen garden for the
                evening table.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-white border border-[#E2D9C8] rounded-[6px] p-4">
                  <h4 className="text-base font-serif-editorial text-[#2B2620] mb-1.5">The Glasshouse Restaurant</h4>
                  <p className="text-xs text-[#6E655B] leading-relaxed">
                    Victorian conservatory dining celebrating hyper-seasonal Somerset produce, wood-fired hearth
                    cookery, and estate-pressed perry.
                  </p>
                </div>
                <div className="bg-white border border-[#E2D9C8] rounded-[6px] p-4">
                  <h4 className="text-base font-serif-editorial text-[#2B2620] mb-1.5">
                    The Estate Library &amp; Drawing Room
                  </h4>
                  <p className="text-xs text-[#6E655B] leading-relaxed">
                    Three thousand leather-bound volumes, deep linen sofas, and an honesty bar stocked with small-batch
                    botanical infusions.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('reports')}
                className="text-sm font-medium text-[#8B3E1F] hover:text-[#6E2F15] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Read The Estate Chronicles</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* 6. Newsletter Block & Estate Coordinates Card */}
        <section className="bg-[#EFE8DC] border-t border-[#E2D9C8] py-16">
          <div className="max-w-[1240px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Newsletter */}
            <div className="lg:col-span-7 bg-white border border-[#E2D9C8] rounded-[6px] p-8 flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#6E655B] mb-2">
                  Estate Dispatches
                </div>
                <h3 className="text-2xl sm:text-3xl text-[#2B2620] font-serif-editorial mb-3">
                  Seasonal dispatches from the estate grounds
                </h3>
                <p className="text-sm text-[#6E655B] max-w-xl mb-6">
                  Receive quiet notes on orchard harvests, autumn foraging walks, and winter residencies across Somerset
                  and the Cotswolds. Sent four times a year.
                </p>
              </div>
              <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Enter your electronic mail address..."
                  required
                  className="flex-1 px-4 py-2.5 text-sm bg-[#FBF7F0] border border-[#E2D9C8] rounded-[5px] text-[#2B2620] focus:outline-none focus:border-[#8B3E1F]"
                />
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#8B3E1F] hover:bg-[#6E2F15] text-white text-sm font-medium rounded-[5px] transition-colors cursor-pointer shrink-0"
                >
                  Subscribe
                </button>
              </form>
            </div>

            {/* Right: Estate Coordinates Card */}
            <div className="lg:col-span-5 bg-white border border-[#E2D9C8] rounded-[6px] p-8 flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#6E655B] mb-2">
                  Estate Coordinates
                </div>
                <h3 className="text-2xl text-[#2B2620] font-serif-editorial mb-3">Hartwell Manor House</h3>
                <p className="text-sm text-[#6E655B] leading-relaxed">
                  Honeybourne Lane, Chipping Campden Ridge
                  <br />
                  Gloucestershire, GL55 6JH
                  <br />
                  United Kingdom
                </p>
              </div>
              <div className="border-t border-[#E2D9C8] pt-4 mt-6 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E655B]">
                    Concierge Desk
                  </div>
                  <div className="font-medium text-[#2B2620] mt-0.5 tabular-nums">+44 (0) 1386 840 201</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E655B]">
                    Coordinates
                  </div>
                  <div className="font-medium text-[#2B2620] mt-0.5 tabular-nums">52&deg;02&prime;N 01&deg;46&prime;W</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  };

  // 2. DASHBOARD SCREEN (/dashboard)
  const renderDashboard = () => {
    const maxMethodTotal = Math.max(
      1,
      ...(dashboardData?.revenue_by_method.map((row) => row.total) ?? [])
    );

    return (
      <div className="max-w-[1240px] mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#6E655B] mb-1">
              Estate Administration &bull; /dashboard
            </div>
            <h1 className="text-3xl sm:text-4xl text-[#2B2620] font-serif-editorial">Steward&rsquo;s Dashboard</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => openReservationForm(null)}
              className="px-4 py-2 bg-[#8B3E1F] hover:bg-[#6E2F15] text-white text-xs font-medium rounded-[5px] cursor-pointer"
            >
              + New Reservation
            </button>
            <button
              type="button"
              onClick={() => openGuestForm(null)}
              className="px-4 py-2 bg-white border border-[#E2D9C8] hover:bg-[#EFE8DC] text-[#2B2620] text-xs font-medium rounded-[5px] cursor-pointer"
            >
              + Add Guest
            </button>
          </div>
        </div>

        {dashboardLoading ? (
          <div role="status" className="bg-white border border-[#E2D9C8] rounded-[6px] p-6 text-sm text-[#6E655B]">
            Loading dashboard...
          </div>
        ) : dashboardError ? (
          <div role="alert" className="bg-white border border-[#E2D9C8] rounded-[6px] p-6 flex flex-wrap items-center justify-between gap-4">
            <span className="text-sm text-[#6E655B]">{dashboardError}</span>
            <button
              type="button"
              onClick={() => setDashboardRefresh((current) => current + 1)}
              className="px-4 py-2 bg-white border border-[#E2D9C8] hover:bg-[#EFE8DC] text-[#2B2620] text-xs font-medium rounded-[5px] cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : dashboardData ? (
          <>
        {/* 4 Figures */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-white border border-[#E2D9C8] rounded-[6px] p-6">
            <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#6E655B]">Total Guests</div>
            <div className="text-3xl font-serif-editorial text-[#2B2620] mt-2 mb-1 tabular-nums">
              {dashboardData.total_guests}
            </div>
            <div className="text-xs text-[#6E655B]">Registered in Guest table</div>
          </div>
          <div className="bg-white border border-[#E2D9C8] rounded-[6px] p-6">
            <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#6E655B]">Total Rooms</div>
            <div className="text-3xl font-serif-editorial text-[#2B2620] mt-2 mb-1 tabular-nums">
              {dashboardData.total_rooms}
            </div>
            <div className="text-xs text-[#6E655B]">Sanctuary quarters &amp; suites</div>
          </div>
          <div className="bg-white border border-[#E2D9C8] rounded-[6px] p-6">
            <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#6E655B]">
              Active Reservations
            </div>
            <div className="text-3xl font-serif-editorial text-[#2B2620] mt-2 mb-1 tabular-nums">
              {dashboardData.active_reservations}
            </div>
            <div className="text-xs text-[#6E655B]">Status IN (&lsquo;Booked&rsquo;, &lsquo;Checked-in&rsquo;)</div>
          </div>
          <div className="bg-white border border-[#E2D9C8] rounded-[6px] p-6">
            <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#6E655B]">
              Total Revenue (INR)
            </div>
            <div className="text-3xl font-serif-editorial text-[#8B3E1F] mt-2 mb-1 tabular-nums">
              {formatInr(dashboardData.total_revenue)}
            </div>
            <div className="text-xs text-[#6E655B]">SUM(payment_amount) in ₹</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Latest 5 Reservations */}
          <div className="lg:col-span-7 bg-white border border-[#E2D9C8] rounded-[6px] p-6">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#E2D9C8]">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E655B]">
                  STRING_AGG(room_number)
                </div>
                <h2 className="text-xl font-serif-editorial text-[#2B2620]">Latest 5 Reservations</h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('reservations')}
                className="text-xs font-medium text-[#8B3E1F] hover:underline cursor-pointer"
              >
                View All &rarr;
              </button>
            </div>

            {dashboardData.latest_reservations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2D9C8] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6E655B]">
                      <th className="py-2.5 pr-3">ID</th>
                      <th className="py-2.5 px-3">Guest Name</th>
                      <th className="py-2.5 px-3">Rooms</th>
                      <th className="py-2.5 px-3">Dates</th>
                      <th className="py-2.5 pl-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2D9C8] text-sm">
                    {dashboardData.latest_reservations.map((r) => (
                      <tr key={r.reservation_id} className="hover:bg-[#FBF7F0]/60">
                        <td className="py-3 pr-3 tabular-nums text-xs text-[#6E655B]">#{r.reservation_id}</td>
                        <td className="py-3 px-3 font-medium text-[#2B2620]">{r.guest}</td>
                        <td className="py-3 px-3 tabular-nums text-xs">Room {r.rooms || '—'}</td>
                        <td className="py-3 px-3 tabular-nums text-xs text-[#6E655B]">
                          {r.check_in_date} &rarr; {r.check_out_date}
                        </td>
                        <td className="py-3 pl-3 text-xs font-medium text-[#2B2620]">{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-[#6E655B]">No reservations found.</div>
            )}
          </div>

          {/* Pure CSS Bar Chart of Revenue by Payment Method */}
          <div className="lg:col-span-5 bg-white border border-[#E2D9C8] rounded-[6px] p-6">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#E2D9C8]">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E655B]">
                  GROUP BY payment_method
                </div>
                <h2 className="text-xl font-serif-editorial text-[#2B2620]">Revenue by Payment Method</h2>
              </div>
              <span className="text-xs font-semibold text-[#8B3E1F]">INR (₹)</span>
            </div>

            {dashboardData.revenue_by_method.length > 0 ? (
              <div className="space-y-5">
                {dashboardData.revenue_by_method.map((row, idx) => {
                  const widthPct = Math.max(6, Math.round((row.total / maxMethodTotal) * 100));
                  const barColor = idx % 2 === 0 ? 'bg-[#8B3E1F]' : 'bg-[#5C6446]';
                  return (
                    <div key={row.payment_method}>
                      <div className="flex items-baseline justify-between text-xs mb-1.5">
                        <span className="font-semibold text-[#2B2620]">
                          {row.payment_method}
                        </span>
                        <span className="font-semibold text-[#2B2620] tabular-nums">{formatInr(row.total)}</span>
                      </div>
                      <div className="w-full h-3 bg-[#EFE8DC] rounded-[3px] overflow-hidden">
                        <div
                          className={`h-full ${barColor} rounded-[3px] transition-all duration-300`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-[#6E655B]">No payment settlements recorded.</div>
            )}
          </div>
        </div>
          </>
        ) : null}
      </div>
    );
  };

  // 3. GUESTS SCREEN (/guests)
  const renderGuests = () => {
    const handleDeleteGuest = (g: Guest) => {
      setConfirmDialog({
        title: `Delete Guest #${g.guest_id} (${g.fname} ${g.lname})?`,
        message: `Deleting ${g.fname} ${g.lname} will also remove the guest's reservations.`,
        onConfirm: async () => {
          setConfirmDialog(null);
          setGuestsError(null);
          try {
            const response = await fetch(`/api/guests/${g.guest_id}`, { method: 'DELETE' });
            const data: unknown = await response.json();
            const apiError = apiErrorMessage(data, '');
            if (!response.ok || apiError) {
              throw new Error(apiError || `Delete failed (${response.status} ${response.statusText}).`);
            }
            setGuests((current) => current.filter((guest) => guest.guest_id !== g.guest_id));
            setGuestsRefresh((current) => current + 1);
            await refreshGuestCollection();
            addFlash(`Guest ${g.fname} ${g.lname} deleted.`, 'success');
          } catch (error) {
            setGuestsError(error instanceof Error ? error.message : 'Unable to delete guest.');
          }
        },
      });
    };

    return (
      <div className="max-w-[1240px] mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#6E655B] mb-1">
              Guest Registry &bull; /guests
            </div>
            <h1 className="text-3xl sm:text-4xl text-[#2B2620] font-serif-editorial">Estate Guests</h1>
          </div>
          <button
            type="button"
            onClick={() => openGuestForm(null)}
            className="px-4 py-2.5 bg-[#8B3E1F] hover:bg-[#6E2F15] text-white text-xs font-medium rounded-[5px] cursor-pointer"
          >
            + Add Guest
          </button>
        </div>

        {/* Search Box */}
        <div className="bg-white border border-[#E2D9C8] rounded-[6px] p-4 mb-6 flex flex-col sm:flex-row gap-3 items-center">
          <input
            type="text"
            value={guestSearchQuery}
            onChange={(e) => setGuestSearchQuery(e.target.value)}
            placeholder="Filter guests by name or telephone..."
            className="flex-1 w-full px-3.5 py-2 text-sm bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px] text-[#2B2620] focus:outline-none focus:border-[#8B3E1F]"
          />
          {guestSearchQuery && (
            <button
              type="button"
              onClick={() => setGuestSearchQuery('')}
              className="px-4 py-2 text-xs font-medium bg-[#EFE8DC] text-[#2B2620] rounded-[4px] cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>

        {guestsError && (
          <div role="alert" className="bg-[#FDF2EF] border border-[#D8B4A6] text-[#8B3E1F] rounded-[5px] px-4 py-3 mb-6 text-sm">
            {guestsError}
          </div>
        )}

        <div className="bg-white border border-[#E2D9C8] rounded-[6px] p-6">
          {guestsLoading ? (
            <div role="status" className="py-10 text-center text-sm text-[#6E655B]">Loading guests...</div>
          ) : guestResults.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2D9C8] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6E655B]">
                    <th className="py-3 pr-4">ID</th>
                    <th className="py-3 px-4">Guest Name</th>
                    <th className="py-3 px-4">Phone (Unique)</th>
                    <th className="py-3 px-4">Email (Unique)</th>
                    <th className="py-3 pl-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2D9C8] text-sm">
                  {guestResults.map((g) => (
                    <tr key={g.guest_id} className="hover:bg-[#FBF7F0]/60">
                      <td className="py-3.5 pr-4 tabular-nums text-xs text-[#6E655B]">#{g.guest_id}</td>
                      <td className="py-3.5 px-4 font-medium text-[#2B2620]">
                        {g.fname} {g.minit ? `${g.minit}. ` : ''}
                        {g.lname}
                      </td>
                      <td className="py-3.5 px-4 tabular-nums text-[#2B2620]">{g.phone}</td>
                      <td className="py-3.5 px-4 text-[#6E655B]">{g.email}</td>
                      <td className="py-3.5 pl-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openGuestForm(g)}
                          className="px-3 py-1 text-xs font-medium bg-[#FBF7F0] border border-[#E2D9C8] hover:bg-[#EFE8DC] text-[#2B2620] rounded-[4px] cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGuest(g)}
                          className="px-3 py-1 text-xs font-medium bg-white border border-[#D8B4A6] hover:bg-[#8B3E1F] hover:text-white text-[#8B3E1F] rounded-[4px] transition-colors cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-[#6E655B]">
              {guestSearchQuery.trim() ? 'No guests found matching your search.' : 'No guests found.'}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 3B. GUEST FORM (Add / Edit)
  const renderGuestForm = () => {
    const { fname, minit, lname, phone, email } = guestDraft;

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const cleanFname = fname.trim();
      const cleanMinit = minit.trim() || null;
      const cleanLname = lname.trim();
      const cleanPhone = phone.trim();
      const cleanEmail = email.trim();

      if (!cleanFname || !cleanLname || !cleanPhone || !cleanEmail) {
        addFlash('First name, last name, phone, and email are required.', 'error');
        return;
      }

      setGuestSaving(true);
      setGuestsError(null);
      try {
        const payload = {
          fname: cleanFname,
          minit: cleanMinit,
          lname: cleanLname,
          phone: cleanPhone,
          email: cleanEmail,
        };
        const response = await fetch(
          editingGuestId ? `/api/guests/${editingGuestId}` : '/api/guests',
          {
            method: editingGuestId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );
        const data: unknown = await response.json();
        const apiError = apiErrorMessage(data, '');
        if (!response.ok || apiError) {
          throw new Error(apiError || `Guest save failed (${response.status} ${response.statusText}).`);
        }
        setGuestsRefresh((current) => current + 1);
        await refreshGuestCollection();
        addFlash(
          editingGuestId
            ? `Guest #${editingGuestId} (${cleanFname} ${cleanLname}) updated.`
            : `Guest ${cleanFname} ${cleanLname} added.`,
          'success'
        );
        navigate('guests');
      } catch (error) {
        setGuestsError(error instanceof Error ? error.message : 'Unable to save guest.');
      } finally {
        setGuestSaving(false);
      }
    };

    return (
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#6E655B] mb-1">
              Guest Table &bull; {editingGuestId ? 'UPDATE' : 'INSERT'}
            </div>
            <h1 className="text-3xl text-[#2B2620] font-serif-editorial">
              {editingGuestId ? `Edit Guest #${editingGuestId}` : 'Register New Guest'}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => navigate('guests')}
            className="px-4 py-2 text-xs font-medium bg-white border border-[#E2D9C8] rounded-[5px] cursor-pointer"
          >
            &larr; Back to Guests
          </button>
        </div>

        {guestsError && (
          <div role="alert" className="bg-[#FDF2EF] border border-[#D8B4A6] text-[#8B3E1F] rounded-[5px] px-4 py-3 mb-6 text-sm">
            {guestsError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white border border-[#E2D9C8] rounded-[6px] p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1.5">
                First Name (fname) *
              </label>
              <input
                type="text"
                value={fname}
                onChange={(e) => setGuestDraft((draft) => ({ ...draft, fname: e.target.value }))}
                required
                className="w-full px-3.5 py-2 text-sm bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px]"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1.5">
                M. Init
              </label>
              <input
                type="text"
                maxLength={1}
                value={minit}
                onChange={(e) => setGuestDraft((draft) => ({ ...draft, minit: e.target.value }))}
                className="w-full px-3.5 py-2 text-sm bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1.5">
                Last Name (lname) *
              </label>
              <input
                type="text"
                value={lname}
                onChange={(e) => setGuestDraft((draft) => ({ ...draft, lname: e.target.value }))}
                required
                className="w-full px-3.5 py-2 text-sm bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1.5">
                Telephone (UNIQUE) *
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setGuestDraft((draft) => ({ ...draft, phone: e.target.value }))}
                required
                placeholder="+44 7700 900123"
                className="w-full px-3.5 py-2 text-sm bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1.5">
                Electronic Mail (UNIQUE) *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setGuestDraft((draft) => ({ ...draft, email: e.target.value }))}
                required
                placeholder="guest@domain.co.uk"
                className="w-full px-3.5 py-2 text-sm bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px]"
              />
            </div>
          </div>

          <div className="pt-3 flex items-center gap-3">
            <button
              type="submit"
              disabled={guestSaving}
              className="px-6 py-2.5 bg-[#8B3E1F] hover:bg-[#6E2F15] text-white text-sm font-medium rounded-[5px] cursor-pointer"
            >
              {guestSaving ? 'Saving...' : editingGuestId ? 'Update Guest' : 'Insert Guest'}
            </button>
            <button
              type="button"
              onClick={() => navigate('guests')}
              className="px-5 py-2.5 bg-white border border-[#E2D9C8] text-[#2B2620] text-sm font-medium rounded-[5px] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  };

  // 4. ROOMS SCREEN (/rooms)
  const renderRooms = () => {
    const filteredRooms = roomResults;

    const handleDeleteRoom = (rm: Room) => {
      setConfirmDialog({
        title: `Delete Room ${rm.room_number}?`,
        message: `Remove Room ${rm.room_number} (${rm.room_type}) from the estate inventory?`,
        onConfirm: async () => {
          setConfirmDialog(null);
          setRoomsError(null);
          try {
            const response = await fetch(`/api/rooms/${rm.room_id}`, { method: 'DELETE' });
            const data: unknown = await response.json();
            const apiError = apiErrorMessage(data, '');
            if (!response.ok || apiError) {
              throw new Error(apiError || `Delete failed (${response.status} ${response.statusText}).`);
            }
            setRooms((current) => current.filter((room) => room.room_id !== rm.room_id));
            setRoomResults((current) => current.filter((room) => room.room_id !== rm.room_id));
            setRoomsRefresh((current) => current + 1);
            await refreshRoomCollection();
            addFlash(`Room ${rm.room_number} deleted.`, 'success');
          } catch (error) {
            setRoomsError(error instanceof Error ? error.message : 'Unable to delete room.');
          }
        },
      });
    };

    return (
      <div className="max-w-[1240px] mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#6E655B] mb-1">
              Sanctuary Quarters &bull; /rooms
            </div>
            <h1 className="text-3xl sm:text-4xl text-[#2B2620] font-serif-editorial">Rooms &amp; Suites Inventory</h1>
          </div>
          <button
            type="button"
            onClick={() => openRoomForm(null)}
            className="px-4 py-2.5 bg-[#8B3E1F] hover:bg-[#6E2F15] text-white text-xs font-medium rounded-[5px] cursor-pointer"
          >
            + Add Room
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white border border-[#E2D9C8] rounded-[6px] p-4 mb-8 flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1">
              Room Type
            </label>
            <select
              value={roomFilterType}
              onChange={(e) => setRoomFilterType(e.target.value)}
              className="px-3 py-2 text-xs bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px] text-[#2B2620]"
            >
              <option value="">All Types (Single, Double, Deluxe, Suite)</option>
              <option value="Single">Single</option>
              <option value="Double">Double</option>
              <option value="Deluxe">Deluxe</option>
              <option value="Suite">Suite</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1">
              Availability Status
            </label>
            <select
              value={roomFilterAvail}
              onChange={(e) => setRoomFilterAvail(e.target.value)}
              className="px-3 py-2 text-xs bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px] text-[#2B2620]"
            >
              <option value="">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Occupied">Occupied</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </div>

          {(roomFilterType || roomFilterAvail) && (
            <button
              type="button"
              onClick={() => {
                setRoomFilterType('');
                setRoomFilterAvail('');
              }}
              className="mt-4 px-3.5 py-2 text-xs font-medium bg-[#EFE8DC] text-[#2B2620] rounded-[4px] cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        {roomsError && (
          <div role="alert" className="bg-[#FDF2EF] border border-[#D8B4A6] text-[#8B3E1F] rounded-[5px] px-4 py-3 mb-6 text-sm">
            {roomsError}
          </div>
        )}

        {/* Rooms Grid */}
        {roomsLoading ? (
          <div role="status" className="bg-white border border-[#E2D9C8] rounded-[6px] p-10 text-center text-sm text-[#6E655B]">
            Loading rooms...
          </div>
        ) : filteredRooms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRooms.map((r) => {
              const features = getRoomFeatures(r.room_type);
              return (
                <article
                  key={r.room_id}
                  className="bg-white border border-[#E2D9C8] rounded-[6px] overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className="relative h-52 bg-[#EFE8DC]">
                      <img
                        src={getRoomImage(r.room_type)}
                        alt={`Room ${r.room_number}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-3 left-3 bg-[#FBF7F0]/95 text-[#2B2620] border border-[#E2D9C8] px-3 py-1 text-xs font-semibold rounded-[4px] tabular-nums">
                        {formatInr(r.price)} / night
                      </span>
                    </div>
                    <div className="p-5">
                      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6E655B] mb-1">
                        <span>
                          Room {r.room_number} &middot; {r.room_type}
                        </span>
                        <span
                          className={`px-2 py-1 rounded-[4px] border ${
                            r.availability === 'Available'
                              ? 'text-[#5C6446] bg-[#F4F6F0] border-[#C5CEB4]'
                              : r.availability === 'Occupied'
                              ? 'text-[#8B3E1F] bg-[#FDF2EF] border-[#D8B4A6]'
                              : 'text-[#6E655B] bg-[#EFE8DC] border-[#E2D9C8]'
                          }`}
                        >
                          {r.availability}
                        </span>
                      </div>
                      <h3 className="text-xl text-[#2B2620] font-serif-editorial mb-2.5">
                        {getRoomDisplayName(r.room_type)}
                      </h3>
                      <div className="text-xs text-[#6E655B] space-y-1 border-t border-[#E2D9C8] pt-2.5">
                        <div>&bull; {features[0]}</div>
                        <div>&bull; {features[1]}</div>
                      </div>
                    </div>
                  </div>
                  <div className="px-5 py-3.5 bg-[#FBF7F0] border-t border-[#E2D9C8] flex items-center justify-between gap-2">
                    {r.availability === 'Available' ? (
                      <button
                        type="button"
                        onClick={() => openReservationForm(null, r.room_id)}
                        className="px-3.5 py-1.5 bg-[#8B3E1F] hover:bg-[#6E2F15] text-white text-xs font-medium rounded-[4px] cursor-pointer"
                      >
                        Reserve Room
                      </button>
                    ) : (
                      <span className="text-xs text-[#6E655B]">Currently {r.availability}</span>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openRoomForm(r)}
                        className="px-3 py-1.5 bg-white border border-[#E2D9C8] hover:bg-[#EFE8DC] text-[#2B2620] text-xs font-medium rounded-[4px] cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRoom(r)}
                        className="px-3 py-1.5 bg-white border border-[#D8B4A6] hover:bg-[#8B3E1F] hover:text-white text-[#8B3E1F] text-xs font-medium rounded-[4px] transition-colors cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-[#E2D9C8] rounded-[6px] p-10 text-center text-sm text-[#6E655B]">
            No rooms match the selected filters.
          </div>
        )}
      </div>
    );
  };

  // 4B. ROOM FORM (Add / Edit)
  const renderRoomForm = () => {
    const { room_number: roomNumber, room_type: roomType, price, availability } = roomDraft;

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const cleanNum = roomNumber.trim();
      const numPrice = parseFloat(price);
      if (!cleanNum || isNaN(numPrice) || numPrice <= 0) {
        addFlash('Please provide a valid room number and positive tariff in ₹.', 'error');
        return;
      }

      setRoomSaving(true);
      setRoomsError(null);
      try {
        const payload = {
          room_number: cleanNum,
          room_type: roomType,
          price: numPrice,
          availability,
        };
        const response = await fetch(
          editingRoomId ? `/api/rooms/${editingRoomId}` : '/api/rooms',
          {
            method: editingRoomId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );
        const data: unknown = await response.json();
        const apiError = apiErrorMessage(data, '');
        if (!response.ok || apiError) {
          throw new Error(apiError || `Room save failed (${response.status} ${response.statusText}).`);
        }
        setRoomsRefresh((current) => current + 1);
        await refreshRoomCollection();
        addFlash(
          editingRoomId
            ? `Room ${cleanNum} updated (${formatInr(numPrice)} / night).`
            : `Room ${cleanNum} (${roomType}) added to inventory.`,
          'success'
        );
        navigate('rooms');
      } catch (error) {
        setRoomsError(error instanceof Error ? error.message : 'Unable to save room.');
      } finally {
        setRoomSaving(false);
      }
    };

    return (
      <div className="max-w-xl mx-auto px-6 py-10">
        {roomsError && (
          <div role="alert" className="bg-[#FDF2EF] border border-[#D8B4A6] text-[#8B3E1F] rounded-[5px] px-4 py-3 mb-6 text-sm">
            {roomsError}
          </div>
        )}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#6E655B] mb-1">
              Room Table &bull; {editingRoomId ? 'UPDATE' : 'INSERT'}
            </div>
            <h1 className="text-3xl text-[#2B2620] font-serif-editorial">
              {editingRoomId ? `Edit Room ${roomNumber}` : 'Add Sanctuary Room'}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => navigate('rooms')}
            className="px-4 py-2 text-xs font-medium bg-white border border-[#E2D9C8] rounded-[5px] cursor-pointer"
          >
            &larr; Back to Rooms
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-[#E2D9C8] rounded-[6px] p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1.5">
                Room Number (UNIQUE) *
              </label>
              <input
                type="text"
                value={roomNumber}
                onChange={(e) => setRoomDraft((draft) => ({ ...draft, room_number: e.target.value }))}
                required
                placeholder="e.g. 204"
                className="w-full px-3.5 py-2 text-sm bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1.5">
                Room Type *
              </label>
              <select
                value={roomType}
                onChange={(e) => setRoomDraft((draft) => ({ ...draft, room_type: e.target.value as RoomType }))}
                className="w-full px-3.5 py-2 text-sm bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px]"
              >
                <option value="Single">Single</option>
                <option value="Double">Double</option>
                <option value="Deluxe">Deluxe</option>
                <option value="Suite">Suite</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1.5">
                Nightly Price in INR (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={price}
                onChange={(e) => setRoomDraft((draft) => ({ ...draft, price: e.target.value }))}
                required
                className="w-full px-3.5 py-2 text-sm bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px] tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1.5">
                Availability *
              </label>
              <select
                value={availability}
                onChange={(e) => setRoomDraft((draft) => ({ ...draft, availability: e.target.value as RoomAvailability }))}
                className="w-full px-3.5 py-2 text-sm bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px]"
              >
                <option value="Available">Available</option>
                <option value="Occupied">Occupied</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>
          </div>

          <div className="pt-3 flex items-center gap-3">
            <button
              type="submit"
              disabled={roomSaving}
              className="px-6 py-2.5 bg-[#8B3E1F] hover:bg-[#6E2F15] text-white text-sm font-medium rounded-[5px] cursor-pointer"
            >
              {roomSaving ? 'Saving...' : editingRoomId ? 'Save Changes' : 'Insert Room'}
            </button>
            <button
              type="button"
              onClick={() => navigate('rooms')}
              className="px-5 py-2.5 bg-white border border-[#E2D9C8] text-[#2B2620] text-sm font-medium rounded-[5px] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  };

  // 5. RESERVATIONS SCREEN (/reservations)
  const renderReservations = () => {
    const sortedRes = reservations;

    const handleCancelReservation = async (res: ReservationRecord) => {
      setReservationsError(null);
      try {
        const response = await fetch(`/api/reservations/${res.reservation_id}/cancel`, { method: 'PATCH' });
        const data: unknown = await response.json();
        const apiError = apiErrorMessage(data, '');
        if (!response.ok || apiError) {
          throw new Error(apiError || `Cancel failed (${response.status} ${response.statusText}).`);
        }
        await refreshReservationCollection();
        addFlash(`Reservation #${res.reservation_id} cancelled.`, 'success');
      } catch (error) {
        setReservationsError(error instanceof Error ? error.message : 'Unable to cancel reservation.');
      }
    };

    const handleDeleteReservation = (res: ReservationRecord) => {
      setConfirmDialog({
        title: `Delete Reservation #${res.reservation_id}?`,
        message: `Permanently delete Reservation #${res.reservation_id} and its linked Reservation_Room and Payment records?`,
        onConfirm: async () => {
          setConfirmDialog(null);
          setReservationsError(null);
          try {
            const response = await fetch(`/api/reservations/${res.reservation_id}`, { method: 'DELETE' });
            const data: unknown = await response.json();
            const apiError = apiErrorMessage(data, '');
            if (!response.ok || apiError) {
              throw new Error(apiError || `Delete failed (${response.status} ${response.statusText}).`);
            }
            await refreshReservationCollection();
            await refreshPaymentCollection();
            addFlash(`Reservation #${res.reservation_id} deleted.`, 'success');
          } catch (error) {
            setReservationsError(error instanceof Error ? error.message : 'Unable to delete reservation.');
          }
        },
      });
    };

    return (
      <div className="max-w-[1240px] mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#6E655B] mb-1">
              Reservations Ledger &bull; /reservations
            </div>
            <h1 className="text-3xl sm:text-4xl text-[#2B2620] font-serif-editorial">Estate Reservations</h1>
          </div>
          <button
            type="button"
            onClick={() => openReservationForm(null)}
            className="px-4 py-2.5 bg-[#8B3E1F] hover:bg-[#6E2F15] text-white text-xs font-medium rounded-[5px] cursor-pointer"
          >
            + New Reservation
          </button>
        </div>

        {reservationsError && (
          <div role="alert" className="bg-[#FDF2EF] border border-[#D8B4A6] text-[#8B3E1F] rounded-[5px] px-4 py-3 mb-6 text-sm">
            {reservationsError}
          </div>
        )}
        <div className="bg-white border border-[#E2D9C8] rounded-[6px] p-6">
          {reservationsLoading ? (
            <div role="status" className="py-10 text-center text-sm text-[#6E655B]">Loading reservations...</div>
          ) : sortedRes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2D9C8] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6E655B]">
                    <th className="py-3 pr-3">ID</th>
                    <th className="py-3 px-3">Guest</th>
                    <th className="py-3 px-3">Room Numbers</th>
                    <th className="py-3 px-3">Check-In</th>
                    <th className="py-3 px-3">Check-Out</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Payment Status</th>
                    <th className="py-3 pl-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2D9C8] text-sm">
                  {sortedRes.map((r) => {
                    return (
                      <tr key={r.reservation_id} className="hover:bg-[#FBF7F0]/60">
                        <td className="py-3.5 pr-3 tabular-nums text-xs text-[#6E655B]">#{r.reservation_id}</td>
                        <td className="py-3.5 px-3">
                          <div className="font-medium text-[#2B2620]">
                            {r.guest}
                          </div>
                          {r.staff && (
                            <div className="text-xs text-[#6E655B]">
                              Steward: {r.staff}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-3 tabular-nums text-xs">Room {r.rooms || '—'}</td>
                        <td className="py-3.5 px-3 tabular-nums text-xs">{r.check_in_date}</td>
                        <td className="py-3.5 px-3 tabular-nums text-xs">{r.check_out_date}</td>
                        <td className="py-3.5 px-3 text-xs font-medium">
                          <span
                            className={
                              r.status === 'Cancelled'
                                ? 'text-[#8B3E1F] line-through'
                                : r.status === 'Checked-in'
                                ? 'text-[#5C6446]'
                                : 'text-[#2B2620]'
                            }
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-xs">
                          {r.payment_status === 'Paid' ? (
                            <span className="text-[#5C6446] font-medium tabular-nums">
                              Paid &middot; {formatInr(r.paid)}
                            </span>
                          ) : (
                            <span className="text-[#8B3E1F]">Pending</span>
                          )}
                        </td>
                        <td className="py-3.5 pl-3 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openReservationForm(r)}
                            className="px-2.5 py-1 text-xs font-medium bg-[#FBF7F0] border border-[#E2D9C8] hover:bg-[#EFE8DC] text-[#2B2620] rounded-[4px] cursor-pointer"
                          >
                            Edit
                          </button>
                          {r.status !== 'Cancelled' && (
                            <button
                              type="button"
                              onClick={() => handleCancelReservation(r)}
                              className="px-2.5 py-1 text-xs font-medium bg-white border border-[#E2D9C8] hover:bg-[#EFE8DC] text-[#6E655B] rounded-[4px] cursor-pointer"
                            >
                              Cancel
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteReservation(r)}
                            className="px-2.5 py-1 text-xs font-medium bg-white border border-[#D8B4A6] hover:bg-[#8B3E1F] hover:text-white text-[#8B3E1F] rounded-[4px] transition-colors cursor-pointer"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-[#6E655B]">No reservations found.</div>
          )}
        </div>
      </div>
    );
  };

  // 5B. RESERVATION FORM (New Atomic Transaction / Edit)
  const renderReservationForm = () => {
    const existing = reservations.find((r) => r.reservation_id === editingReservationId);
    const isEdit = Boolean(editingReservationId && existing);
    const {
      guestId,
      staffId,
      checkIn,
      checkOut,
      status,
      selectedRoomIds,
      includePayment,
      paymentMethod,
      customPaymentAmount,
    } = reservationDraft;
    const today = getDateOffset(0);

    // Calculate nights and live total in ₹
    const nights = (() => {
      const d1 = new Date(checkIn);
      const d2 = new Date(checkOut);
      const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      return diff > 0 ? diff : 0;
    })();

    const liveTotalInr = (() => {
      if (nights <= 0) return 0;
      const sumPerNight = selectedRoomIds.reduce((sum, rid) => {
        const rm = availableRooms.find((r) => r.room_id === rid);
        return sum + (rm ? Number(rm.price) : 0);
      }, 0);
      return sumPerNight * nights;
    })();

    const toggleRoomSelection = (rid: number) => {
      setReservationDraft((draft) => ({
        ...draft,
        selectedRoomIds: draft.selectedRoomIds.includes(rid)
          ? draft.selectedRoomIds.filter((id) => id !== rid)
          : [...draft.selectedRoomIds, rid],
      }));
    };

    const handleCreateSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (checkOut <= checkIn) {
        setReservationsError('Check-out date must be after check-in date.');
        return;
      }
      if (!guestId || selectedRoomIds.length === 0) {
        setReservationsError('Please select a guest and at least one available room.');
        return;
      }

      const currentFreeIds = new Set(availableRooms.map((r) => r.room_id));
      const conflict = selectedRoomIds.find((id) => !currentFreeIds.has(id));
      if (conflict) {
        setReservationsError('One or more selected rooms are no longer available for this period.');
        return;
      }

      const finalAmount = customPaymentAmount ? Number(customPaymentAmount) : liveTotalInr;
      if (includePayment && (!Number.isFinite(finalAmount) || finalAmount <= 0)) {
        setReservationsError('Enter a valid payment amount greater than zero.');
        return;
      }

      setReservationSaving(true);
      setReservationsError(null);
      try {
        const response = await fetch('/api/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guest_id: Number(guestId),
            staff_id: staffId === '' ? null : Number(staffId),
            check_in_date: checkIn,
            check_out_date: checkOut,
            room_ids: selectedRoomIds,
            ...(includePayment ? { payment: { method: paymentMethod, amount: finalAmount } } : {}),
          }),
        });
        const data: unknown = await response.json();
        const apiError = apiErrorMessage(data, '');
        if (!response.ok || apiError) {
          throw new Error(apiError || `Reservation creation failed (${response.status} ${response.statusText}).`);
        }
        await refreshReservationCollection();
        if (includePayment) await refreshPaymentCollection();
        addFlash(`Reservation created (${selectedRoomIds.length} room(s), total ${formatInr(liveTotalInr)}).`, 'success');
        navigate('reservations');
      } catch (error) {
        setReservationsError(error instanceof Error ? error.message : 'Unable to create reservation.');
      } finally {
        setReservationSaving(false);
      }
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (checkOut <= checkIn) {
        setReservationsError('Check-out date must be after check-in date.');
        return;
      }
      setReservationSaving(true);
      setReservationsError(null);
      try {
        const response = await fetch(`/api/reservations/${editingReservationId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            check_in_date: checkIn,
            check_out_date: checkOut,
            staff_id: staffId === '' ? null : Number(staffId),
            status,
          }),
        });
        const data: unknown = await response.json();
        const apiError = apiErrorMessage(data, '');
        if (!response.ok || apiError) {
          throw new Error(apiError || `Reservation update failed (${response.status} ${response.statusText}).`);
        }
        await refreshReservationCollection();
        addFlash(`Reservation #${editingReservationId} updated.`, 'success');
        navigate('reservations');
      } catch (error) {
        setReservationsError(error instanceof Error ? error.message : 'Unable to update reservation.');
      } finally {
        setReservationSaving(false);
      }
    };

    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#6E655B] mb-1">
              Reservation Transaction &bull; {isEdit ? 'UPDATE' : 'ATOMIC INSERT'}
            </div>
            <h1 className="text-3xl text-[#2B2620] font-serif-editorial">
              {isEdit ? `Edit Reservation #${editingReservationId}` : 'New Sanctuary Reservation'}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => navigate('reservations')}
            className="px-4 py-2 text-xs font-medium bg-white border border-[#E2D9C8] rounded-[5px] cursor-pointer"
          >
            &larr; Back to Reservations
          </button>
        </div>

        {(reservationsError || guestsError || staffError) && (
          <div role="alert" className="bg-[#FDF2EF] border border-[#D8B4A6] text-[#8B3E1F] rounded-[5px] px-4 py-3 mb-6 text-sm">
            {reservationsError || guestsError || staffError}
          </div>
        )}
        {!isEdit ? (
          <form onSubmit={handleCreateSubmit} className="bg-white border border-[#E2D9C8] rounded-[6px] p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1.5">
                  Guest *
                </label>
                <select
                  value={guestId}
                  required
                  onChange={(e) => setReservationDraft((draft) => ({
                    ...draft,
                    guestId: e.target.value ? Number(e.target.value) : '',
                  }))}
                  className="w-full px-3.5 py-2 text-sm bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px]"
                >
                  <option value="">Select a guest</option>
                  {guests.map((g) => (
                    <option key={g.guest_id} value={g.guest_id}>
                      {g.fname} {g.lname} ({g.phone})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1.5">
                  Assigned Staff / Steward
                </label>
                <select
                  value={staffId}
                  onChange={(e) => setReservationDraft((draft) => ({
                    ...draft,
                    staffId: e.target.value === '' ? '' : Number(e.target.value),
                  }))}
                  className="w-full px-3.5 py-2 text-sm bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px]"
                >
                  <option value="">Unassigned</option>
                  {staff.map((s) => (
                    <option key={s.staff_id} value={s.staff_id}>
                      {s.fname} {s.lname} — {s.role}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1.5">
                  Check-In Date *
                </label>
                <input
                  type="date"
                  value={checkIn}
                  min={today}
                  onChange={(e) => {
                    setReservationDraft((draft) => ({ ...draft, checkIn: e.target.value }));
                    setReservationsError(null);
                  }}
                  required
                  className="w-full px-3.5 py-2 text-sm bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1.5">
                  Check-Out Date *
                </label>
                <input
                  type="date"
                  value={checkOut}
                  onChange={(e) => {
                    setReservationDraft((draft) => ({ ...draft, checkOut: e.target.value }));
                    setReservationsError(null);
                  }}
                  required
                  className="w-full px-3.5 py-2 text-sm bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px]"
                />
              </div>
            </div>

            {/* Multi-select of ONLY rooms free for those dates */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-2">
                Select Available Rooms for {checkIn} &rarr; {checkOut} (Multi-Select) *
              </label>
              {availableRoomsLoading ? (
                <div role="status" className="p-4 bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px] text-xs text-[#6E655B]">
                  Loading available rooms...
                </div>
              ) : availableRoomsError ? (
                <div role="alert" className="p-4 bg-[#FDF2EF] border border-[#D8B4A6] rounded-[4px] text-xs text-[#8B3E1F]">
                  {availableRoomsError}
                </div>
              ) : checkOut <= checkIn ? (
                <div className="p-4 bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px] text-xs text-[#8B3E1F]">
                  Check-out date must be after check-in date.
                </div>
              ) : availableRooms.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availableRooms.map((rm) => {
                    const checked = selectedRoomIds.includes(rm.room_id);
                    return (
                      <label
                        key={rm.room_id}
                        className={`flex items-center justify-between p-3.5 border rounded-[5px] cursor-pointer transition-colors ${
                          checked
                            ? 'bg-[#EFE8DC] border-[#8B3E1F]'
                            : 'bg-[#FBF7F0] border-[#E2D9C8] hover:bg-[#EFE8DC]/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRoomSelection(rm.room_id)}
                            className="accent-[#8B3E1F]"
                          />
                          <div>
                            <div className="text-sm font-medium text-[#2B2620]">
                              Room {rm.room_number} &middot; {rm.room_type}
                            </div>
                            <div className="text-xs text-[#6E655B]">{getRoomDisplayName(rm.room_type)}</div>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-[#8B3E1F] tabular-nums">
                          {formatInr(rm.price)} / night
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px] text-xs text-[#8B3E1F]">
                  No rooms available for the selected date range (check_out must be after check_in).
                </div>
              )}
            </div>

            {/* Live Total Banner in ₹ */}
            <div className="bg-[#EFE8DC] border border-[#E2D9C8] rounded-[5px] p-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E655B]">
                  Live Total Calculation (Sum of Room Price &times; Nights)
                </div>
                <div className="text-xs text-[#2B2620] mt-0.5">
                  {selectedRoomIds.length} room(s) selected &times; {nights} night(s)
                </div>
              </div>
              <div className="text-2xl font-serif-editorial text-[#8B3E1F] tabular-nums">
                {formatInr(liveTotalInr)}
              </div>
            </div>

            {/* Optional Payment in same transaction */}
            <div className="border-t border-[#E2D9C8] pt-4">
              <label className="flex items-center gap-2.5 text-sm font-medium text-[#2B2620] cursor-pointer">
                <input
                  type="checkbox"
                  checked={includePayment}
                  onChange={(e) => {
                    setReservationDraft((draft) => ({
                      ...draft,
                      includePayment: e.target.checked,
                      customPaymentAmount:
                        e.target.checked && liveTotalInr > 0
                          ? String(liveTotalInr)
                          : draft.customPaymentAmount,
                    }));
                  }}
                  className="accent-[#8B3E1F]"
                />
                <span>Record Payment in the same transaction (INSERT into Payment)</span>
              </label>

              {includePayment && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-[#FBF7F0] border border-[#E2D9C8] rounded-[5px]">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1">
                      Payment Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setReservationDraft((draft) => ({
                        ...draft,
                        paymentMethod: e.target.value as PaymentMethod,
                      }))}
                      className="w-full px-3 py-2 text-xs bg-white border border-[#E2D9C8] rounded-[4px]"
                    >
                      <option value="Card">Card</option>
                      <option value="UPI">UPI</option>
                      <option value="NetBanking">NetBanking</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1">
                      Amount in INR (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={customPaymentAmount || liveTotalInr}
                      onChange={(e) => setReservationDraft((draft) => ({
                        ...draft,
                        customPaymentAmount: e.target.value,
                      }))}
                      className="w-full px-3 py-2 text-xs bg-white border border-[#E2D9C8] rounded-[4px] tabular-nums"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={reservationSaving || availableRoomsLoading || guests.length === 0}
                className="px-6 py-2.5 bg-[#8B3E1F] hover:bg-[#6E2F15] text-white text-sm font-medium rounded-[5px] cursor-pointer"
              >
                {reservationSaving ? 'Saving...' : 'Confirm Reservation'}
              </button>
              <button
                type="button"
                onClick={() => navigate('reservations')}
                className="px-5 py-2.5 bg-white border border-[#E2D9C8] text-[#2B2620] text-sm font-medium rounded-[5px] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleEditSubmit} className="bg-white border border-[#E2D9C8] rounded-[6px] p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1.5">
                  Check-In Date *
                </label>
                <input
                  type="date"
                  value={checkIn}
                  onChange={(e) => setReservationDraft((draft) => ({ ...draft, checkIn: e.target.value }))}
                  required
                  className="w-full px-3.5 py-2 text-sm bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1.5">
                  Check-Out Date *
                </label>
                <input
                  type="date"
                  value={checkOut}
                  onChange={(e) => setReservationDraft((draft) => ({ ...draft, checkOut: e.target.value }))}
                  required
                  className="w-full px-3.5 py-2 text-sm bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1.5">
                  Assigned Staff
                </label>
                <select
                  value={staffId}
                  onChange={(e) => setReservationDraft((draft) => ({
                    ...draft,
                    staffId: e.target.value === '' ? '' : Number(e.target.value),
                  }))}
                  className="w-full px-3.5 py-2 text-sm bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px]"
                >
                  <option value="">Unassigned</option>
                  {staff.map((s) => (
                    <option key={s.staff_id} value={s.staff_id}>
                      {s.fname} {s.lname} ({s.role})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1.5">
                  Status *
                </label>
                <select
                  value={status}
                  onChange={(e) => setReservationDraft((draft) => ({
                    ...draft,
                    status: e.target.value as ReservationStatus,
                  }))}
                  className="w-full px-3.5 py-2 text-sm bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px]"
                >
                  <option value="Booked">Booked</option>
                  <option value="Checked-in">Checked-in</option>
                  <option value="Checked-out">Checked-out</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={reservationSaving}
                className="px-6 py-2.5 bg-[#8B3E1F] hover:bg-[#6E2F15] text-white text-sm font-medium rounded-[5px] cursor-pointer"
              >
                {reservationSaving ? 'Saving...' : 'Update Reservation'}
              </button>
              <button
                type="button"
                onClick={() => navigate('reservations')}
                className="px-5 py-2.5 bg-white border border-[#E2D9C8] text-[#2B2620] text-sm font-medium rounded-[5px] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    );
  };

  // 6. PAYMENTS SCREEN (/payments)
  const renderPayments = () => {
    const unpaidReservations = reservations.filter((reservation) => reservation.payment_status === 'Pending');

    const handleAddPayment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!paymentDraft.reservationId) {
        setPaymentsError('Please select a pending reservation.');
        return;
      }
      const amount = Number(paymentDraft.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        setPaymentsError('Payment amount must be greater than zero.');
        return;
      }
      setPaymentSaving(true);
      setPaymentsError(null);
      try {
        const response = await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservation_id: Number(paymentDraft.reservationId),
            payment_method: paymentDraft.method,
            payment_amount: amount,
            payment_date: paymentDraft.date,
          }),
        });
        const data: unknown = await response.json();
        const apiError = apiErrorMessage(data, '');
        if (!response.ok || apiError) {
          throw new Error(apiError || `Payment creation failed (${response.status} ${response.statusText}).`);
        }
        await Promise.all([refreshPaymentCollection(), refreshReservationCollection()]);
        addFlash(`Payment (${formatInr(amount)}) recorded for Reservation #${paymentDraft.reservationId}.`, 'success');
        setPaymentDraft((draft) => ({ ...draft, reservationId: '', amount: '' }));
      } catch (error) {
        setPaymentsError(error instanceof Error ? error.message : 'Unable to record payment.');
      } finally {
        setPaymentSaving(false);
      }
    };

    const handleUpdatePayment = async (paymentId: number, method: PaymentMethod, amountString: string) => {
      const amount = Number(amountString);
      if (!Number.isFinite(amount) || amount <= 0) {
        setPaymentsError('Enter a valid payment amount greater than zero.');
        return false;
      }
      setPaymentsError(null);
      try {
        const response = await fetch(`/api/payments/${paymentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_method: method, payment_amount: amount }),
        });
        const data: unknown = await response.json();
        const apiError = apiErrorMessage(data, '');
        if (!response.ok || apiError) {
          throw new Error(apiError || `Payment update failed (${response.status} ${response.statusText}).`);
        }
        await refreshPaymentCollection();
        addFlash(`Payment #${paymentId} updated to ${formatInr(amount)} (${method}).`, 'success');
        return true;
      } catch (error) {
        setPaymentsError(error instanceof Error ? error.message : 'Unable to update payment.');
        return false;
      }
    };

    const handleDeletePayment = (payment: PaymentRecord) => {
      setConfirmDialog({
        title: `Delete Payment #${payment.payment_id}?`,
        message: `Remove Payment #${payment.payment_id} (${formatInr(payment.payment_amount)}) for Reservation #${payment.reservation_id}?`,
        onConfirm: async () => {
          setConfirmDialog(null);
          setPaymentsError(null);
          try {
            const response = await fetch(`/api/payments/${payment.payment_id}`, { method: 'DELETE' });
            const data: unknown = await response.json();
            const apiError = apiErrorMessage(data, '');
            if (!response.ok || apiError) {
              throw new Error(apiError || `Payment deletion failed (${response.status} ${response.statusText}).`);
            }
            await Promise.all([refreshPaymentCollection(), refreshReservationCollection()]);
            addFlash(`Payment #${payment.payment_id} deleted.`, 'success');
          } catch (error) {
            setPaymentsError(error instanceof Error ? error.message : 'Unable to delete payment.');
          }
        },
      });
    };

    return (
      <div className="max-w-[1240px] mx-auto px-6 py-10">
        <div className="mb-6">
          <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#6E655B] mb-1">
            Estate Accounts &bull; /payments
          </div>
          <h1 className="text-3xl sm:text-4xl text-[#2B2620] font-serif-editorial">Payments &amp; Settlements (₹)</h1>
        </div>

        {(paymentsError || reservationsError) && (
          <div role="alert" className="bg-[#FDF2EF] border border-[#D8B4A6] text-[#8B3E1F] rounded-[5px] px-4 py-3 mb-6 text-sm">
            {paymentsError || reservationsError}
          </div>
        )}

        {/* Add Payment Card */}
        <div className="bg-white border border-[#E2D9C8] rounded-[6px] p-6 mb-8">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E2D9C8]">
            <h2 className="text-lg font-serif-editorial text-[#2B2620]">
              Record Payment for Unpaid Reservation (UNIQUE reservation_id)
            </h2>
          </div>

          {reservationsLoading ? (
            <div role="status" className="text-xs text-[#6E655B]">Loading pending reservations...</div>
          ) : unpaidReservations.length > 0 ? (
            <form onSubmit={handleAddPayment} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
              <div className="lg:col-span-2">
                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1">
                  Unpaid Reservation *
                </label>
                <select
                  value={paymentDraft.reservationId}
                  onChange={(e) => setPaymentDraft((draft) => ({
                    ...draft,
                    reservationId: e.target.value ? Number(e.target.value) : '',
                  }))}
                  required
                  className="w-full px-3 py-2 text-xs bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px]"
                >
                  <option value="">Select reservation...</option>
                  {unpaidReservations.map((u) => (
                    <option key={u.reservation_id} value={u.reservation_id}>
                      #{u.reservation_id} — {u.guest}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1">
                  Method *
                </label>
                <select
                  value={paymentDraft.method}
                  onChange={(e) => setPaymentDraft((draft) => ({
                    ...draft,
                    method: e.target.value as PaymentMethod,
                  }))}
                  className="w-full px-3 py-2 text-xs bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px]"
                >
                  <option value="Card">Card</option>
                  <option value="UPI">UPI</option>
                  <option value="NetBanking">NetBanking</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1">
                  Amount in ₹ *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentDraft.amount}
                  onChange={(e) => setPaymentDraft((draft) => ({ ...draft, amount: e.target.value }))}
                  required
                  className="w-full px-3 py-2 text-xs bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px] tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1">
                  Payment Date *
                </label>
                <input
                  type="date"
                  value={paymentDraft.date}
                  onChange={(e) => setPaymentDraft((draft) => ({ ...draft, date: e.target.value }))}
                  required
                  className="w-full px-3 py-2 text-xs bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px]"
                />
              </div>
              <div>
                <button
                  type="submit"
                  disabled={paymentSaving}
                  className="w-full py-2 px-4 bg-[#8B3E1F] hover:bg-[#6E2F15] text-white text-xs font-medium rounded-[4px] cursor-pointer"
                >
                  {paymentSaving ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-xs text-[#5C6446]">
              No reservations are pending payment.
            </div>
          )}
        </div>

        {/* Payments Table */}
        <div className="bg-white border border-[#E2D9C8] rounded-[6px] p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2D9C8] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6E655B]">
                  <th className="py-3 pr-3">Payment ID</th>
                  <th className="py-3 px-3">Reservation</th>
                  <th className="py-3 px-3">Guest</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Method &amp; Amount (₹)</th>
                  <th className="py-3 pl-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2D9C8] text-sm">
                {paymentsLoading ? (
                  <tr><td colSpan={6} className="py-8 text-center text-sm text-[#6E655B]">Loading payments...</td></tr>
                ) : payments.length > 0 ? (
                  payments.map((payment) => (
                    <PaymentRowItem
                      key={payment.payment_id}
                      payment={payment}
                      onUpdate={handleUpdatePayment}
                      onDelete={() => handleDeletePayment(payment)}
                    />
                  ))
                ) : (
                  <tr><td colSpan={6} className="py-8 text-center text-sm text-[#6E655B]">No payments found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // 7. SEARCH SCREEN (/search)
  const renderSearch = () => {
    const availableForDates = getFreeRoomsForDates(searchCheckIn, searchCheckOut, searchRoomType);

    return (
      <div className="max-w-[1240px] mx-auto px-6 py-10 space-y-8">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#6E655B] mb-1">
            Estate Directory &amp; Availability Query &bull; /search
          </div>
          <h1 className="text-3xl sm:text-4xl text-[#2B2620] font-serif-editorial">Search &amp; Availability</h1>
        </div>

        {/* Section 1: Available Rooms for Dates (Exact SQL query from Section 6F) */}
        <div className="bg-white border border-[#E2D9C8] rounded-[6px] p-6">
          <div className="pb-4 mb-5 border-b border-[#E2D9C8] flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8B3E1F]">
                Section 1 &bull; Available Rooms for Dates Query
              </div>
              <h2 className="text-xl font-serif-editorial text-[#2B2620]">
                Rooms Free Between {searchCheckIn} and {searchCheckOut}
              </h2>
            </div>
            <span className="text-xs text-[#6E655B] tabular-nums">{availableForDates.length} room(s) free</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1">
                Requested Check-In
              </label>
              <input
                type="date"
                value={searchCheckIn}
                onChange={(e) => setSearchCheckIn(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1">
                Requested Check-Out
              </label>
              <input
                type="date"
                value={searchCheckOut}
                onChange={(e) => setSearchCheckOut(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-1">
                Room Type Filter
              </label>
              <select
                value={searchRoomType}
                onChange={(e) => setSearchRoomType(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px]"
              >
                <option value="">All Sanctuary Types</option>
                <option value="Single">Single</option>
                <option value="Double">Double</option>
                <option value="Deluxe">Deluxe</option>
                <option value="Suite">Suite</option>
              </select>
            </div>
          </div>

          {availableForDates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {availableForDates.map((rm) => (
                <div
                  key={rm.room_id}
                  className="border border-[#E2D9C8] rounded-[5px] overflow-hidden bg-[#FBF7F0] flex flex-col justify-between"
                >
                  <div>
                    <div className="relative h-44 bg-[#EFE8DC]">
                      <img
                        src={getRoomImage(rm.room_type)}
                        alt={`Room ${rm.room_number}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-2.5 left-2.5 bg-[#FBF7F0]/95 px-2.5 py-0.5 text-xs font-semibold border border-[#E2D9C8] rounded-[4px] tabular-nums">
                        {formatInr(rm.price)} / night
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E655B]">
                        Room {rm.room_number} &middot; {rm.room_type}
                      </div>
                      <div className="text-lg font-serif-editorial text-[#2B2620] mt-0.5">
                        {getRoomDisplayName(rm.room_type)}
                      </div>
                    </div>
                  </div>
                  <div className="px-4 pb-4">
                    <button
                      type="button"
                      onClick={() =>
                        openReservationForm(null, rm.room_id, {
                          checkIn: searchCheckIn,
                          checkOut: searchCheckOut,
                        })
                      }
                      className="w-full py-2 bg-[#8B3E1F] hover:bg-[#6E2F15] text-white text-xs font-medium rounded-[4px] cursor-pointer"
                    >
                      Book Room {rm.room_number} for Dates
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-[#8B3E1F]">
              No rooms available for the selected date window.
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E2D9C8] rounded-[6px] p-6">
          <h2 className="text-lg font-serif-editorial text-[#2B2620] mb-3">Search Guests, Rooms &amp; Reservations</h2>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by guest, phone, room, or reservation..."
            aria-label="Search guests, rooms, and reservations"
            className="w-full px-3 py-2 text-xs bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px]"
          />
          {searchError && (
            <div role="alert" className="mt-4 bg-[#FDF2EF] border border-[#D8B4A6] text-[#8B3E1F] rounded-[5px] px-4 py-3 text-sm">
              {searchError}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-[#E2D9C8] rounded-[6px] p-6">
            <h3 className="text-lg font-serif-editorial text-[#2B2620] mb-3">Guests</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E2D9C8] text-[#6E655B] uppercase">
                    <th className="py-2">Name</th>
                    <th className="py-2">Phone</th>
                    <th className="py-2">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2D9C8]">
                  {searchLoading ? (
                    <tr><td colSpan={3} className="py-5 text-center text-[#6E655B]">Searching guests...</td></tr>
                  ) : searchResults.guests.length > 0 ? (
                    searchResults.guests.map((guest) => (
                      <tr key={guest.guest_id}>
                        <td className="py-2 font-medium">{guest.fname} {guest.lname}</td>
                        <td className="py-2 tabular-nums">{guest.phone}</td>
                        <td className="py-2 text-[#6E655B]">{guest.email || '—'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={3} className="py-5 text-center text-[#6E655B]">No guests found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-[#E2D9C8] rounded-[6px] p-6">
            <h3 className="text-lg font-serif-editorial text-[#2B2620] mb-3">Rooms</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E2D9C8] text-[#6E655B] uppercase">
                    <th className="py-2">Room</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Tariff (₹)</th>
                    <th className="py-2">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2D9C8]">
                  {searchLoading ? (
                    <tr><td colSpan={4} className="py-5 text-center text-[#6E655B]">Searching rooms...</td></tr>
                  ) : searchResults.rooms.length > 0 ? (
                    searchResults.rooms.map((room) => (
                      <tr key={room.room_number}>
                        <td className="py-2 font-medium tabular-nums">#{room.room_number}</td>
                        <td className="py-2">{room.room_type}</td>
                        <td className="py-2 tabular-nums">{formatInr(room.price)}</td>
                        <td className="py-2">{room.availability}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={4} className="py-5 text-center text-[#6E655B]">No rooms found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E2D9C8] rounded-[6px] p-6">
          <h3 className="text-lg font-serif-editorial text-[#2B2620] mb-3">Reservations</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E2D9C8] text-[#6E655B] uppercase">
                  <th className="py-2">Res ID</th>
                  <th className="py-2">Guest</th>
                  <th className="py-2">Check-In &rarr; Check-Out</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2D9C8]">
                {searchLoading ? (
                  <tr><td colSpan={4} className="py-5 text-center text-[#6E655B]">Searching reservations...</td></tr>
                ) : searchResults.reservations.length > 0 ? (
                  searchResults.reservations.map((reservation) => (
                    <tr key={reservation.reservation_id}>
                      <td className="py-2 tabular-nums">#{reservation.reservation_id}</td>
                      <td className="py-2 font-medium">{reservation.guest}</td>
                      <td className="py-2 tabular-nums">
                        {reservation.check_in_date} &rarr; {reservation.check_out_date}
                      </td>
                      <td className="py-2">{reservation.status}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="py-5 text-center text-[#6E655B]">No reservations found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // 8. REPORTS SCREEN (/reports)
  const renderReports = () => {
    const totalCount = revenueReport.reduce((total, row) => total + row.transactions, 0);
    const grandTotal = revenueReport.reduce((total, row) => total + row.total_revenue, 0);
    const overallAvg = totalCount > 0 ? grandTotal / totalCount : 0;

    // Report 2: Guest Reservation History (JOIN Guest, Reservation, Reservation_Room, Room, LEFT JOIN Payment)
    const guestHistoryRows = [...guestHistoryReport].sort((a, b) =>
        reportSortOrder === 'desc'
          ? b.check_in_date.localeCompare(a.check_in_date)
          : a.check_in_date.localeCompare(b.check_in_date)
      );

    // Report 3: Staff Workload (LEFT JOIN Staff to Reservation, GROUP BY staff)
    const staffWorkloadRows = staffWorkloadReport;

    return (
      <div className="max-w-[1240px] mx-auto px-6 py-10 print-container space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#6E655B] mb-1">
              Estate Financial &amp; Operational Audit &bull; /reports
            </div>
            <h1 className="text-3xl sm:text-4xl text-[#2B2620] font-serif-editorial">
              Management Reports (INR ₹)
            </h1>
          </div>
        </div>

        {/* Report 1: Revenue by Payment Method */}
        <div className="print-report bg-white border border-[#E2D9C8] rounded-[6px] p-6">
          <div className="pb-4 mb-4 border-b border-[#E2D9C8] flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E655B]">
                Report 01 &bull; GROUP BY payment_method (COUNT, SUM, AVG)
              </div>
              <h2 className="text-xl font-serif-editorial text-[#2B2620]">Revenue by Payment Method</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-[#8B3E1F]">Currency: Indian Rupees (₹)</span>
              <button
                type="button"
                onClick={() => window.print()}
                className="no-print px-3 py-1.5 bg-[#8B3E1F] hover:bg-[#6E2F15] text-white text-xs font-medium rounded-[5px] inline-flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2D9C8] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6E655B]">
                  <th className="py-3 pr-4">Payment Method</th>
                  <th className="py-3 px-4 text-right">Count</th>
                  <th className="py-3 px-4 text-right">Total Revenue (SUM)</th>
                  <th className="py-3 pl-4 text-right">Average Receipt (AVG)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2D9C8] text-sm">
                {revenueReportLoading ? (
                  <tr><td colSpan={4} className="py-6 text-center text-[#6E655B]">Loading revenue report...</td></tr>
                ) : revenueReportError ? (
                  <tr><td colSpan={4} role="alert" className="py-6 text-center text-[#8B3E1F]">{revenueReportError}</td></tr>
                ) : revenueReport.length > 0 ? (
                  revenueReport.map((row) => (
                    <tr key={row.payment_method}>
                      <td className="py-3 pr-4 font-medium text-[#2B2620]">{row.payment_method}</td>
                      <td className="py-3 px-4 text-right tabular-nums">{row.transactions}</td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium">{formatInr(row.total_revenue)}</td>
                      <td className="py-3 pl-4 text-right tabular-nums text-[#6E655B]">{formatInr(row.avg_payment)}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="py-6 text-center text-[#6E655B]">No revenue data found.</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#2B2620] bg-[#FBF7F0] font-semibold text-sm">
                  <td className="py-3.5 pr-4">TOTAL / OVERALL</td>
                  <td className="py-3.5 px-4 text-right tabular-nums">{totalCount}</td>
                  <td className="py-3.5 px-4 text-right tabular-nums text-[#8B3E1F]">{formatInr(grandTotal)}</td>
                  <td className="py-3.5 pl-4 text-right tabular-nums">{formatInr(overallAvg)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Report 2: Reservation History per Guest */}
        <div className="print-report bg-white border border-[#E2D9C8] rounded-[6px] p-6">
          <div className="pb-4 mb-4 border-b border-[#E2D9C8] flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E655B]">
                Report 02 &bull; JOIN Guest, Reservation, Reservation_Room, Room, LEFT JOIN Payment
              </div>
              <h2 className="text-xl font-serif-editorial text-[#2B2620]">Reservation History per Guest</h2>
            </div>
            <div className="no-print flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReportSortOrder('desc')}
                className={`px-3 py-1 text-xs rounded-[4px] border cursor-pointer ${
                  reportSortOrder === 'desc'
                    ? 'bg-[#8B3E1F] text-white border-[#8B3E1F]'
                    : 'bg-[#FBF7F0] text-[#2B2620] border-[#E2D9C8]'
                }`}
              >
                Sort Date DESC
              </button>
              <button
                type="button"
                onClick={() => setReportSortOrder('asc')}
                className={`px-3 py-1 text-xs rounded-[4px] border cursor-pointer ${
                  reportSortOrder === 'asc'
                    ? 'bg-[#8B3E1F] text-white border-[#8B3E1F]'
                    : 'bg-[#FBF7F0] text-[#2B2620] border-[#E2D9C8]'
                }`}
              >
                Sort Date ASC
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-[#8B3E1F] hover:bg-[#6E2F15] text-white text-xs font-medium rounded-[5px] inline-flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2D9C8] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6E655B]">
                  <th className="py-3 pr-3">Guest</th>
                  <th className="py-3 px-3">Res ID</th>
                  <th className="py-3 px-3">Dates</th>
                  <th className="py-3 px-3">Rooms &amp; Types</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 pl-3 text-right">Settlement (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2D9C8] text-sm">
                {guestHistoryReportLoading ? (
                  <tr><td colSpan={6} className="py-6 text-center text-[#6E655B]">Loading guest history report...</td></tr>
                ) : guestHistoryReportError ? (
                  <tr><td colSpan={6} role="alert" className="py-6 text-center text-[#8B3E1F]">{guestHistoryReportError}</td></tr>
                ) : guestHistoryRows.length > 0 ? (
                  guestHistoryRows.map((row) => (
                    <tr key={row.reservation_id}>
                      <td className="py-3 pr-3">
                        <div className="font-medium text-[#2B2620]">{row.guest}</div>
                        <div className="text-xs text-[#6E655B]">Guest #{row.guest_id}</div>
                      </td>
                      <td className="py-3 px-3 tabular-nums text-xs">#{row.reservation_id}</td>
                      <td className="py-3 px-3 tabular-nums text-xs">
                        {row.check_in_date} &rarr; {row.check_out_date}
                      </td>
                      <td className="py-3 px-3 text-xs">{row.rooms || '—'}</td>
                      <td className="py-3 px-3 text-xs">{row.status}</td>
                      <td className="py-3 pl-3 text-right tabular-nums text-xs font-semibold">
                        {formatInr(row.paid)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={6} className="py-6 text-center text-[#6E655B]">No guest reservation history found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Report 3: Staff Workload */}
        <div className="print-report bg-white border border-[#E2D9C8] rounded-[6px] p-6">
          <div className="pb-4 mb-4 border-b border-[#E2D9C8] flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E655B]">
                Report 03 &bull; LEFT JOIN Staff TO Reservation GROUP BY staff_id
              </div>
              <h2 className="text-xl font-serif-editorial text-[#2B2620]">Estate Staff &amp; Concierge Workload</h2>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="no-print px-3 py-1.5 bg-[#8B3E1F] hover:bg-[#6E2F15] text-white text-xs font-medium rounded-[5px] inline-flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2D9C8] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6E655B]">
                  <th className="py-3 pr-3">Staff ID</th>
                  <th className="py-3 px-3">Staff</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 pl-3 text-right">Reservations Handled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2D9C8] text-sm">
                {staffWorkloadReportLoading ? (
                  <tr><td colSpan={4} className="py-6 text-center text-[#6E655B]">Loading staff workload report...</td></tr>
                ) : staffWorkloadReportError ? (
                  <tr><td colSpan={4} role="alert" className="py-6 text-center text-[#8B3E1F]">{staffWorkloadReportError}</td></tr>
                ) : staffWorkloadRows.length > 0 ? (
                  staffWorkloadRows.map((row) => (
                    <tr key={row.staff_id}>
                      <td className="py-3 pr-3 tabular-nums text-xs text-[#6E655B]">#{row.staff_id}</td>
                      <td className="py-3 px-3 font-medium text-[#2B2620]">{row.staff}</td>
                      <td className="py-3 px-3 text-[#6E655B]">{row.role}</td>
                      <td className="py-3 pl-3 text-right tabular-nums font-semibold">{row.reservations_handled}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="py-6 text-center text-[#6E655B]">No staff workload data found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const navItems: { id: PageRoute; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'rooms', label: 'Rooms' },
    { id: 'guests', label: 'Guests' },
    { id: 'reservations', label: 'Reservations' },
    { id: 'payments', label: 'Payments' },
    { id: 'search', label: 'Search' },
    { id: 'reports', label: 'Reports' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF7F0] text-[#2B2620]">
      {/* Top Navigation Bar matching specification */}
      <header className="no-print sticky top-0 z-40 bg-[#FBF7F0]/95 backdrop-blur-xs border-b border-[#E2D9C8]">
        <div className="max-w-[1400px] mx-auto px-5 py-3.5 flex items-center justify-between gap-4">
          {/* Brand Wordmark + BOUTIQUE • SOMERSET tag */}
          <div className="flex items-baseline gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigate('home')}
              className="text-2xl font-serif-editorial tracking-tight text-[#2B2620] cursor-pointer"
            >
              Hartwell
            </button>
            <span className="hidden sm:inline-block text-[10px] font-semibold tracking-[0.18em] uppercase text-[#6E655B]">
              BOUTIQUE &bull; SOMERSET
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden xl:flex items-center gap-5">
            {navItems.map((item) => {
              const isActive =
                route === item.id ||
                (item.id === 'rooms' && route === 'room_form') ||
                (item.id === 'guests' && route === 'guest_form') ||
                (item.id === 'reservations' && route === 'reservation_form');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.id)}
                  className={`py-1 text-xs font-medium transition-colors border-b-2 cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'text-[#2B2620] border-[#8B3E1F]'
                      : 'text-[#6E655B] border-transparent hover:text-[#2B2620]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right Controls: Estate House selector, Book a Stay button, Flask Code button, Staff Avatar */}
          <div className="hidden lg:flex items-center gap-3 shrink-0">
            <select
              aria-label="Estate House Selector"
              value={selectedEstate}
              onChange={(e) => {
                setSelectedEstate(e.target.value);
                addFlash(`Estate context switched to ${e.target.value}.`, 'success');
              }}
              className="px-2.5 py-1.5 text-xs bg-white border border-[#E2D9C8] rounded-[4px] text-[#2B2620] focus:outline-none focus:border-[#8B3E1F]"
            >
              <option value="Somerset House">Estate House</option>
              <option value="Cotswolds Manor">Cotswolds Manor</option>
              <option value="Cornwall Cliff">Cornwall Cliff</option>
              <option value="Lake District">Lake District</option>
              <option value="Scottish Highlands">Scottish Highlands</option>
            </select>

            <button
              type="button"
              onClick={() => openReservationForm(null)}
              className="px-3.5 py-1.5 bg-[#8B3E1F] hover:bg-[#6E2F15] text-white text-xs font-medium rounded-[4px] transition-colors cursor-pointer whitespace-nowrap"
            >
              Book a Stay
            </button>

            <button
              type="button"
              onClick={() => navigate('flask_code')}
              className={`px-3 py-1.5 text-xs font-medium rounded-[4px] border inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                route === 'flask_code'
                  ? 'bg-[#2B2620] text-white border-[#2B2620]'
                  : 'bg-[#EFE8DC] text-[#2B2620] border-[#E2D9C8] hover:bg-[#E2D9C8]'
              }`}
              title="Inspect and copy all 18 Python Flask + PostgreSQL files"
            >
              <Code2 className="w-3.5 h-3.5 text-[#8B3E1F]" />
              <span>Flask + SQL Code</span>
            </button>

            <div className="flex items-center gap-2 pl-2.5 border-l border-[#E2D9C8]">
              <div className="w-7 h-7 rounded-full bg-[#EFE8DC] border border-[#E2D9C8] flex items-center justify-center text-[11px] font-semibold text-[#8B3E1F]">
                EV
              </div>
              <div className="leading-tight">
                <div className="text-[11px] font-semibold text-[#2B2620]">Eleanor Vance</div>
                <div className="text-[10px] text-[#6E655B]">Concierge Desk</div>
              </div>
            </div>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden p-2 text-[#2B2620] border border-[#E2D9C8] rounded-[4px] bg-white cursor-pointer"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* Mobile Collapsible Menu */}
        {mobileMenuOpen && (
          <div className="xl:hidden bg-[#FBF7F0] border-b border-[#E2D9C8] px-6 py-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-[4px] cursor-pointer ${
                    route === item.id
                      ? 'bg-[#8B3E1F] text-white'
                      : 'bg-white border border-[#E2D9C8] text-[#2B2620]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => navigate('flask_code')}
                className="px-3 py-1.5 text-xs font-medium rounded-[4px] bg-[#EFE8DC] border border-[#E2D9C8] text-[#8B3E1F] cursor-pointer"
              >
                Flask + PostgreSQL Code (18 Files)
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Flash Messages Banner */}
      {flashes.length > 0 && (
        <div className="no-print max-w-[1240px] w-full mx-auto px-6 pt-4 space-y-2">
          {flashes.map((f) => (
            <div
              key={f.id}
              className={`flex items-center justify-between px-4 py-3 rounded-[5px] border text-xs font-medium ${
                f.category === 'error'
                  ? 'bg-[#FDF2EF] border-[#D8B4A6] text-[#8B3E1F]'
                  : 'bg-[#F4F6F0] border-[#C5CEB4] text-[#3B4329]'
              }`}
            >
              <div className="flex items-center gap-2">
                {f.category === 'error' ? (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                )}
                <span>{f.message}</span>
              </div>
              <button
                type="button"
                onClick={() => removeFlash(f.id)}
                className="ml-4 text-sm font-bold opacity-70 hover:opacity-100 cursor-pointer"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1">
        {route === 'home' && renderHome()}
        {route === 'dashboard' && renderDashboard()}
        {route === 'guests' && renderGuests()}
        {route === 'guest_form' && renderGuestForm()}
        {route === 'rooms' && renderRooms()}
        {route === 'room_form' && renderRoomForm()}
        {route === 'reservations' && renderReservations()}
        {route === 'reservation_form' && renderReservationForm()}
        {route === 'payments' && renderPayments()}
        {route === 'search' && renderSearch()}
        {route === 'reports' && renderReports()}
        {route === 'flask_code' && <FlaskCodeModal onClose={() => navigate('home')} />}
      </main>

      {/* Confirmation Modal Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[#FBF7F0] border border-[#E2D9C8] rounded-[6px] max-w-md w-full p-6">
            <h3 className="text-xl font-serif-editorial text-[#2B2620] mb-2">{confirmDialog.title}</h3>
            <p className="text-xs text-[#6E655B] leading-relaxed mb-6">{confirmDialog.message}</p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 text-xs font-medium bg-white border border-[#E2D9C8] text-[#2B2620] rounded-[4px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 text-xs font-medium bg-[#8B3E1F] hover:bg-[#6E2F15] text-white rounded-[4px] cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer matching specification */}
      <footer className="no-print bg-[#FBF7F0] border-t border-[#E2D9C8] pt-12 pb-8 mt-16">
        <div className="max-w-[1240px] mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-[#E2D9C8]">
          <div>
            <div className="text-2xl font-serif-editorial text-[#2B2620] mb-2">Hartwell</div>
            <p className="text-xs text-[#6E655B] leading-relaxed">
              A quiet sanctuary of Georgian limestone, ancient orchards, and unhurried seasonal hospitality in the
              English countryside.
            </p>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-2">
              Estate Location
            </div>
            <p className="text-xs text-[#6E655B] leading-relaxed">
              Hartwell Manor House
              <br />
              Honeybourne Lane, Chipping Campden Ridge
              <br />
              Gloucestershire, GL55 6JH, United Kingdom
            </p>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-2">
              Concierge Direct
            </div>
            <p className="text-xs text-[#2B2620] font-medium tabular-nums">+44 (0) 1386 840 201</p>
            <p className="text-xs text-[#6E655B] mt-1">concierge@hartwell-estate.co.uk</p>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E655B] mb-2">
              Estate Navigation
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs text-[#6E655B]">
              <button type="button" onClick={() => navigate('dashboard')} className="text-left hover:text-[#8B3E1F] cursor-pointer">
                Dashboard
              </button>
              <button type="button" onClick={() => navigate('rooms')} className="text-left hover:text-[#8B3E1F] cursor-pointer">
                Rooms (₹)
              </button>
              <button type="button" onClick={() => navigate('guests')} className="text-left hover:text-[#8B3E1F] cursor-pointer">
                Guests
              </button>
              <button type="button" onClick={() => navigate('reservations')} className="text-left hover:text-[#8B3E1F] cursor-pointer">
                Reservations
              </button>
              <button type="button" onClick={() => navigate('payments')} className="text-left hover:text-[#8B3E1F] cursor-pointer">
                Payments
              </button>
              <button type="button" onClick={() => navigate('flask_code')} className="text-left text-[#8B3E1F] font-medium cursor-pointer">
                Flask Source Code
              </button>
            </div>
          </div>
        </div>
        <div className="max-w-[1240px] mx-auto px-6 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-[#6E655B] gap-4">
          <span>&copy; 2026 Hartwell Country Estates. All tariffs and accounts maintained in Indian Rupees (₹).</span>
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => navigate('search')} className="hover:text-[#2B2620] cursor-pointer">
              Availability Search
            </button>
            <span>&middot;</span>
            <button type="button" onClick={() => navigate('reports')} className="hover:text-[#2B2620] cursor-pointer">
              Audit Reports
            </button>
            <span>&middot;</span>
            <button type="button" onClick={() => navigate('flask_code')} className="hover:text-[#2B2620] cursor-pointer">
              Python Flask + PostgreSQL Files
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Inline editable row component for Payments table
const PaymentRowItem: React.FC<{
  payment: PaymentRecord;
  onUpdate: (paymentId: number, method: PaymentMethod, amount: string) => Promise<boolean>;
  onDelete: () => void;
}> = ({ payment, onUpdate, onDelete }) => {
  const [method, setMethod] = useState<PaymentMethod>(payment.payment_method);
  const [amount, setAmount] = useState<string>(String(payment.payment_amount));
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  return (
    <tr className="hover:bg-[#FBF7F0]/60">
      <td className="py-3.5 pr-3 tabular-nums text-xs text-[#6E655B]">#{payment.payment_id}</td>
      <td className="py-3.5 px-3 tabular-nums text-xs">Reservation #{payment.reservation_id}</td>
      <td className="py-3.5 px-3 font-medium text-[#2B2620]">{payment.guest}</td>
      <td className="py-3.5 px-3 tabular-nums text-xs text-[#6E655B]">{payment.payment_date}</td>
      <td className="py-3.5 px-3">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="px-2 py-1 text-xs bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px]"
            >
              <option value="Card">Card</option>
              <option value="UPI">UPI</option>
              <option value="NetBanking">NetBanking</option>
              <option value="Cash">Cash</option>
            </select>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-28 px-2 py-1 text-xs bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px] tabular-nums"
            />
          </div>
        ) : (
          <span className="tabular-nums font-medium text-[#2B2620]">
            {formatInr(payment.payment_amount)}{' '}
            <span className="text-xs font-normal text-[#6E655B]">({payment.payment_method})</span>
          </span>
        )}
      </td>
      <td className="py-3.5 pl-3 text-right space-x-2 whitespace-nowrap">
        {isEditing ? (
          <>
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                if (await onUpdate(payment.payment_id, method, amount)) {
                  setIsEditing(false);
                }
                setSaving(false);
              }}
              className="px-2.5 py-1 text-xs font-medium bg-[#8B3E1F] text-white rounded-[4px] cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMethod(payment.payment_method);
                setAmount(String(payment.payment_amount));
                setIsEditing(false);
              }}
              className="px-2.5 py-1 text-xs font-medium bg-white border border-[#E2D9C8] rounded-[4px] cursor-pointer"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="px-2.5 py-1 text-xs font-medium bg-[#FBF7F0] border border-[#E2D9C8] hover:bg-[#EFE8DC] text-[#2B2620] rounded-[4px] cursor-pointer"
          >
            Edit
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="px-2.5 py-1 text-xs font-medium bg-white border border-[#D8B4A6] hover:bg-[#8B3E1F] hover:text-white text-[#8B3E1F] rounded-[4px] transition-colors cursor-pointer"
        >
          Delete
        </button>
      </td>
    </tr>
  );
};
