const TRIPS_KEY = 'rumbo-trips-v1';
const LEGACY_KEY = 'rumbo-trip-v1';
const SELECTED_KEY = 'rumbo-selected-trip-v1';
const SYNC_KEY = 'rumbo-sync-key-v1';
const LOCAL_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid';
const DEFAULT_USEFUL_START = '08:00';
const DEFAULT_USEFUL_END = '22:00';
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TRIP_ATTACHMENT_BYTES = 1536 * 1024;

const initialTrip = {
  id: 'lisboa-demo',
  name: 'Escapada a Lisboa',
  location: 'Portugal',
  start: '2027-06-12',
  end: '2027-06-16',
  travelers: 2,
  timezone: 'Europe/Lisbon',
  dayStart: DEFAULT_USEFUL_START,
  dayEnd: DEFAULT_USEFUL_END,
  arrivalBuffer: 120,
  hotel: { name: 'Casa do Mercado', checkin: '15:00', checkout: '11:00', transfer: 35 },
  hotels: [{
    id: 'hotel-lisboa',
    name: 'Casa do Mercado',
    location: 'Lisboa, Portugal',
    checkinDate: '2027-06-12',
    checkin: '15:00',
    checkoutDate: '2027-06-16',
    checkout: '11:00',
    checkinDuration: 30,
    checkoutDuration: 30,
    airportToHotelTransfer: 35,
    hotelToAirportTransfer: 35,
    notes: '',
    attachments: []
  }],
  transfers: [],
  flights: [
    { id: 'f1', direction: 'arrival', date: '2027-06-12', departureDate: '2027-06-12', arrivalDate: '2027-06-12', from: 'Madrid (MAD)', to: 'Lisboa (LIS)', depart: '10:00', arrive: '10:45', fromTimezone: 'Europe/Madrid', toTimezone: 'Europe/Lisbon', flightNumber: 'IB 531', airportBuffer: 120, toAirportTransfer: 35, fromAirportTransfer: null, notes: '', attachments: [] },
    { id: 'f2', direction: 'departure', date: '2027-06-16', departureDate: '2027-06-16', arrivalDate: '2027-06-16', from: 'Lisboa (LIS)', to: 'Madrid (MAD)', depart: '19:30', arrive: '21:40', fromTimezone: 'Europe/Lisbon', toTimezone: 'Europe/Madrid', flightNumber: 'IB 532', airportBuffer: 120, toAirportTransfer: null, fromAirportTransfer: 35, notes: '', attachments: [] }
  ],
  events: []
};

const timezoneByAirport = {
  MAD: 'Europe/Madrid', BCN: 'Europe/Madrid', AGP: 'Europe/Madrid', PMI: 'Europe/Madrid',
  LIS: 'Europe/Lisbon', OPO: 'Europe/Lisbon', LHR: 'Europe/London', LGW: 'Europe/London',
  CDG: 'Europe/Paris', ORY: 'Europe/Paris', FCO: 'Europe/Rome', MXP: 'Europe/Rome',
  JFK: 'America/New_York', EWR: 'America/New_York', LAX: 'America/Los_Angeles',
  SFO: 'America/Los_Angeles', ORD: 'America/Chicago', MIA: 'America/New_York',
  DXB: 'Asia/Dubai', BKK: 'Asia/Bangkok', HND: 'Asia/Tokyo', NRT: 'Asia/Tokyo',
  SIN: 'Asia/Singapore', DEL: 'Asia/Kolkata', SYD: 'Australia/Sydney'
};

const transferLabels = { bus: 'Bus', car: 'Coche', train: 'Tren', taxi: 'Taxi', ferry: 'Ferry', metro: 'Metro', other: 'Otro' };

function normalizeTransfer(transfer, index, trip) {
  const type = Object.prototype.hasOwnProperty.call(transferLabels, transfer.type) ? transfer.type : 'other';
  return {
    ...transfer,
    id: transfer.id || 'transfer-' + (index + 1) + '-' + makeId().slice(0, 7),
    type,
    title: transfer.title || transfer.name || '',
    origin: transfer.origin || transfer.from || '',
    destination: transfer.destination || transfer.to || '',
    date: transfer.date || trip.start,
    endDate: transfer.endDate || transfer.arrivalDate || transfer.date || trip.start,
    start: transfer.start || transfer.depart || '12:00',
    end: transfer.end || transfer.arrive || '13:00',
    operator: transfer.operator || '',
    reference: transfer.reference || '',
    notes: transfer.notes || '',
    attachments: Array.isArray(transfer.attachments) ? transfer.attachments : []
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : 'rumbo-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

function normalizeDirection(direction) {
  if (direction === 'outbound' || direction === 'arrival') return 'arrival';
  if (direction === 'return' || direction === 'departure') return 'departure';
  return 'connection';
}

function normalizeHotel(hotel, trip, index) {
  return {
    ...hotel,
    id: hotel.id || 'hotel-' + (index + 1) + '-' + makeId().slice(0, 7),
    name: hotel.name || '',
    location: hotel.location || trip.location || '',
    checkinDate: hotel.checkinDate || hotel.start || trip.start,
    checkin: hotel.checkin || '15:00',
    checkoutDate: hotel.checkoutDate || hotel.end || trip.end,
    checkout: hotel.checkout || '11:00',
    checkinDuration: Number(hotel.checkinDuration ?? 30),
    checkoutDuration: Number(hotel.checkoutDuration ?? 30),
    airportToHotelTransfer: Number(hotel.airportToHotelTransfer ?? hotel.transfer ?? 35),
    hotelToAirportTransfer: Number(hotel.hotelToAirportTransfer ?? hotel.transfer ?? 35),
    notes: hotel.notes || '',
    attachments: Array.isArray(hotel.attachments) ? hotel.attachments : []
  };
}

function normalizeFlight(flight, index, trip) {
  const legacyTransfer = Number(flight.transfer ?? 35);
  const departureDate = flight.departureDate || flight.date || trip.start;
  return {
    ...flight,
    id: flight.id || 'flight-' + (index + 1) + '-' + makeId().slice(0, 7),
    direction: normalizeDirection(flight.direction),
    date: departureDate,
    departureDate,
    arrivalDate: flight.arrivalDate || flight.date || departureDate,
    depart: flight.depart || '10:00',
    arrive: flight.arrive || '11:00',
    from: flight.from || '',
    to: flight.to || '',
    flightNumber: flight.flightNumber || '',
    aircraftNumber: flight.aircraftNumber || '',
    fromTimezone: flight.fromTimezone || '',
    toTimezone: flight.toTimezone || '',
    airportBuffer: Number(flight.airportBuffer ?? trip.arrivalBuffer ?? 120),
    toAirportTransfer: flight.toAirportTransfer === undefined ? legacyTransfer : (flight.toAirportTransfer === null || flight.toAirportTransfer === '' ? null : Number(flight.toAirportTransfer)),
    fromAirportTransfer: flight.fromAirportTransfer === undefined ? legacyTransfer : (flight.fromAirportTransfer === null || flight.fromAirportTransfer === '' ? null : Number(flight.fromAirportTransfer)),
    notes: flight.notes || '',
    attachments: Array.isArray(flight.attachments) ? flight.attachments : []
  };
}

function normalizeActivity(activity, index, trip) {
  return {
    ...activity,
    id: activity.id || 'activity-' + (index + 1) + '-' + makeId().slice(0, 7),
    title: activity.title || activity.name || '',
    date: activity.date || trip.start,
    start: activity.start || '12:00',
    end: activity.end || '13:00',
    location: activity.location || '',
    category: activity.category || 'other',
    description: activity.description || activity.notes || '',
    notes: activity.notes || '',
    attachments: Array.isArray(activity.attachments) ? activity.attachments : []
  };
}

function normalizeTrip(value) {
  const raw = value || {};
  const trip = {
    ...clone(initialTrip),
    ...raw,
    id: raw.id || makeId(),
    name: raw.name || 'Viaje sin nombre',
    location: raw.location || '',
    start: raw.start || initialTrip.start,
    end: raw.end || raw.start || initialTrip.end,
    travelers: Math.max(1, Number(raw.travelers ?? raw.travelerCount ?? 2)),
    timezone: raw.timezone || '',
    dayStart: raw.dayStart || DEFAULT_USEFUL_START,
    dayEnd: raw.dayEnd || DEFAULT_USEFUL_END,
    arrivalBuffer: Number(raw.arrivalBuffer ?? 120),
    flights: [],
    transfers: [],
    events: []
  };
  if (trip.end < trip.start) trip.end = trip.start;
  if (Array.isArray(raw.hotels)) {
    trip.hotels = raw.hotels.map((hotel, index) => normalizeHotel(hotel, trip, index));
  } else if (raw.hotel && raw.hotel.name) {
    trip.hotels = [normalizeHotel({
      ...raw.hotel,
      id: raw.hotel.id || 'hotel-legacy',
      location: raw.hotel.location || trip.location,
      checkinDate: raw.hotel.checkinDate || trip.start,
      checkoutDate: raw.hotel.checkoutDate || trip.end,
      airportToHotelTransfer: raw.hotel.airportToHotelTransfer ?? raw.hotel.transfer,
      hotelToAirportTransfer: raw.hotel.hotelToAirportTransfer ?? raw.hotel.transfer
    }, trip, 0)];
  } else {
    trip.hotels = [];
  }
  trip.hotel = raw.hotel && typeof raw.hotel === 'object' ? { ...raw.hotel } : { name: '', checkin: '15:00', checkout: '11:00', transfer: 35 };
  trip.flights = (Array.isArray(raw.flights) ? raw.flights : []).map((flight, index) => normalizeFlight(flight, index, trip));
  trip.transfers = (Array.isArray(raw.transfers) ? raw.transfers : []).map((transfer, index) => normalizeTransfer(transfer, index, trip));
  trip.events = (Array.isArray(raw.events) ? raw.events : []).map((activity, index) => normalizeActivity(activity, index, trip));
  return trip;
}

function loadTrips() {
  try {
    const saved = JSON.parse(localStorage.getItem(TRIPS_KEY) || 'null');
    if (Array.isArray(saved) && saved.length) return saved.map(normalizeTrip);
    const old = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
    if (old && (old.flights || old.hotel || old.name)) return [normalizeTrip(old)];
  } catch (error) {
    console.warn('No se pudo leer la copia local de los viajes.', error);
  }
  return [normalizeTrip(initialTrip)];
}

let trips = loadTrips();
let selectedId = localStorage.getItem(SELECTED_KEY) || trips[0].id;
let trip = trips.find(function (item) { return item.id === selectedId; }) || trips[0];
let selectedDate = trip.start;
let currentView = 'itinerary';
let toastTimer;
const syncTimers = new Map();
const syncBusy = new Set();
const syncQueued = new Set();
const editor = document.getElementById('editorDialog');

function persistTrips() {
  try {
    localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
    localStorage.setItem(SELECTED_KEY, trip.id);
    return true;
  } catch (error) {
    notify('No hay espacio local suficiente. Sincroniza los adjuntos con GitHub y vuelve a intentarlo.');
    return false;
  }
}

function saveTrip() {
  persistTrips();
  renderAll();
  setSavedStatus('Guardado en este dispositivo');
  scheduleGitHubSave(trip.id);
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
  });
}

