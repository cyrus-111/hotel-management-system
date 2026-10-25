export type RoomType = 'Single' | 'Double' | 'Deluxe' | 'Suite';
export type RoomAvailability = 'Available' | 'Occupied' | 'Maintenance';
export type ReservationStatus = 'Booked' | 'Checked-in' | 'Checked-out' | 'Cancelled';
export type PaymentMethod = 'Cash' | 'Card' | 'UPI' | 'NetBanking';

export interface Guest {
  guest_id: number;
  fname: string;
  minit: string | null;
  lname: string;
  phone: string;
  email: string;
}

export interface Staff {
  staff_id: number;
  fname: string;
  minit: string | null;
  lname: string;
  phone: string;
  role: string;
}

export interface Room {
  room_id: number;
  room_number: string;
  room_type: RoomType;
  price: number;
  availability: RoomAvailability;
}

export interface Reservation {
  reservation_id: number;
  booking_date: string;
  check_in_date: string;
  check_out_date: string;
  guest_id: number;
  staff_id: number | null;
  status: ReservationStatus;
}

export interface ReservationRoom {
  reservation_id: number;
  room_id: number;
}

export interface Payment {
  payment_id: number;
  payment_date: string;
  payment_method: PaymentMethod;
  payment_amount: number;
  reservation_id: number;
}

export interface FlashMessage {
  id: number;
  category: 'success' | 'error';
  message: string;
}

// Equivalent to the Python Jinja `inr` filter using the Indian digit grouping system
export function formatInr(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '₹0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '₹0';

  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const hasDecimals = Math.round(absNum * 100) % 100 !== 0;

  const parts = hasDecimals ? absNum.toFixed(2).split('.') : [Math.round(absNum).toString()];
  const intPart = parts[0];
  const decPart = parts[1] ? `.${parts[1]}` : '';

  let formattedInt = '';
  if (intPart.length <= 3) {
    formattedInt = intPart;
  } else {
    const lastThree = intPart.slice(-3);
    const remaining = intPart.slice(0, -3);
    const groups: string[] = [];
    for (let i = remaining.length; i > 0; i -= 2) {
      groups.unshift(remaining.slice(Math.max(0, i - 2), i));
    }
    formattedInt = `${groups.join(',')},${lastThree}`;
  }

  return `${isNegative ? '-' : ''}₹${formattedInt}${decPart}`;
}

export function getRoomImage(roomType: RoomType): string {
  switch (roomType) {
    case 'Suite':
      return '/src/assets/images/room_suite_interior_1792933833713.jpg';
    case 'Deluxe':
      return '/src/assets/images/room_deluxe_interior_1792933834699.jpg';
    case 'Double':
      return '/src/assets/images/room_double_interior_1792933835315.jpg';
    case 'Single':
    default:
      return '/src/assets/images/room_double_interior_1792933835315.jpg';
  }
}

export function getRoomFeatures(roomType: RoomType): [string, string] {
  switch (roomType) {
    case 'Suite':
      return ['Four-poster English oak bed · Limestone hearth', 'Private garden terrace & soaking tub · 68 sq m'];
    case 'Deluxe':
      return ['King wool-upholstered bed · Mullioned valley views', 'Freestanding copper bath & writing bureau · 46 sq m'];
    case 'Double':
      return ['Queen natural linen bed · Courtyard aspect', 'Walk-in rain shower & botanical tea service · 32 sq m'];
    case 'Single':
    default:
      return ['Bespoke single stead · Orchard outlook', 'Antique oak writing desk & rain shower · 24 sq m'];
  }
}

export function getRoomDisplayName(roomType: RoomType): string {
  switch (roomType) {
    case 'Suite':
      return 'The Somerset Manor Suite';
    case 'Deluxe':
      return 'Cotswold Meadow Deluxe';
    case 'Double':
      return 'Orchard Courtyard Double';
    case 'Single':
      return 'Gable Study Single';
  }
}