function parseDate(value) {
  const parts = String(value || '').split('-').map(Number);
  return new Date(parts[0] || 2000, (parts[1] || 1) - 1, parts[2] || 1, 12);
}

function dateKey(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function addDays(date, count) {
  const next = parseDate(date);
  next.setDate(next.getDate() + count);
  return dateKey(next);
}

function dayDifference(left, right) {
  return Math.round((Date.UTC(parseDate(right).getFullYear(), parseDate(right).getMonth(), parseDate(right).getDate()) - Date.UTC(parseDate(left).getFullYear(), parseDate(left).getMonth(), parseDate(left).getDate())) / 86400000);
}

function tripDays() {
  const days = [];
  const count = Math.min(366, Math.max(1, dayDifference(trip.start, trip.end) + 1));
  for (let index = 0; index < count; index += 1) days.push(addDays(trip.start, index));
  return days;
}

function formatDate(date, options) {
  if (!date) return '';
  return new Intl.DateTimeFormat('es-ES', options || { weekday: 'short', day: 'numeric', month: 'short' }).format(parseDate(date));
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(parseDate(date));
}

function formatRangeDate(start, end) {
  const first = formatDate(start, { day: 'numeric', month: 'short' });
  const last = formatDate(end, { day: 'numeric', month: 'short', year: 'numeric' });
  return first + ' — ' + last;
}

function formatMinutes(minutes) {
  const whole = Math.max(0, Math.round(minutes));
  const hours = Math.floor(whole / 60);
  const mins = whole % 60;
  if (hours && mins) return hours + ' h ' + mins + ' min';
  if (hours) return hours + (hours === 1 ? ' hora' : ' horas');
  return mins + ' min';
}

function validTimeZone(zone) {
  if (!zone) return true;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(new Date());
    return true;
  } catch (error) {
    return false;
  }
}

function tripZone() {
  return validTimeZone(trip.timezone) && trip.timezone ? trip.timezone : LOCAL_TIME_ZONE;
}

function partsAt(epoch, zone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone || LOCAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(epoch));
  const result = {};
  parts.forEach(function (part) { if (part.type !== 'literal') result[part.type] = Number(part.value); });
  return result;
}

function wallTimeToEpoch(date, time, zone) {
  const safeZone = validTimeZone(zone) && zone ? zone : LOCAL_TIME_ZONE;
  const dateParts = String(date).split('-').map(Number);
  const timeParts = String(time || '00:00').split(':').map(Number);
  const target = Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2], timeParts[0] || 0, timeParts[1] || 0, 0);
  let guess = target;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = partsAt(guess, safeZone);
    const represented = Date.UTC(current.year, current.month - 1, current.day, current.hour, current.minute, current.second);
    const difference = target - represented;
    guess += difference;
    if (difference === 0) break;
  }
  return guess;
}

function epochToWall(epoch, zone) {
  const current = partsAt(epoch, validTimeZone(zone) && zone ? zone : LOCAL_TIME_ZONE);
  return {
    date: current.year + '-' + String(current.month).padStart(2, '0') + '-' + String(current.day).padStart(2, '0'),
    time: String(current.hour).padStart(2, '0') + ':' + String(current.minute).padStart(2, '0'),
    minute: current.hour * 60 + current.minute,
    hour: current.hour
  };
}

function displayTime(epoch) {
  return epochToWall(epoch, tripZone()).time;
}

function airportTimeZone(airport, fallback) {
  const match = String(airport || '').toUpperCase().match(/\b([A-Z]{3})\b/g);
  if (match) {
    for (let index = match.length - 1; index >= 0; index -= 1) {
      if (timezoneByAirport[match[index]]) return timezoneByAirport[match[index]];
    }
  }
  return fallback || tripZone();
}

function flightEpochs(flight) {
  const departDate = flight.departureDate || flight.date || trip.start;
  const originZone = flight.fromTimezone || airportTimeZone(flight.from, tripZone());
  const destinationZone = flight.toTimezone || airportTimeZone(flight.to, tripZone());
  const departure = wallTimeToEpoch(departDate, flight.depart, originZone);
  let arrivalDate = flight.arrivalDate || departDate;
  let arrival = wallTimeToEpoch(arrivalDate, flight.arrive, destinationZone);
  let guard = 0;
  while (arrival <= departure && guard < 2) {
    arrivalDate = addDays(arrivalDate, 1);
    arrival = wallTimeToEpoch(arrivalDate, flight.arrive, destinationZone);
    guard += 1;
  }
  return { departure: departure, arrival: arrival, arrivalDate: arrivalDate, originZone: originZone, destinationZone: destinationZone };
}

function dayWindow(date) {
  const zone = tripZone();
  const midnight = wallTimeToEpoch(date, '00:00', zone);
  const nextMidnight = wallTimeToEpoch(addDays(date, 1), '00:00', zone);
  const usefulStart = wallTimeToEpoch(date, trip.dayStart || DEFAULT_USEFUL_START, zone);
  let usefulEnd = wallTimeToEpoch(date, trip.dayEnd || DEFAULT_USEFUL_END, zone);
  if (usefulEnd <= usefulStart) usefulEnd = wallTimeToEpoch(addDays(date, 1), trip.dayEnd || DEFAULT_USEFUL_END, zone);
  return { midnight: midnight, nextMidnight: nextMidnight, usefulStart: usefulStart, usefulEnd: usefulEnd };
}

function nearestHotel(date, direction) {
  if (!trip.hotels.length) return null;
  const sorted = trip.hotels.slice().sort(function (a, b) {
    const left = direction === 'arrival' ? dayDifference(date, a.checkinDate) : dayDifference(a.checkoutDate, date);
    const right = direction === 'arrival' ? dayDifference(date, b.checkinDate) : dayDifference(b.checkoutDate, date);
    return Math.abs(left) - Math.abs(right);
  });
  return sorted[0] || null;
}

function transferForFlight(flight, direction) {
  const flightValue = direction === 'arrival' ? flight.fromAirportTransfer : flight.toAirportTransfer;
  if (flightValue !== null && flightValue !== undefined && flightValue !== '') return Math.max(0, Number(flightValue) || 0);
  const date = direction === 'arrival' ? (flight.arrivalDate || flight.date) : (flight.departureDate || flight.date);
  const hotel = nearestHotel(date, direction);
  if (!hotel) return 0;
  return Math.max(0, Number(direction === 'arrival' ? hotel.airportToHotelTransfer : hotel.hotelToAirportTransfer) || 0);
}

function addBlock(blocks, start, end, title, detail, type, id) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
  blocks.push({ start: start, end: end, title: title, detail: detail || '', type: type || 'other', id: id || makeId() });
}

function allBlocks() {
  const blocks = [];
  trip.flights.forEach(function (flight) {
    const times = flightEpochs(flight);
    const buffer = Math.max(0, Number(flight.airportBuffer) || 0) * 60000;
    const outboundTransfer = (flight.toAirportTransfer !== null && flight.toAirportTransfer !== undefined && flight.toAirportTransfer !== '' || flight.direction === 'departure') ? transferForFlight(flight, 'departure') * 60000 : 0;
    if (outboundTransfer) addBlock(blocks, times.departure - buffer - outboundTransfer, times.departure - buffer, 'Traslado al aeropuerto', formatMinutes(outboundTransfer / 60000) + ' desde el alojamiento', 'transfer', flight.id + '-to-airport');
    if (buffer) addBlock(blocks, times.departure - buffer, times.departure, 'Antelación en el aeropuerto', formatMinutes(buffer / 60000) + ' antes del vuelo', 'airport', flight.id + '-buffer');
    const flightDetail = (flight.flightNumber ? flight.flightNumber + ' · ' : '') + (flight.from || 'Origen') + ' → ' + (flight.to || 'Destino');
    addBlock(blocks, times.departure, times.arrival, flight.flightNumber ? 'Vuelo ' + flight.flightNumber : 'Vuelo', flightDetail, 'flight', flight.id + '-flight');
    const arrivalTransfer = (flight.fromAirportTransfer !== null && flight.fromAirportTransfer !== undefined && flight.fromAirportTransfer !== '' || flight.direction === 'arrival') ? transferForFlight(flight, 'arrival') * 60000 : 0;
    if (arrivalTransfer) addBlock(blocks, times.arrival, times.arrival + arrivalTransfer, 'Traslado al hotel', formatMinutes(arrivalTransfer / 60000) + ' desde el aeropuerto', 'transfer', flight.id + '-to-hotel');
  });
  trip.transfers.forEach(function (transfer) {
    const start = wallTimeToEpoch(transfer.date, transfer.start, tripZone());
    let endDate = transfer.endDate || transfer.date;
    let end = wallTimeToEpoch(endDate, transfer.end, tripZone());
    if (end <= start) {
      endDate = addDays(transfer.date, 1);
      end = wallTimeToEpoch(endDate, transfer.end, tripZone());
    }
    const route = [transfer.origin, transfer.destination].filter(Boolean).join(' → ');
    const detail = [transferLabels[transfer.type] || transferLabels.other, route, transfer.operator, transfer.reference].filter(Boolean).join(' · ');
    addBlock(blocks, start, end, transfer.title || route || transferLabels[transfer.type] || 'Traslado', detail, 'transfer', transfer.id);
  });
  trip.hotels.forEach(function (hotel) {
    const checkinDuration = Math.max(0, Number(hotel.checkinDuration) || 0);
    if (checkinDuration) {
      const checkin = wallTimeToEpoch(hotel.checkinDate, hotel.checkin, tripZone());
      addBlock(blocks, checkin, checkin + checkinDuration * 60000, 'Check-in · ' + hotel.name, hotel.location || 'Registro en el alojamiento', 'hotel', hotel.id + '-checkin');
    }
    const checkoutDuration = Math.max(0, Number(hotel.checkoutDuration) || 0);
    if (checkoutDuration) {
      const checkout = wallTimeToEpoch(hotel.checkoutDate, hotel.checkout, tripZone());
      addBlock(blocks, checkout - checkoutDuration * 60000, checkout, 'Check-out · ' + hotel.name, hotel.location || 'Salida del alojamiento', 'hotel', hotel.id + '-checkout');
    }
  });
  trip.events.forEach(function (event) {
    const start = wallTimeToEpoch(event.date, event.start, tripZone());
    let end = wallTimeToEpoch(event.date, event.end, tripZone());
    if (end <= start) end = wallTimeToEpoch(addDays(event.date, 1), event.end, tripZone());
    const detail = [event.location, event.description || event.notes].filter(Boolean).join(' · ');
    addBlock(blocks, start, end, event.title, detail, 'activity', event.id);
  });
  return blocks.sort(function (a, b) { return a.start - b.start; });
}

function clipBlock(block, start, end) {
  const clippedStart = Math.max(block.start, start);
  const clippedEnd = Math.min(block.end, end);
  if (clippedEnd <= clippedStart) return null;
  return { ...block, start: clippedStart, end: clippedEnd, continued: clippedStart !== block.start || clippedEnd !== block.end };
}

function mergeIntervals(intervals) {
  const sorted = intervals.filter(function (item) { return item.end > item.start; }).sort(function (a, b) { return a.start - b.start; });
  const merged = [];
  sorted.forEach(function (item) {
    const last = merged[merged.length - 1];
    if (last && item.start < last.end) {
      last.end = Math.max(last.end, item.end);
      if (item.id) last.ids.push(item.id);
    } else {
      merged.push({ start: item.start, end: item.end, ids: item.id ? [item.id] : [] });
    }
  });
  return merged;
}

function groupedBlocks(blocks) {
  const sorted = blocks.slice().sort(function (a, b) { return a.start - b.start; });
  const groups = [];
  sorted.forEach(function (block) {
    const last = groups[groups.length - 1];
    if (last && block.start < last.end) {
      last.end = Math.max(last.end, block.end);
      last.items.push(block);
    } else {
      groups.push({ start: block.start, end: block.end, items: [block] });
    }
  });
  return groups;
}

function computeDay(date, reusableBlocks) {
  const window = dayWindow(date);
  const blocks = reusableBlocks || allBlocks();
  const display = blocks.map(function (block) { return clipBlock(block, window.midnight, window.nextMidnight); }).filter(Boolean);
  const workIntervals = blocks.map(function (block) { return clipBlock(block, window.usefulStart, window.usefulEnd); }).filter(Boolean);
  const merged = mergeIntervals(workIntervals);
  const free = [];
  let cursor = window.usefulStart;
  merged.forEach(function (interval) {
    if (interval.start > cursor) free.push({ start: cursor, end: interval.start });
    cursor = Math.max(cursor, interval.end);
  });
  if (cursor < window.usefulEnd) free.push({ start: cursor, end: window.usefulEnd });
  const rows = groupedBlocks(display).map(function (group) { return { ...group, rowType: 'occupied' }; });
  free.forEach(function (interval) { rows.push({ ...interval, rowType: 'free', items: [] }); });
  rows.sort(function (a, b) {
    if (a.start !== b.start) return a.start - b.start;
    return a.rowType === 'occupied' ? -1 : 1;
  });
  const freeMilliseconds = free.reduce(function (total, interval) { return total + interval.end - interval.start; }, 0);
  return { rows: rows, free: free, freeMilliseconds: freeMilliseconds, window: window };
}

function formatDurationMs(milliseconds) {
  return formatMinutes(Math.round(milliseconds / 60000));
}

function formatClock(epoch) {
  return displayTime(epoch);
}

function formatInterval(start, end) {
  return formatClock(start) + ' — ' + formatClock(end);
}

function eventConflicts() {
  const sorted = trip.events.map(function (event) {
    const start = wallTimeToEpoch(event.date, event.start, tripZone());
    let end = wallTimeToEpoch(event.date, event.end, tripZone());
    if (end <= start) end = wallTimeToEpoch(addDays(event.date, 1), event.end, tripZone());
    return { event: event, start: start, end: end };
  }).sort(function (a, b) { return a.start - b.start; });
  const conflicts = [];
  for (let left = 0; left < sorted.length; left += 1) {
    for (let right = left + 1; right < sorted.length && sorted[right].start < sorted[left].end; right += 1) {
      if (sorted[left].start < sorted[right].end) conflicts.push([sorted[left].event, sorted[right].event]);
    }
  }
  return conflicts;
}

function getFlightsForDay(date) {
  return trip.flights.filter(function (flight) {
    const times = flightEpochs(flight);
    const wallDeparture = epochToWall(times.departure, tripZone()).date;
    const wallArrival = epochToWall(times.arrival, tripZone()).date;
    return wallDeparture === date || wallArrival === date;
  }).sort(function (a, b) { return flightEpochs(a).departure - flightEpochs(b).departure; });
}

function getHotelsForDay(date) {
  return trip.hotels.filter(function (hotel) { return hotel.checkinDate <= date && hotel.checkoutDate >= date; });
}

function getTransfersForDay(date) {
  return trip.transfers.filter(function (transfer) { return transfer.date <= date && (transfer.endDate || transfer.date) >= date; }).sort(function (a, b) {
    return wallTimeToEpoch(a.date, a.start, tripZone()) - wallTimeToEpoch(b.date, b.start, tripZone());
  });
}

function getActivitiesForDay(date) {
  return trip.events.filter(function (event) { return event.date === date; }).sort(function (a, b) {
    return wallTimeToEpoch(a.date, a.start, tripZone()) - wallTimeToEpoch(b.date, b.start, tripZone());
  });
}

function setView(view) {
  currentView = view;
  document.querySelectorAll('[data-view]').forEach(function (button) { button.classList.toggle('active', button.dataset.view === view); });
  document.querySelectorAll('[data-view-panel]').forEach(function (panel) { panel.classList.toggle('active', panel.dataset.viewPanel === view); });
  const button = document.getElementById('addPrimaryBtn');
  button.textContent = view === 'flights' ? '＋ Añadir vuelo' : view === 'transfers' ? '＋ Añadir traslado' : view === 'hotels' ? '＋ Añadir hotel' : view === 'activities' ? '＋ Añadir actividad' : '＋ Añadir al itinerario';
}

function setSelectedDate(date) {
  selectedDate = date;
  renderDayPicker();
  renderSelectedDay();
}

function renderTripList() {
  const list = document.getElementById('tripList');
  list.innerHTML = trips.map(function (item) {
    return '<div class="trip-row"><button class="trip-link ' + (item.id === trip.id ? 'active' : '') + '" data-select-trip="' + escapeHtml(item.id) + '"><span class="trip-dot"></span><span class="trip-name">' + escapeHtml(item.name) + '</span></button>' +
      (trips.length > 1 ? '<button class="trip-delete" data-delete-trip="' + escapeHtml(item.id) + '" title="Borrar viaje" aria-label="Borrar ' + escapeHtml(item.name) + '">×</button>' : '') + '</div>';
  }).join('');
}

function renderHeader() {
  const count = tripDays().length;
  document.getElementById('breadcrumbName').textContent = trip.name;
  document.getElementById('tripTitle').innerHTML = escapeHtml(trip.name) + '<span class="title-dot">.</span>';
  document.getElementById('tripLocation').textContent = trip.location || 'Destino pendiente';
  document.getElementById('tripDates').textContent = formatRangeDate(trip.start, trip.end);
  document.getElementById('tripDuration').textContent = count + (count === 1 ? ' día' : ' días');
  document.getElementById('travelerCount').textContent = trip.travelers + (trip.travelers === 1 ? ' viajero' : ' viajeros');
  document.getElementById('dayCounter').textContent = 'Día ' + (Math.max(0, dayDifference(trip.start, selectedDate)) + 1) + ' de ' + count;
  document.getElementById('dayCountPill').textContent = count + (count === 1 ? ' día' : ' días');
  document.getElementById('usefulHoursLabel').textContent = trip.dayStart + ' — ' + trip.dayEnd;
}

function renderDayPicker() {
  const list = document.getElementById('dayList');
  list.innerHTML = tripDays().map(function (date, index) {
    const flights = getFlightsForDay(date);
    const transfers = getTransfersForDay(date);
    const activities = getActivitiesForDay(date);
    const hotels = getHotelsForDay(date);
    let description = 'Tiempo para descubrir';
    if (flights.length) description = flights.length + (flights.length === 1 ? ' trayecto' : ' trayectos');
    else if (transfers.length) description = transfers.length + (transfers.length === 1 ? ' traslado' : ' traslados');
    else if (activities.length) description = activities[0].title;
    else if (hotels.length) description = hotels[0].name;
    return '<button class="day-choice ' + (date === selectedDate ? 'selected' : '') + '" data-day="' + date + '">' +
      '<span class="day-choice-index">' + String(index + 1).padStart(2, '0') + '</span><span class="day-choice-date"><strong>' + escapeHtml(formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' })) + '</strong><small>' + escapeHtml(description) + '</small></span>' +
      '<span class="day-choice-dot ' + (flights.length ? 'has-flight' : transfers.length ? 'has-transfer' : activities.length ? 'has-activity' : '') + '"></span></button>';
  }).join('');
}

function timelineRowHtml(row) {
  const start = formatClock(row.start);
  const end = formatClock(row.end);
  if (row.rowType === 'free') {
    return '<article class="timeline-row free-row"><div class="timeline-time"><strong>' + start + '</strong><span>' + end + '</span></div><div class="timeline-node"><i></i></div><div class="timeline-block"><div class="timeline-block-title"><span class="type-icon">✳</span><strong>Tiempo libre</strong><span class="duration-pill">' + escapeHtml(formatDurationMs(row.end - row.start)) + '</span></div><p>Un hueco para disfrutar a tu ritmo.</p></div></article>';
  }
  const titles = row.items.map(function (item) {
    const typeClass = 'type-' + item.type;
    return '<div class="grouped-event ' + typeClass + '"><span class="type-icon">' + (item.type === 'flight' ? '✈' : item.type === 'transfer' || item.type === 'airport' ? '↗' : item.type === 'hotel' ? '⌂' : '✳') + '</span><div><strong>' + escapeHtml(item.title) + '</strong><p>' + escapeHtml(item.detail || '') + '</p></div></div>';
  }).join('');
  const label = row.items.length > 1 ? 'Varios planes' : row.items[0].title;
  return '<article class="timeline-row occupied-row"><div class="timeline-time"><strong>' + start + '</strong><span>' + end + '</span></div><div class="timeline-node"><i></i></div><div class="timeline-block"><div class="timeline-block-title"><strong>' + escapeHtml(label) + '</strong><span class="duration-pill">' + escapeHtml(formatDurationMs(row.end - row.start)) + '</span></div>' + titles + '</div></article>';
}

function renderSelectedDay() {
  if (!tripDays().includes(selectedDate)) selectedDate = trip.start;
  const all = allBlocks();
  const calculation = computeDay(selectedDate, all);
  const date = parseDate(selectedDate);
  const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(date);
  document.getElementById('selectedDayEyebrow').textContent = (weekday + ' · ' + formatDate(selectedDate, { day: 'numeric', month: 'long' })).toLocaleUpperCase('es-ES');
  const dayActivities = getActivitiesForDay(selectedDate);
  const dayFlights = getFlightsForDay(selectedDate);
  const dayTransfers = getTransfersForDay(selectedDate);
  const dayHotels = getHotelsForDay(selectedDate);
  document.getElementById('selectedDayTitle').textContent = dayActivities[0]?.title || (dayFlights.length ? 'Día de viaje' : dayTransfers.length ? 'Día de traslados' : dayHotels[0]?.name || 'Un día para disfrutar');
  const subtitle = dayHotels[0]?.location || trip.location || 'Tu agenda, traslados y ratos para ti en orden.';
  document.getElementById('selectedDaySub').textContent = subtitle;
  document.getElementById('selectedFreeTime').textContent = formatDurationMs(calculation.freeMilliseconds);
  const usefulMilliseconds = calculation.window.usefulEnd - calculation.window.usefulStart;
  const freePercent = usefulMilliseconds ? Math.round(calculation.freeMilliseconds / usefulMilliseconds * 100) : 0;
  document.getElementById('selectedFreePercent').textContent = freePercent + '% del horario útil';

  const dayConflicts = eventConflicts().filter(function (pair) { return pair[0].date === selectedDate || pair[1].date === selectedDate; });
  const warning = document.getElementById('dayWarnings');
  warning.hidden = dayConflicts.length === 0;
  warning.innerHTML = dayConflicts.length ? '<strong>Hay actividades que se solapan</strong><span>' + dayConflicts.map(function (pair) { return escapeHtml(pair[0].title) + ' y ' + escapeHtml(pair[1].title); }).join(' · ') + '</span>' : '';

  document.getElementById('timelineHours').innerHTML = '<span>' + escapeHtml(trip.dayStart) + '</span><span>HORARIO ÚTIL</span><span>' + escapeHtml(trip.dayEnd) + '</span>';
  const visibleRows = calculation.rows.filter(function (row) { return row.rowType === 'free' || row.items.some(function (item) { return item.type !== 'other'; }); });
  document.getElementById('dayTimeline').innerHTML = visibleRows.map(timelineRowHtml).join('');
  document.getElementById('timelineEmpty').hidden = visibleRows.some(function (row) { return row.rowType === 'occupied'; });
  document.getElementById('timelineEmpty').classList.toggle('empty-overlay', visibleRows.every(function (row) { return row.rowType === 'free'; }));

  const flightContainer = document.getElementById('dayFlights');
  flightContainer.innerHTML = dayFlights.map(function (flight) {
    const times = flightEpochs(flight);
    return '<div class="compact-item"><span class="compact-symbol flight-symbol">✈</span><div><strong>' + escapeHtml(flight.flightNumber || (flight.from + ' → ' + flight.to)) + '</strong><span>' + escapeHtml(formatClock(times.departure) + ' · ' + flight.from + ' → ' + flight.to) + '</span></div></div>';
  }).join('');
  document.getElementById('dayFlightsEmpty').hidden = dayFlights.length > 0;
  document.getElementById('dayTransfers').innerHTML = dayTransfers.map(function (transfer) {
    const route = [transfer.origin, transfer.destination].filter(Boolean).join(' → ');
    const title = transfer.title || route || transferLabels[transfer.type] || 'Traslado';
    return '<div class="compact-item"><span class="compact-symbol transfer-symbol">' + transferIcon(transfer.type) + '</span><div><strong>' + escapeHtml(title) + '</strong><span>' + escapeHtml((transferLabels[transfer.type] || 'Traslado') + ' · ' + transfer.start + ' — ' + transfer.end) + '</span></div></div>';
  }).join('');
  document.getElementById('dayTransfersEmpty').hidden = dayTransfers.length > 0;
  document.getElementById('dayHotels').innerHTML = dayHotels.map(function (hotel) {
    return '<div class="compact-item"><span class="compact-symbol hotel-symbol">⌂</span><div><strong>' + escapeHtml(hotel.name) + '</strong><span>' + escapeHtml(hotel.location || 'Alojamiento') + '</span></div></div>';
  }).join('');
  document.getElementById('dayHotelsEmpty').hidden = dayHotels.length > 0;
  document.getElementById('dayActivities').innerHTML = dayActivities.slice(0, 3).map(function (activity) {
    return '<div class="compact-item"><span class="compact-symbol activity-symbol">' + categoryIcon(activity.category) + '</span><div><strong>' + escapeHtml(activity.title) + '</strong><span>' + escapeHtml(activity.start + ' — ' + activity.end) + '</span></div></div>';
  }).join('');
  document.getElementById('dayActivitiesEmpty').hidden = dayActivities.length > 0;
}

function categoryIcon(category) {
  return { food: '◇', visit: '⌖', transport: '↗', show: '♫', other: '✳' }[category] || '✳';
}

function categoryLabel(category) {
  return { food: 'Comida', visit: 'Visita', transport: 'Transporte', show: 'Espectáculo', other: 'Otro plan' }[category] || 'Otro plan';
}

function transferIcon(type) {
  return { bus: '▰', car: '◉', train: '▤', taxi: '◆', ferry: '◒', metro: 'Ⓜ', other: '↗' }[type] || '↗';
}

function attachmentMarkup(item, scope, id) {
  const attachments = item.attachments || [];
  return '<div class="attachment-area"><label class="attach-picker">＋ Adjuntar entrada o archivo<input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" multiple data-attachment-input="' + scope + '" data-owner-id="' + escapeHtml(id) + '"></label>' +
    '<div class="attachment-list">' + attachments.map(function (attachment) {
      return '<span class="attachment-chip"><button type="button" data-download-attachment="' + escapeHtml(attachment.id) + '" data-attachment-scope="' + scope + '" data-owner-id="' + escapeHtml(id) + '">↧ ' + escapeHtml(attachment.name) + '</button><button type="button" class="attachment-remove" data-remove-attachment="' + escapeHtml(attachment.id) + '" data-attachment-scope="' + scope + '" data-owner-id="' + escapeHtml(id) + '" aria-label="Quitar adjunto">×</button></span>';
    }).join('') + '</div></div>';
}

function renderFlights() {
  const list = document.getElementById('flightList');
  const sorted = trip.flights.slice().sort(function (a, b) { return flightEpochs(a).departure - flightEpochs(b).departure; });
  list.innerHTML = sorted.map(function (flight) {
    const times = flightEpochs(flight);
    const buffer = Number(flight.airportBuffer) || 0;
    const transfer = flight.toAirportTransfer !== null && flight.toAirportTransfer !== undefined ? transferForFlight(flight, 'departure') : flight.direction === 'departure' ? transferForFlight(flight, 'departure') : 0;
    const toAirportAt = times.departure - (buffer + transfer) * 60000;
    const detail = [flight.direction === 'arrival' ? 'Llegada' : flight.direction === 'departure' ? 'Salida' : 'Conexión', flight.flightNumber, flight.aircraftNumber ? 'Avión ' + flight.aircraftNumber : ''].filter(Boolean).join(' · ');
    return '<article class="entity-card flight-entity"><div class="entity-icon flight-symbol">✈</div><div class="entity-main"><div class="entity-topline"><span class="entity-kicker">' + escapeHtml(detail) + '</span><span class="entity-date">' + escapeHtml(formatDate(epochToWall(times.departure, tripZone()).date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })) + '</span></div><h3>' + escapeHtml(flight.from || 'Origen') + ' <span>→</span> ' + escapeHtml(flight.to || 'Destino') + '</h3><div class="flight-times"><span><small>Salida</small><strong>' + escapeHtml(formatClock(times.departure)) + '</strong><em>' + escapeHtml(flight.fromTimezone || times.originZone) + '</em></span><i>✈</i><span><small>Llegada ' + (epochToWall(times.arrival, tripZone()).date !== epochToWall(times.departure, tripZone()).date ? '· día siguiente' : '') + '</small><strong>' + escapeHtml(formatClock(times.arrival)) + '</strong><em>' + escapeHtml(flight.toTimezone || times.destinationZone) + '</em></span></div><div class="entity-details"><span>En aeropuerto ' + escapeHtml(formatMinutes(buffer)) + ' antes</span>' + (transfer ? '<span>Traslado al aeropuerto ' + escapeHtml(formatMinutes(transfer)) + '</span>' : '') + '</div>' + (flight.notes ? '<p class="entity-notes">' + escapeHtml(flight.notes) + '</p>' : '') + attachmentMarkup(flight, 'flight', flight.id) + '</div><div class="entity-actions"><button class="button button-text" data-edit-kind="flight" data-edit-id="' + escapeHtml(flight.id) + '">Editar</button><button class="row-remove" data-delete-kind="flight" data-delete-id="' + escapeHtml(flight.id) + '" aria-label="Borrar vuelo">×</button></div></article>';
  }).join('');
  document.getElementById('flightListEmpty').hidden = trip.flights.length > 0;
}

function renderHotels() {
  const list = document.getElementById('hotelList');
  const sorted = trip.hotels.slice().sort(function (a, b) { return a.checkinDate.localeCompare(b.checkinDate); });
  list.innerHTML = sorted.map(function (hotel) {
    return '<article class="entity-card"><div class="entity-icon hotel-symbol">⌂</div><div class="entity-main"><div class="entity-topline"><span class="entity-kicker">ALOJAMIENTO</span><span class="entity-date">' + escapeHtml(formatRangeDate(hotel.checkinDate, hotel.checkoutDate)) + '</span></div><h3>' + escapeHtml(hotel.name || 'Hotel sin nombre') + '</h3><div class="entity-details"><span>' + escapeHtml(hotel.location || trip.location || 'Ubicación pendiente') + '</span><span>Check-in ' + escapeHtml(hotel.checkin) + ' · check-out ' + escapeHtml(hotel.checkout) + '</span><span>Traslados aeropuerto ' + escapeHtml(formatMinutes(hotel.airportToHotelTransfer)) + ' / ' + escapeHtml(formatMinutes(hotel.hotelToAirportTransfer)) + '</span></div>' + (hotel.notes ? '<p class="entity-notes">' + escapeHtml(hotel.notes) + '</p>' : '') + attachmentMarkup(hotel, 'hotel', hotel.id) + '</div><div class="entity-actions"><button class="button button-text" data-edit-kind="hotel" data-edit-id="' + escapeHtml(hotel.id) + '">Editar</button><button class="row-remove" data-delete-kind="hotel" data-delete-id="' + escapeHtml(hotel.id) + '" aria-label="Borrar hotel">×</button></div></article>';
  }).join('');
  document.getElementById('hotelListEmpty').hidden = trip.hotels.length > 0;
  const legacy = trip.hotels[0];
  trip.hotel = legacy ? { ...trip.hotel, name: legacy.name, checkin: legacy.checkin, checkout: legacy.checkout, transfer: legacy.airportToHotelTransfer, notes: legacy.notes, attachments: legacy.attachments } : { ...trip.hotel, name: '' };
}

function renderTransfers() {
  const list = document.getElementById('transferList');
  const sorted = trip.transfers.slice().sort(function (a, b) {
    return wallTimeToEpoch(a.date, a.start, tripZone()) - wallTimeToEpoch(b.date, b.start, tripZone());
  });
  list.innerHTML = sorted.map(function (transfer) {
    const route = [transfer.origin, transfer.destination].filter(Boolean).join(' → ');
    const title = transfer.title || route || transferLabels[transfer.type] || 'Traslado';
    const dateRange = transfer.date === (transfer.endDate || transfer.date) ? formatDate(transfer.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : formatRangeDate(transfer.date, transfer.endDate);
    const details = [transfer.start + ' — ' + transfer.end, transfer.title ? route : '', transfer.operator, transfer.reference ? 'Localizador ' + transfer.reference : ''].filter(Boolean);
    return '<article class="entity-card transfer-entity"><div class="entity-icon transfer-symbol">' + transferIcon(transfer.type) + '</div><div class="entity-main"><div class="entity-topline"><span class="entity-kicker">' + escapeHtml(transferLabels[transfer.type] || 'Traslado') + '</span><span class="entity-date">' + escapeHtml(dateRange) + '</span></div><h3>' + escapeHtml(title) + '</h3><div class="entity-details">' + details.map(function (detail) { return '<span>' + escapeHtml(detail) + '</span>'; }).join('') + '</div>' + (transfer.notes ? '<p class="entity-notes">' + escapeHtml(transfer.notes) + '</p>' : '') + attachmentMarkup(transfer, 'transfer', transfer.id) + '</div><div class="entity-actions"><button class="button button-text" data-edit-kind="transfer" data-edit-id="' + escapeHtml(transfer.id) + '">Editar</button><button class="row-remove" data-delete-kind="transfer" data-delete-id="' + escapeHtml(transfer.id) + '" aria-label="Borrar traslado">×</button></div></article>';
  }).join('');
  document.getElementById('transferListEmpty').hidden = trip.transfers.length > 0;
}

function renderActivities() {
  const list = document.getElementById('activitiesList');
  const conflicts = eventConflicts();
  const conflictingIds = new Set(conflicts.flatMap(function (pair) { return pair.map(function (event) { return event.id; }); }));
  const sorted = trip.events.slice().sort(function (a, b) {
    const left = wallTimeToEpoch(a.date, a.start, tripZone());
    const right = wallTimeToEpoch(b.date, b.start, tripZone());
    return left - right;
  });
  list.innerHTML = sorted.map(function (activity) {
    return '<article class="entity-card activity-entity ' + (conflictingIds.has(activity.id) ? 'has-conflict' : '') + '"><div class="entity-icon activity-symbol">' + categoryIcon(activity.category) + '</div><div class="entity-main"><div class="entity-topline"><span class="entity-kicker">' + escapeHtml(categoryLabel(activity.category)) + (conflictingIds.has(activity.id) ? ' · Se solapa con otro plan' : '') + '</span><span class="entity-date">' + escapeHtml(formatDate(activity.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })) + '</span></div><h3>' + escapeHtml(activity.title) + '</h3><div class="entity-details"><span>' + escapeHtml(activity.start + ' — ' + activity.end) + '</span>' + (activity.location ? '<span>' + escapeHtml(activity.location) + '</span>' : '') + '</div>' + (activity.description || activity.notes ? '<p class="entity-notes">' + escapeHtml(activity.description || activity.notes) + '</p>' : '') + attachmentMarkup(activity, 'event', activity.id) + '</div><div class="entity-actions"><button class="button button-text" data-edit-kind="event" data-edit-id="' + escapeHtml(activity.id) + '">Editar</button><button class="row-remove" data-delete-kind="event" data-delete-id="' + escapeHtml(activity.id) + '" aria-label="Borrar actividad">×</button></div></article>';
  }).join('');
  document.getElementById('activitiesListEmpty').hidden = trip.events.length > 0;
}

function renderSummary() {
  const days = tripDays();
  const blocks = allBlocks();
  const freeMilliseconds = days.reduce(function (total, date) { return total + computeDay(date, blocks).freeMilliseconds; }, 0);
  document.getElementById('daysStat').textContent = days.length + (days.length === 1 ? ' día' : ' días');
  document.getElementById('freeStat').textContent = formatDurationMs(freeMilliseconds);
  document.getElementById('flightsStat').textContent = trip.flights.length;
  document.getElementById('transfersStat').textContent = trip.transfers.length;
  document.getElementById('hotelsStat').textContent = trip.hotels.length;
  const nextFlight = trip.flights.slice().sort(function (a, b) { return flightEpochs(a).departure - flightEpochs(b).departure; })[0];
  document.getElementById('nextFlightTitle').textContent = nextFlight ? nextFlight.flightNumber || nextFlight.from + ' → ' + nextFlight.to : 'Sin vuelos';
  document.getElementById('nextFlightDetail').textContent = nextFlight ? formatDate(flightEpochs(nextFlight).arrivalDate, { weekday: 'long', day: 'numeric', month: 'long' }) + ' · salida ' + formatClock(flightEpochs(nextFlight).departure) : 'Añade tus trayectos al itinerario.';
  const nextHotel = trip.hotels.slice().sort(function (a, b) { return a.checkinDate.localeCompare(b.checkinDate); })[0];
  document.getElementById('nextHotelTitle').textContent = nextHotel ? nextHotel.name : 'Sin alojamientos';
  document.getElementById('nextHotelDetail').textContent = nextHotel ? formatRangeDate(nextHotel.checkinDate, nextHotel.checkoutDate) + ' · ' + (nextHotel.location || trip.location) : 'Añade tus reservas para verlas en cada día.';
}

function renderAll() {
  if (!tripDays().includes(selectedDate)) selectedDate = trip.start;
  renderTripList();
  renderHeader();
  renderDayPicker();
  renderSelectedDay();
  renderFlights();
  renderTransfers();
  renderHotels();
  renderActivities();
  renderSummary();
  setView(currentView);
}

function field(label, name, value, type, options, full, hint) {
  const className = 'field' + (full ? ' full' : '');
  const id = 'f_' + name;
  let input;
  const safeValue = escapeHtml(value == null ? '' : value);
  if (type === 'select') {
    input = '<select id="' + id + '" name="' + name + '">' + (options || []).map(function (option) {
      return '<option value="' + escapeHtml(option[0]) + '"' + (String(value) === String(option[0]) ? ' selected' : '') + '>' + escapeHtml(option[1]) + '</option>';
    }).join('') + '</select>';
  } else if (type === 'textarea') {
    input = '<textarea id="' + id + '" name="' + name + '" rows="4">' + safeValue + '</textarea>';
  } else {
    input = '<input id="' + id + '" name="' + name + '" type="' + (type || 'text') + '" value="' + safeValue + '"' + (type === 'number' ? ' min="0" step="any"' : '') + '>';
  }
  return '<div class="' + className + '"><label for="' + id + '">' + label + '</label>' + input + (hint ? '<span class="field-hint">' + hint + '</span>' : '') + '</div>';
}

function openEditor(kind, id) {
  const fields = document.getElementById('formFields');
  const title = document.getElementById('modalTitle');
  const eyebrow = document.getElementById('modalEyebrow');
  let item = null;
  if (id && kind === 'flight') item = trip.flights.find(function (flight) { return flight.id === id; });
  if (id && kind === 'transfer') item = trip.transfers.find(function (transfer) { return transfer.id === id; });
  if (id && kind === 'hotel') item = trip.hotels.find(function (hotel) { return hotel.id === id; });
  if (id && kind === 'event') item = trip.events.find(function (event) { return event.id === id; });
  editor.dataset.kind = kind;
  editor.dataset.editId = id || '';
  editor.dataset.fromTzEdited = 'false';
  editor.dataset.toTzEdited = 'false';
  const today = dateKey(new Date());
  if (kind === 'trip' || kind === 'newTrip') {
    const creating = kind === 'newTrip';
    title.textContent = creating ? 'Crear un viaje' : 'Editar viaje';
    eyebrow.textContent = creating ? 'EMPIEZA A PLANEAR' : 'DATOS DEL VIAJE';
    fields.innerHTML = [
      field('Nombre del viaje', 'name', creating ? '' : trip.name, 'text'),
      field('Destino', 'location', creating ? '' : trip.location, 'text'),
      field('Fecha de inicio', 'start', creating ? today : trip.start, 'date'),
      field('Fecha de fin', 'end', creating ? addDays(today, 4) : trip.end, 'date'),
      field('Número de viajeros', 'travelers', creating ? 2 : trip.travelers, 'number'),
      field('Zona horaria del destino', 'timezone', creating ? LOCAL_TIME_ZONE : trip.timezone, 'text', null, false, 'Ejemplo: Europe/Madrid o Asia/Bangkok'),
      field('Inicio del horario útil', 'dayStart', creating ? DEFAULT_USEFUL_START : trip.dayStart, 'time'),
      field('Fin del horario útil', 'dayEnd', creating ? DEFAULT_USEFUL_END : trip.dayEnd, 'time'),
      field('Antelación habitual en el aeropuerto (min)', 'arrivalBuffer', creating ? 120 : trip.arrivalBuffer, 'number', null, false, 'Se puede ajustar para cada vuelo.')
    ].join('');
  } else if (kind === 'hours') {
    title.textContent = 'Horario útil';
    eyebrow.textContent = 'TIEMPO LIBRE';
    fields.innerHTML = [
      field('Empieza el día', 'dayStart', trip.dayStart, 'time'),
      field('Termina el día', 'dayEnd', trip.dayEnd, 'time')
    ].join('');
  } else if (kind === 'flight') {
    title.textContent = item ? 'Editar vuelo' : 'Añadir vuelo';
    eyebrow.textContent = 'TRAYECTOS Y AEROPUERTOS';
    const origin = item ? item.from : '';
    const destination = item ? item.to : '';
    const storedBuffer = item ? Number(item.airportBuffer) : Number(trip.arrivalBuffer);
    const bufferUsesHours = storedBuffer >= 60 && storedBuffer % 60 === 0;
    const bufferAmount = bufferUsesHours ? storedBuffer / 60 : storedBuffer;
    fields.innerHTML = [
      field('Tipo de trayecto', 'direction', item ? item.direction : 'arrival', 'select', [['arrival', 'Llegada al destino'], ['departure', 'Salida de vuelta'], ['connection', 'Conexión']]),
      field('Origen', 'from', origin, 'text'),
      field('Destino', 'to', destination, 'text'),
      field('Número de vuelo', 'flightNumber', item ? item.flightNumber : '', 'text'),
      field('Número o matrícula del avión', 'aircraftNumber', item ? item.aircraftNumber : '', 'text'),
      field('Fecha de salida', 'departureDate', item ? (item.departureDate || item.date) : selectedDate, 'date'),
      field('Hora de salida', 'depart', item ? item.depart : '10:00', 'time'),
      field('Zona horaria de salida', 'fromTimezone', item ? (item.fromTimezone || airportTimeZone(item.from, tripZone())) : airportTimeZone(origin, tripZone()), 'text', null, false, 'IANA, por ejemplo Europe/Madrid'),
      field('Fecha de llegada', 'arrivalDate', item ? item.arrivalDate : selectedDate, 'date'),
      field('Hora de llegada', 'arrive', item ? item.arrive : '11:30', 'time'),
      field('Zona horaria de llegada', 'toTimezone', item ? (item.toTimezone || airportTimeZone(item.to, tripZone())) : airportTimeZone(destination, tripZone()), 'text', null, false, 'Usa la hora local del aeropuerto'),
      field('Antelación necesaria', 'airportBufferAmount', bufferAmount, 'number', null, false, 'Puedes indicarla en horas o minutos.'),
      field('Unidad de antelación', 'airportBufferUnit', bufferUsesHours ? 'hours' : 'minutes', 'select', [['minutes', 'Minutos'], ['hours', 'Horas']]),
      field('Traslado al aeropuerto (min)', 'toAirportTransfer', item ? item.toAirportTransfer : '', 'number', null, false, 'En blanco: se usa el tiempo del hotel más próximo.'),
      field('Traslado desde el aeropuerto (min)', 'fromAirportTransfer', item ? item.fromAirportTransfer : '', 'number', null, false, 'En blanco: se usa el tiempo del hotel más próximo.'),
      field('Observaciones', 'notes', item ? item.notes : '', 'textarea', null, true, 'Localizador, terminal, equipaje o recordatorios.')
    ].join('');
  } else if (kind === 'transfer') {
    title.textContent = item ? 'Editar traslado' : 'Añadir traslado';
    eyebrow.textContent = 'BUS, COCHE, TREN Y MÁS';
    fields.innerHTML = [
      field('Tipo de transporte', 'type', item ? item.type : 'train', 'select', [['bus', 'Bus'], ['car', 'Coche'], ['train', 'Tren'], ['taxi', 'Taxi'], ['ferry', 'Ferry'], ['metro', 'Metro'], ['other', 'Otro']]),
      field('Nombre o referencia del trayecto', 'title', item ? item.title : '', 'text'),
      field('Origen', 'origin', item ? item.origin : '', 'text'),
      field('Destino', 'destination', item ? item.destination : '', 'text'),
      field('Fecha de salida', 'date', item ? item.date : selectedDate, 'date'),
      field('Hora de salida', 'start', item ? item.start : '12:00', 'time'),
      field('Fecha de llegada', 'endDate', item ? (item.endDate || item.date) : selectedDate, 'date'),
      field('Hora de llegada', 'end', item ? item.end : '13:00', 'time'),
      field('Compañía, línea o matrícula', 'operator', item ? item.operator : '', 'text'),
      field('Localizador o número de billete', 'reference', item ? item.reference : '', 'text'),
      field('Observaciones', 'notes', item ? item.notes : '', 'textarea', null, true, 'Punto de encuentro, equipaje o indicaciones.')
    ].join('');
  } else if (kind === 'hotel') {
    title.textContent = item ? 'Editar hotel' : 'Añadir hotel';
    eyebrow.textContent = 'ALOJAMIENTO Y TRASLADOS';
    fields.innerHTML = [
      field('Nombre del hotel', 'name', item ? item.name : '', 'text', null, true),
      field('Ubicación o dirección', 'location', item ? item.location : trip.location, 'text', null, true),
      field('Fecha de check-in', 'checkinDate', item ? item.checkinDate : selectedDate, 'date'),
      field('Hora de check-in', 'checkin', item ? item.checkin : '15:00', 'time'),
      field('Duración del check-in (min)', 'checkinDuration', item ? item.checkinDuration : 30, 'number'),
      field('Fecha de check-out', 'checkoutDate', item ? item.checkoutDate : trip.end, 'date'),
      field('Hora de check-out', 'checkout', item ? item.checkout : '11:00', 'time'),
      field('Duración del check-out (min)', 'checkoutDuration', item ? item.checkoutDuration : 30, 'number'),
      field('Traslado aeropuerto → hotel (min)', 'airportToHotelTransfer', item ? item.airportToHotelTransfer : 35, 'number'),
      field('Traslado hotel → aeropuerto (min)', 'hotelToAirportTransfer', item ? item.hotelToAirportTransfer : 35, 'number'),
      field('Observaciones', 'notes', item ? item.notes : '', 'textarea', null, true, 'Dirección, teléfono, localizador o indicaciones.')
    ].join('');
  } else {
    title.textContent = item ? 'Editar actividad' : 'Añadir actividad';
    eyebrow.textContent = 'PLANES Y RESERVAS';
    fields.innerHTML = [
      field('Nombre de la actividad', 'title', item ? item.title : '', 'text', null, true),
      field('Día', 'date', item ? item.date : selectedDate, 'date'),
      field('Hora de inicio', 'start', item ? item.start : '12:00', 'time'),
      field('Hora de fin', 'end', item ? item.end : '13:00', 'time'),
      field('Categoría', 'category', item ? item.category : 'other', 'select', [['other', 'Otro plan'], ['visit', 'Visita'], ['food', 'Comida'], ['transport', 'Transporte'], ['show', 'Espectáculo']]),
      field('Ubicación', 'location', item ? item.location : '', 'text', null, true),
      field('Descripción y observaciones', 'description', item ? (item.description || item.notes) : '', 'textarea', null, true)
    ].join('');
  }
  editor.showModal();
  const first = fields.querySelector('input,select,textarea');
  if (first) first.focus({ preventScroll: true });
}

function trimValue(value) {
  return String(value || '').trim();
}

function formDataObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function checkTimeZoneFields(values) {
  const fields = ['timezone', 'fromTimezone', 'toTimezone'];
  for (const name of fields) {
    if (values[name] && !validTimeZone(values[name])) {
      notify('Revisa la zona horaria. Usa un nombre como Europe/Madrid.');
      return false;
    }
  }
  return true;
}

function syncLegacyHotel() {
  const first = trip.hotels[0];
  trip.hotel = first ? {
    ...trip.hotel,
    id: first.id,
    name: first.name,
    location: first.location,
    checkin: first.checkin,
    checkout: first.checkout,
    checkinDate: first.checkinDate,
    checkoutDate: first.checkoutDate,
    transfer: first.airportToHotelTransfer,
    notes: first.notes,
    attachments: first.attachments
  } : { ...trip.hotel, name: '' };
}

function saveEditor(form) {
  const kind = editor.dataset.kind;
  const id = editor.dataset.editId;
  const values = formDataObject(form);
  if (!checkTimeZoneFields(values)) return;
  if (kind === 'newTrip') {
    if (!trimValue(values.name) || !values.start || !values.end) return notify('Indica un nombre y las fechas del viaje.');
    if (values.end < values.start) return notify('La fecha de fin debe ser posterior al inicio.');
    if (values.dayEnd <= values.dayStart) return notify('El fin del horario útil debe ser posterior al inicio.');
    trip = normalizeTrip({
      id: makeId(),
      name: trimValue(values.name),
      location: trimValue(values.location),
      start: values.start,
      end: values.end,
      travelers: Math.max(1, Number(values.travelers) || 1),
      timezone: trimValue(values.timezone),
      dayStart: values.dayStart,
      dayEnd: values.dayEnd,
      arrivalBuffer: Number(values.arrivalBuffer) || 0,
      hotels: [],
      flights: [],
      events: []
    });
    trips.unshift(trip);
    selectedDate = trip.start;
    setView('itinerary');
  } else if (kind === 'trip') {
    if (!trimValue(values.name) || !values.start || !values.end) return notify('Indica un nombre y las fechas del viaje.');
    if (values.end < values.start) return notify('La fecha de fin debe ser posterior al inicio.');
    if (values.dayEnd <= values.dayStart) return notify('El fin del horario útil debe ser posterior al inicio.');
    const oldRange = trip.start + ':' + trip.end;
    trip.name = trimValue(values.name);
    trip.location = trimValue(values.location);
    trip.start = values.start;
    trip.end = values.end;
    trip.travelers = Math.max(1, Number(values.travelers) || 1);
    trip.timezone = trimValue(values.timezone);
    trip.dayStart = values.dayStart;
    trip.dayEnd = values.dayEnd;
    trip.arrivalBuffer = Math.max(0, Number(values.arrivalBuffer) || 0);
    selectedDate = trip.start;
    if (oldRange !== trip.start + ':' + trip.end) {
      const outside = trip.events.some(function (event) { return event.date < trip.start || event.date > trip.end; }) || trip.hotels.some(function (hotel) { return hotel.checkinDate < trip.start || hotel.checkoutDate > trip.end; }) || trip.transfers.some(function (transfer) { return transfer.date < trip.start || (transfer.endDate || transfer.date) > trip.end; });
      if (outside) notify('Se actualizaron los días; los datos que quedan fuera del nuevo rango se han conservado.');
    }
  } else if (kind === 'hours') {
    if (!values.dayStart || !values.dayEnd || values.dayEnd <= values.dayStart) return notify('Configura un horario útil válido, por ejemplo 08:00 — 22:00.');
    trip.dayStart = values.dayStart;
    trip.dayEnd = values.dayEnd;
  } else if (kind === 'flight') {
    if (!trimValue(values.from) || !trimValue(values.to) || !values.departureDate || !values.arrivalDate || !values.depart || !values.arrive) return notify('Completa aeropuertos, fechas y horarios del vuelo.');
    const current = id ? trip.flights.find(function (flight) { return flight.id === id; }) : null;
    const flight = {
      ...(current || {}),
      id: id || makeId(),
      direction: values.direction,
      date: values.departureDate,
      departureDate: values.departureDate,
      arrivalDate: values.arrivalDate,
      from: trimValue(values.from),
      to: trimValue(values.to),
      flightNumber: trimValue(values.flightNumber),
      aircraftNumber: trimValue(values.aircraftNumber),
      depart: values.depart,
      arrive: values.arrive,
      fromTimezone: trimValue(values.fromTimezone),
      toTimezone: trimValue(values.toTimezone),
      airportBuffer: Math.max(0, Number(values.airportBufferAmount) || 0) * (values.airportBufferUnit === 'hours' ? 60 : 1),
      toAirportTransfer: values.toAirportTransfer === '' ? null : Math.max(0, Number(values.toAirportTransfer) || 0),
      fromAirportTransfer: values.fromAirportTransfer === '' ? null : Math.max(0, Number(values.fromAirportTransfer) || 0),
      notes: trimValue(values.notes),
      attachments: current ? current.attachments : []
    };
    const times = flightEpochs(flight);
    if (times.arrival <= times.departure) return notify('Revisa las horas y zonas horarias del vuelo.');
    flight.arrivalDate = times.arrivalDate;
    if (current) trip.flights = trip.flights.map(function (item) { return item.id === id ? flight : item; });
    else trip.flights.push(flight);
  } else if (kind === 'transfer') {
    if (!trimValue(values.origin) || !trimValue(values.destination) || !values.date || !values.start || !values.end) return notify('Completa el origen, el destino, la fecha y las horas del traslado.');
    const current = id ? trip.transfers.find(function (transfer) { return transfer.id === id; }) : null;
    let endDate = values.endDate || values.date;
    if (endDate < values.date) return notify('La fecha de llegada no puede ser anterior a la salida.');
    if (endDate === values.date && values.end <= values.start) endDate = addDays(values.date, 1);
    const transfer = {
      ...(current || {}),
      id: id || makeId(),
      type: transferLabels[values.type] ? values.type : 'other',
      title: trimValue(values.title),
      origin: trimValue(values.origin),
      destination: trimValue(values.destination),
      date: values.date,
      endDate: endDate,
      start: values.start,
      end: values.end,
      operator: trimValue(values.operator),
      reference: trimValue(values.reference),
      notes: trimValue(values.notes),
      attachments: current ? current.attachments : []
    };
    if (current) trip.transfers = trip.transfers.map(function (item) { return item.id === id ? transfer : item; });
    else trip.transfers.push(transfer);
    trip.transfers.sort(function (a, b) { return a.date.localeCompare(b.date) || a.start.localeCompare(b.start); });
    selectedDate = transfer.date;
  } else if (kind === 'hotel') {
    if (!trimValue(values.name) || !values.checkinDate || !values.checkoutDate) return notify('Indica el nombre del hotel y las fechas de entrada y salida.');
    if (values.checkoutDate < values.checkinDate) return notify('El check-out no puede ser anterior al check-in.');
    const current = id ? trip.hotels.find(function (hotel) { return hotel.id === id; }) : null;
    const hotel = {
      ...(current || {}),
      id: id || makeId(),
      name: trimValue(values.name),
      location: trimValue(values.location),
      checkinDate: values.checkinDate,
      checkin: values.checkin || '15:00',
      checkoutDate: values.checkoutDate,
      checkout: values.checkout || '11:00',
      checkinDuration: Math.max(0, Number(values.checkinDuration) || 0),
      checkoutDuration: Math.max(0, Number(values.checkoutDuration) || 0),
      airportToHotelTransfer: Math.max(0, Number(values.airportToHotelTransfer) || 0),
      hotelToAirportTransfer: Math.max(0, Number(values.hotelToAirportTransfer) || 0),
      notes: trimValue(values.notes),
      attachments: current ? current.attachments : []
    };
    if (current) trip.hotels = trip.hotels.map(function (item) { return item.id === id ? hotel : item; });
    else trip.hotels.push(hotel);
    trip.hotels.sort(function (a, b) { return a.checkinDate.localeCompare(b.checkinDate); });
    syncLegacyHotel();
  } else if (kind === 'event') {
    if (!trimValue(values.title) || !values.date || !values.start || !values.end) return notify('Completa el nombre, el día y el horario de la actividad.');
    const current = id ? trip.events.find(function (event) { return event.id === id; }) : null;
    const activity = {
      ...(current || {}),
      id: id || makeId(),
      title: trimValue(values.title),
      date: values.date,
      start: values.start,
      end: values.end,
      category: values.category || 'other',
      location: trimValue(values.location),
      description: trimValue(values.description),
      notes: trimValue(values.description),
      attachments: current ? current.attachments : []
    };
    if (current) trip.events = trip.events.map(function (item) { return item.id === id ? activity : item; });
    else trip.events.push(activity);
    selectedDate = values.date;
  }
  editor.close();
  saveTrip();
  notify(kind === 'newTrip' ? 'Viaje creado.' : kind === 'trip' ? 'Viaje actualizado.' : kind === 'hours' ? 'Horario útil actualizado.' : kind === 'flight' ? 'Vuelo guardado.' : kind === 'transfer' ? 'Traslado guardado.' : kind === 'hotel' ? 'Hotel guardado.' : 'Actividad guardada.');
}

function selectTrip(id) {
  const found = trips.find(function (item) { return item.id === id; });
  if (!found) return;
  trip = found;
  selectedId = id;
  selectedDate = trip.start;
  persistTrips();
  renderAll();
}

async function deleteTrip(id) {
  if (trips.length < 2) return notify('Debe quedar al menos un viaje.');
  const selected = trips.find(function (item) { return item.id === id; });
  if (!selected || !confirm('¿Borrar «' + selected.name + '» de este dispositivo' + (syncCredential() ? ' y de GitHub?' : '?'))) return;
  trips = trips.filter(function (item) { return item.id !== id; });
  if (trip.id === id) trip = trips[0];
  selectedId = trip.id;
  selectedDate = trip.start;
  persistTrips();
  renderAll();
  if (syncCredential()) {
    try {
      await githubRequest('DELETE', null, '?id=' + encodeURIComponent(id));
      notify('Viaje eliminado de este dispositivo y GitHub.');
    } catch (error) {
      notify('Se quitó del dispositivo, pero GitHub no confirmó el borrado: ' + error.message);
    }
  } else notify('Viaje eliminado de este dispositivo.');
}

function deleteEntity(kind, id) {
  const type = kind === 'flight' ? 'vuelo' : kind === 'transfer' ? 'traslado' : kind === 'hotel' ? 'hotel' : 'actividad';
  if (!confirm('¿Borrar este ' + type + '?')) return;
  if (kind === 'flight') trip.flights = trip.flights.filter(function (item) { return item.id !== id; });
  if (kind === 'transfer') trip.transfers = trip.transfers.filter(function (item) { return item.id !== id; });
  if (kind === 'hotel') {
    trip.hotels = trip.hotels.filter(function (item) { return item.id !== id; });
    syncLegacyHotel();
  }
  if (kind === 'event') trip.events = trip.events.filter(function (item) { return item.id !== id; });
  saveTrip();
  notify(type.charAt(0).toUpperCase() + type.slice(1) + ' eliminado.');
}

function syncCredential() {
  return localStorage.getItem(SYNC_KEY) || '';
}

function setSavedStatus(message, id) {
  if (!id || trip.id === id) document.getElementById('savedStatus').innerHTML = '<i></i> ' + escapeHtml(message);
}

function scheduleGitHubSave(id) {
  clearTimeout(syncTimers.get(id));
  if (!syncCredential()) {
    setSavedStatus('Guardado en este dispositivo · GitHub pendiente', id);
    return;
  }
  setSavedStatus('Guardado · sincronizando con GitHub…', id);
  syncTimers.set(id, setTimeout(function () {
    syncTimers.delete(id);
    syncTripToGitHub(id).catch(function () {});
  }, 850));
}

function syncStatus(message, isError) {
  const status = document.getElementById('syncStatus');
  status.textContent = message;
  status.classList.toggle('error', Boolean(isError));
}

async function githubRequest(method, body, query) {
  const input = document.getElementById('syncKey');
  const key = (input && input.value ? input.value : syncCredential()).trim();
  if (!key) throw new Error('Introduce la clave GITHUB_SYNC_KEY configurada en Vercel.');
  localStorage.setItem(SYNC_KEY, key);
  const response = await fetch('/api/trips' + (query || ''), {
    method: method || 'GET',
    headers: { 'Content-Type': 'application/json', 'X-Rumbo-Sync-Key': key },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok) throw new Error(data.error || 'No se pudo conectar con GitHub (' + response.status + ').');
  return data;
}

function allAttachmentOwners(source) {
  return (source.hotels || []).concat(source.flights || [], source.transfers || [], source.events || []).filter(Boolean);
}

async function syncTripToGitHub(id) {
  if (syncBusy.has(id)) {
    syncQueued.add(id);
    return;
  }
  const source = trips.find(function (item) { return item.id === id; });
  if (!source) return;
  syncBusy.add(id);
  try {
    const snapshot = clone(source);
    const owners = allAttachmentOwners(snapshot);
    for (const owner of owners) {
      for (const attachment of owner.attachments || []) {
        if (!attachment.data) {
          if (attachment.id) attachment.remote = true;
          continue;
        }
        await githubRequest('POST', { attachment: {
          tripId: snapshot.id,
          id: attachment.id,
          name: attachment.name,
          type: attachment.type,
          data: attachment.data
        } });
        const original = allAttachmentOwners(source).flatMap(function (item) { return item.attachments || []; }).find(function (item) { return item.id === attachment.id; });
        if (original) {
          delete original.data;
          original.remote = true;
        }
        delete attachment.data;
        attachment.remote = true;
      }
    }
    persistTrips();
    await githubRequest('PUT', { trip: snapshot });
    setSavedStatus('Guardado en GitHub', id);
    syncStatus('«' + snapshot.name + '» se ha guardado en GitHub.');
  } catch (error) {
    setSavedStatus('Guardado en este dispositivo · GitHub pendiente', id);
    syncStatus(error.message, true);
    throw error;
  } finally {
    syncBusy.delete(id);
    if (syncQueued.has(id)) {
      syncQueued.delete(id);
      setTimeout(function () { syncTripToGitHub(id).catch(function () {}); }, 80);
    }
  }
}

async function loadGithubTrips() {
  syncStatus('Buscando viajes en GitHub…');
  try {
    const data = await githubRequest('GET');
    const remote = Array.isArray(data.trips) ? data.trips : [];
    const container = document.getElementById('remoteTrips');
    container.innerHTML = remote.length ? remote.map(function (item) {
      return '<div class="remote-trip"><div><strong>' + escapeHtml(item.name || 'Viaje sin nombre') + '</strong><span>' + escapeHtml(item.location || '') + ' · ' + escapeHtml(item.start || '') + ' — ' + escapeHtml(item.end || '') + '</span></div><button class="button button-soft" data-load-trip="' + escapeHtml(item.id) + '">Cargar</button></div>';
    }).join('') : '<span class="field-hint">Aún no hay viajes guardados en GitHub.</span>';
    container.querySelectorAll('[data-load-trip]').forEach(function (button) {
      button.onclick = function () {
        const item = remote.find(function (candidate) { return candidate.id === button.dataset.loadTrip; });
        if (!item) return;
        const existing = trips.findIndex(function (local) { return local.id === item.id; });
        if (existing >= 0 && !confirm('Este viaje ya existe en el dispositivo. ¿Quieres reemplazar la copia local por la versión de GitHub?')) return;
        const normalized = normalizeTrip(item);
        if (existing >= 0) trips[existing] = normalized;
        else trips.unshift(normalized);
        trip = normalized;
        selectedId = normalized.id;
        selectedDate = normalized.start;
        persistTrips();
        renderAll();
        syncStatus('«' + normalized.name + '» se ha cargado en este dispositivo.');
      };
    });
    syncStatus(remote.length + (remote.length === 1 ? ' viaje encontrado' : ' viajes encontrados') + ' en GitHub.');
  } catch (error) {
    syncStatus(error.message, true);
  }
}

async function saveGithubTrips(items) {
  if (!syncCredential() && !document.getElementById('syncKey').value.trim()) return syncStatus('Introduce la clave GITHUB_SYNC_KEY configurada en Vercel.', true);
  syncStatus('Guardando ' + items.length + (items.length === 1 ? ' viaje…' : ' viajes…'));
  try {
    for (const item of items) {
      clearTimeout(syncTimers.get(item.id));
      syncTimers.delete(item.id);
      await syncTripToGitHub(item.id);
    }
    syncStatus(items.length + (items.length === 1 ? ' viaje guardado' : ' viajes guardados') + ' en GitHub.');
    notify('Viajes sincronizados con GitHub.');
  } catch (error) {
    syncStatus(error.message, true);
  }
}

function openSyncDialog() {
  document.getElementById('syncKey').value = syncCredential();
  document.getElementById('githubDialog').showModal();
  document.getElementById('remoteTrips').innerHTML = '';
  syncStatus('');
}

function saveAllFromHeader() {
  if (!syncCredential()) {
    openSyncDialog();
    syncStatus('Introduce la clave y pulsa «Guardar todos» para guardar tus viajes en GitHub.');
    document.getElementById('syncKey').focus({ preventScroll: true });
    return;
  }
  saveGithubTrips(trips);
}

function setEditorBackdropClose(dialog) {
  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) dialog.close();
  });
}

function getAttachmentOwner(scope, ownerId) {
  if (scope === 'hotel') return trip.hotels.find(function (hotel) { return hotel.id === ownerId; });
  if (scope === 'flight') return trip.flights.find(function (flight) { return flight.id === ownerId; });
  if (scope === 'transfer') return trip.transfers.find(function (transfer) { return transfer.id === ownerId; });
  return trip.events.find(function (event) { return event.id === ownerId; });
}

function totalAttachmentBytes() {
  return allAttachmentOwners(trip).reduce(function (total, owner) {
    return total + (owner.attachments || []).reduce(function (sum, attachment) { return sum + Number(attachment.size || 0); }, 0);
  }, 0);
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 32768) binary += String.fromCharCode.apply(null, bytes.subarray(index, index + 32768));
  return btoa(binary);
}

function base64Blob(value, type) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: type || 'application/octet-stream' });
}

async function addAttachments(input) {
  const owner = getAttachmentOwner(input.dataset.attachmentInput, input.dataset.ownerId);
  if (!owner) return;
  let added = 0;
  for (const file of Array.from(input.files || [])) {
    if (file.size > MAX_FILE_BYTES || totalAttachmentBytes() + file.size > MAX_TRIP_ATTACHMENT_BYTES) {
      notify('Cada archivo admite hasta 1 MB y el total por viaje, 1,5 MB.');
      continue;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    owner.attachments = owner.attachments || [];
    owner.attachments.push({
      id: makeId(),
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      data: bytesToBase64(bytes)
    });
    added += 1;
    saveTrip();
  }
  input.value = '';
  if (added) notify(added + (added === 1 ? ' adjunto añadido.' : ' adjuntos añadidos.') + ' Se sincronizarán con el viaje.');
}

async function downloadAttachment(scope, ownerId, attachmentId) {
  const owner = getAttachmentOwner(scope, ownerId);
  const attachment = owner && (owner.attachments || []).find(function (item) { return item.id === attachmentId; });
  if (!attachment) return;
  try {
    let data = attachment.data;
    if (!data) {
      const key = syncCredential();
      if (!key) throw new Error('Configura la clave de sincronización para descargar este archivo.');
      const response = await fetch('/api/trips?tripId=' + encodeURIComponent(trip.id) + '&attachmentId=' + encodeURIComponent(attachmentId), { headers: { 'X-Rumbo-Sync-Key': key } });
      const result = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(result.error || 'No se pudo descargar el adjunto.');
      data = result.data;
    }
    const blob = base64Blob(data, attachment.type);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = attachment.name;
    link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  } catch (error) {
    notify(error.message);
  }
}

async function removeAttachment(scope, ownerId, attachmentId) {
  const owner = getAttachmentOwner(scope, ownerId);
  if (!owner) return;
  const attachment = (owner.attachments || []).find(function (item) { return item.id === attachmentId; });
  if (!attachment) return;
  if (attachment.remote) {
    try {
      await githubRequest('DELETE', null, '?tripId=' + encodeURIComponent(trip.id) + '&attachmentId=' + encodeURIComponent(attachmentId));
    } catch (error) {
      notify('No se pudo quitar el adjunto de GitHub: ' + error.message);
      return;
    }
  }
  owner.attachments = owner.attachments.filter(function (item) { return item.id !== attachmentId; });
  saveTrip();
}

function notify(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 3200);
}

function exportTrip() {
  const blob = new Blob([JSON.stringify(trip, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'rumbo-' + (trip.name || 'viaje').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.json';
  link.click();
  setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
}

document.addEventListener('click', function (event) {
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) return setView(viewButton.dataset.view);
  const goView = event.target.closest('[data-go-view]');
  if (goView) return setView(goView.dataset.goView);
  const selectDay = event.target.closest('[data-day]');
  if (selectDay) return setSelectedDate(selectDay.dataset.day);
  const selectTripButton = event.target.closest('[data-select-trip]');
  if (selectTripButton) return selectTrip(selectTripButton.dataset.selectTrip);
  const deleteTripButton = event.target.closest('[data-delete-trip]');
  if (deleteTripButton) return deleteTrip(deleteTripButton.dataset.deleteTrip);
  const addButton = event.target.closest('[data-open-add]');
  if (addButton) return openEditor(addButton.dataset.openAdd);
  const editButton = event.target.closest('[data-edit-kind]');
  if (editButton) return openEditor(editButton.dataset.editKind, editButton.dataset.editId);
  const deleteButton = event.target.closest('[data-delete-kind]');
  if (deleteButton) return deleteEntity(deleteButton.dataset.deleteKind, deleteButton.dataset.deleteId);
  const closeEditor = event.target.closest('[data-close-editor]');
  if (closeEditor) return editor.close();
});

document.getElementById('editorForm').addEventListener('submit', function (event) {
  event.preventDefault();
  saveEditor(event.currentTarget);
});
document.getElementById('addTripMini').addEventListener('click', function () { openEditor('newTrip'); });
document.getElementById('editTripBtn').addEventListener('click', function () { openEditor('trip'); });
document.getElementById('editUsefulHours').addEventListener('click', function () { openEditor('hours'); });
document.getElementById('addPrimaryBtn').addEventListener('click', function () {
  const kind = currentView === 'flights' ? 'flight' : currentView === 'transfers' ? 'transfer' : currentView === 'hotels' ? 'hotel' : 'event';
  openEditor(kind);
});
document.getElementById('previousDay').addEventListener('click', function () {
  const index = Math.max(0, dayDifference(trip.start, selectedDate) - 1);
  setSelectedDate(addDays(trip.start, index));
});
document.getElementById('nextDay').addEventListener('click', function () {
  const index = Math.min(tripDays().length - 1, dayDifference(trip.start, selectedDate) + 1);
  setSelectedDate(addDays(trip.start, index));
});
document.getElementById('exportBtn').addEventListener('click', exportTrip);
document.getElementById('saveAllBtn').addEventListener('click', saveAllFromHeader);
document.getElementById('githubSettingsBtn').addEventListener('click', openSyncDialog);
document.getElementById('closeGithub').addEventListener('click', function () { document.getElementById('githubDialog').close(); });
document.getElementById('loadGithubTrips').addEventListener('click', loadGithubTrips);
document.getElementById('saveGithubTrip').addEventListener('click', function () { saveGithubTrips([trip]); });
document.getElementById('saveAllGithubTrips').addEventListener('click', function () { saveGithubTrips(trips); });
document.getElementById('syncKey').addEventListener('change', function (event) { localStorage.setItem(SYNC_KEY, event.target.value.trim()); });
document.addEventListener('change', function (event) {
  if (event.target.matches('[data-attachment-input]')) addAttachments(event.target);
});
document.getElementById('editorForm').addEventListener('input', function (event) {
  if (editor.dataset.kind !== 'flight') return;
  if (event.target.name === 'fromTimezone') editor.dataset.fromTzEdited = 'true';
  if (event.target.name === 'toTimezone') editor.dataset.toTzEdited = 'true';
  if (event.target.name === 'from' && editor.dataset.fromTzEdited !== 'true') document.getElementById('f_fromTimezone').value = airportTimeZone(event.target.value, tripZone());
  if (event.target.name === 'to' && editor.dataset.toTzEdited !== 'true') document.getElementById('f_toTimezone').value = airportTimeZone(event.target.value, tripZone());
});
setEditorBackdropClose(editor);
setEditorBackdropClose(document.getElementById('githubDialog'));
renderAll();
