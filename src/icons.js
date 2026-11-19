// Record icons on the ui.jsx grid (24px, 1.5px round strokes), kept as data so check-icons.mjs can verify them.
// Shapes: ['p', d], ['c', cx, cy, r], ['r', x, y, w, h, rx], ['dot', cx, cy, r <= 1.2]. Keys are stored, never shown.

export const ICON_GROUPS = [
  { key: 'food', id: 'Makanan & minuman', en: 'Food & drink' },
  { key: 'shopping', id: 'Belanja', en: 'Shopping' },
  { key: 'transport', id: 'Transportasi', en: 'Transport' },
  { key: 'home', id: 'Rumah & tagihan', en: 'Home & bills' },
  { key: 'health', id: 'Kesehatan & perawatan', en: 'Health & care' },
  { key: 'work', id: 'Pendidikan & kerja', en: 'Education & work' },
  { key: 'people', id: 'Keluarga & orang', en: 'Family & people' },
  { key: 'nature', id: 'Hewan & alam', en: 'Pets & nature' },
  { key: 'leisure', id: 'Jalan-jalan & hiburan', en: 'Travel & leisure' },
  { key: 'finance', id: 'Keuangan & dompet', en: 'Finance & wallets' },
  { key: 'social', id: 'Hadiah & sosial', en: 'Gifts & social' },
  { key: 'other', id: 'Lainnya', en: 'Other' },
];

const HAND = ['p', 'M3 15h3l4 2h4a1.5 1.5 0 0 0 0-3h-3M14 14.5l4.5-2a1.5 1.5 0 0 1 1.5 2.5L14 19H3'];
const HEART = 'M12 20s-8-4.5-8-10a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.5-8 10-8 10Z';

export const ICON_LIST = [
  // food & drink
  { key: 'food', group: 'food', id: 'Makanan', en: 'Food', d: [['p', 'M4 11h16a8 8 0 0 1-16 0Z'], ['p', 'M9 4.5c-1 1.2 1 2.3 0 3.5M15 4.5c-1 1.2 1 2.3 0 3.5']] },
  { key: 'burger', group: 'food', id: 'Burger', en: 'Burger', d: [['p', 'M4 10a8 5 0 0 1 16 0Z'], ['p', 'M3.5 13.5h17'], ['p', 'M4 17h16v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z']] },
  { key: 'coffee', group: 'food', id: 'Kopi', en: 'Coffee', d: [['p', 'M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z'], ['p', 'M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16'], ['p', 'M8 3.5V6M12 3.5V6']] },
  { key: 'drink', group: 'food', id: 'Minuman', en: 'Drink', d: [['p', 'M6 6h12l-1.5 14a1 1 0 0 1-1 .9h-7a1 1 0 0 1-1-.9Z'], ['p', 'M13 6l2-3.5'], ['p', 'M6.5 10.5h11']] },
  { key: 'cake', group: 'food', id: 'Kue', en: 'Cake', d: [['r', 4, 12, 16, 8, 2], ['p', 'M4 16c2.7 1.3 5.3-1.3 8 0s5.3 1.3 8 0'], ['p', 'M9 12V9M15 12V9'], ['dot', 9, 6.5, 1.1], ['dot', 15, 6.5, 1.1]] },
  { key: 'dining', group: 'food', id: 'Makan di luar', en: 'Eating out', d: [['p', 'M6 3v5a2 2 0 0 0 4 0V3M8 3v18'], ['p', 'M18 21V3c-2 1.5-3 4-3 7v3h3']] },
  { key: 'fruit', group: 'food', id: 'Buah & sayur', en: 'Fruit & veg', d: [['p', 'M12 7.5c-3-2-7-1-7 3.5 0 4 3 9 5 9 1 0 1.3-.6 2-.6s1 .6 2 .6c2 0 5-5 5-9 0-4.5-4-5.5-7-3.5Z'], ['p', 'M12 7.5c0-2 1-3.5 3-4.5']] },

  // shopping
  { key: 'cart', group: 'shopping', id: 'Belanja harian', en: 'Groceries', d: [['p', 'M3 4h2.5l2.3 11h10.4l2-8H6.6'], ['c', 9.5, 19, 1.5], ['c', 17, 19, 1.5]] },
  { key: 'bag', group: 'shopping', id: 'Tas belanja', en: 'Shopping bag', d: [['p', 'M5 8h14l-1 12H6Z'], ['p', 'M9 8V6.5a3 3 0 0 1 6 0V8']] },
  { key: 'store', group: 'shopping', id: 'Toko', en: 'Store', d: [['p', 'M5 4h14l1.5 6h-17Z'], ['p', 'M5 10v10h14V10'], ['p', 'M10 20v-5h4v5']] },
  { key: 'shirt', group: 'shopping', id: 'Pakaian', en: 'Clothes', d: [['p', 'M9 4 4 6.5 5.5 11 7.5 10v10h9V10l2 1L20 6.5 15 4a3 3 0 0 1-6 0Z']] },
  { key: 'shoe', group: 'shopping', id: 'Sepatu', en: 'Shoes', d: [['p', 'M3 18h18v-1.5a2.5 2.5 0 0 0-2-2.4l-5-1.1-3.5-4H4a1 1 0 0 0-1 1Z'], ['p', 'M9.5 12 8 13.5M11.5 14 10 15.5']] },
  { key: 'lipstick', group: 'shopping', id: 'Kecantikan', en: 'Beauty', d: [['r', 8, 13, 8, 8, 1], ['p', 'M9.5 13V7.5L14.5 4v9']] },
  { key: 'toiletries', group: 'shopping', id: 'Kebutuhan harian', en: 'Daily needs', d: [['p', 'M8 9h8v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1Z'], ['p', 'M10 9V6h4v3'], ['p', 'M12 6V3.5h3']] },

  // transport
  { key: 'bus', group: 'transport', id: 'Bus', en: 'Bus', d: [['r', 5, 3, 14, 15, 2.5], ['p', 'M5 10h14'], ['p', 'M8 18v2.5M16 18v2.5'], ['dot', 8.5, 14.5, 1.1], ['dot', 15.5, 14.5, 1.1]] },
  { key: 'car', group: 'transport', id: 'Mobil', en: 'Car', d: [['p', 'M4 16v-3l2-5h12l2 5v3Z'], ['p', 'M4 13h16'], ['c', 7.5, 17.5, 1.5], ['c', 16.5, 17.5, 1.5]] },
  { key: 'motorbike', group: 'transport', id: 'Motor & ojek', en: 'Motorbike', d: [['c', 6, 17.5, 2.5], ['c', 18, 17.5, 2.5], ['p', 'M3.5 14.5A3.5 3.5 0 0 1 7 11h4.5l1.5 6.5H8.5'], ['p', 'M13 17.5h2.5L18 9.5M16 6.5h3.5']] },
  { key: 'fuel', group: 'transport', id: 'Bensin', en: 'Fuel', d: [['p', 'M5 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16M4 21h11M5 10h9'], ['p', 'M14 8h2l2 2v7a1.5 1.5 0 0 0 3 0V9l-2-2']] },
  { key: 'train', group: 'transport', id: 'Kereta', en: 'Train', d: [['r', 6, 3, 12, 14, 3], ['p', 'M6 10h12'], ['dot', 9, 13.5, 1.1], ['dot', 15, 13.5, 1.1], ['p', 'M8 21l2-4M16 21l-2-4']] },
  { key: 'bicycle', group: 'transport', id: 'Sepeda', en: 'Bicycle', d: [['c', 6, 16, 3.5], ['c', 18, 16, 3.5], ['p', 'M6 16 9 9h6l3 7M12 16 9 9M14 6.5h2.5']] },
  { key: 'parking', group: 'transport', id: 'Parkir', en: 'Parking', d: [['r', 4, 4, 16, 16, 3], ['p', 'M10 17V8h3a2.5 2.5 0 0 1 0 5h-3']] },

  // home & bills
  { key: 'house', group: 'home', id: 'Rumah', en: 'Housing', d: [['p', 'M4 11l8-7 8 7M6 9.5V20h12V9.5M10 20v-6h4v6']] },
  { key: 'electricity', group: 'home', id: 'Listrik', en: 'Electricity', d: [['p', 'M13 3 5 13h6l-1 8 8-10h-6Z']] },
  { key: 'water', group: 'home', id: 'Air', en: 'Water', d: [['p', 'M12 3.5s6 6 6 10.5a6 6 0 0 1-12 0c0-4.5 6-10.5 6-10.5Z'], ['p', 'M9 14a3 3 0 0 0 3 3']] },
  { key: 'wifi', group: 'home', id: 'Internet', en: 'Internet', d: [['p', 'M4 9.5a12 12 0 0 1 16 0M7 13a7.5 7.5 0 0 1 10 0M10 16.5a3 3 0 0 1 4 0'], ['dot', 12, 19.5, 1.1]] },
  { key: 'phone', group: 'home', id: 'Pulsa & HP', en: 'Phone', d: [['r', 7, 3, 10, 18, 2], ['p', 'M11 17.5h2']] },
  { key: 'tools', group: 'home', id: 'Perbaikan', en: 'Repairs', d: [['p', 'M14.5 4a4.5 4.5 0 0 0-4.2 6.1L4 16.4V20h3.6l6.3-6.3A4.5 4.5 0 0 0 20 9.5l-2.8 2.8-3-3L17 6.5A4.5 4.5 0 0 0 14.5 4Z']] },
  { key: 'key', group: 'home', id: 'Sewa', en: 'Rent', d: [['c', 8, 15, 4], ['p', 'M11 12l8-8M16 7l2 2M14 9l2 2']] },
  { key: 'sofa', group: 'home', id: 'Perabot', en: 'Furniture', d: [['p', 'M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3'], ['p', 'M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3Z'], ['p', 'M5 18v2M19 18v2']] },
  { key: 'gas', group: 'home', id: 'Gas', en: 'Gas', d: [['p', 'M8 7h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z'], ['p', 'M10 7V4h4v3'], ['p', 'M6 12h12']] },

  // health & care
  { key: 'pill', group: 'health', id: 'Obat', en: 'Medicine', d: [['p', 'M10.5 4.5a4.95 4.95 0 0 1 7 7l-6 6a4.95 4.95 0 0 1-7-7Z'], ['p', 'M7.5 7.5l7 7']] },
  { key: 'hospital', group: 'health', id: 'Rumah sakit', en: 'Hospital', d: [['r', 4, 4, 16, 16, 3], ['p', 'M12 8v8M8 12h8']] },
  { key: 'pulse', group: 'health', id: 'Kesehatan', en: 'Health', d: [['p', HEART], ['p', 'M6 12h3l1.5-2.5 2 5L14 12h4']] },
  { key: 'tooth', group: 'health', id: 'Gigi', en: 'Dental', d: [['p', 'M8 4c-2.5 0-4 2-4 4.5 0 2 1 3.5 1.5 5.5.5 2.5.8 6 2.5 6 1.5 0 1.5-4.5 4-4.5s2.5 4.5 4 4.5c1.7 0 2-3.5 2.5-6 .5-2 1.5-3.5 1.5-5.5C20 6 18.5 4 16 4c-1.5 0-2.5 1-4 1S9.5 4 8 4Z']] },
  { key: 'glasses', group: 'health', id: 'Kacamata', en: 'Glasses', d: [['c', 7, 14, 3.5], ['c', 17, 14, 3.5], ['p', 'M10.5 14h3M3.5 13 5 8M20.5 13 19 8']] },
  { key: 'dumbbell', group: 'health', id: 'Olahraga', en: 'Fitness', d: [['p', 'M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12']] },
  { key: 'scissors', group: 'health', id: 'Potong rambut', en: 'Haircut', d: [['c', 6.5, 17, 2.5], ['c', 17.5, 17, 2.5], ['p', 'M8.5 15.5 18 4M15.5 15.5 6 4']] },

  // education & work
  { key: 'book', group: 'work', id: 'Buku', en: 'Books', d: [['p', 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5Z'], ['p', 'M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3']] },
  { key: 'graduation', group: 'work', id: 'Pendidikan', en: 'Education', d: [['p', 'M2.5 9.5 12 5l9.5 4.5L12 14Z'], ['p', 'M6.5 11.5V16c1.5 1.5 3.5 2 5.5 2s4-.5 5.5-2v-4.5'], ['p', 'M21.5 9.5V14']] },
  { key: 'pencil', group: 'work', id: 'Alat tulis', en: 'Stationery', d: [['p', 'M15 4.5 19.5 9 9 19.5H4.5V15Z'], ['p', 'M13 6.5l4.5 4.5']] },
  { key: 'briefcase', group: 'work', id: 'Kerja', en: 'Work', d: [['r', 3, 7, 18, 13, 2], ['p', 'M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7'], ['p', 'M3 12.5h18']] },
  { key: 'laptop', group: 'work', id: 'Laptop', en: 'Laptop', d: [['r', 5, 5, 14, 10, 1.5], ['p', 'M3 18.5h18']] },
  { key: 'moneybag', group: 'work', id: 'Gaji', en: 'Salary', d: [['p', 'M10 6.5 8.5 3.5h7L14 6.5'], ['p', 'M10 6.5C6 9 4.5 12.5 4.5 15.5 4.5 19 7 21 12 21s7.5-2 7.5-5.5c0-3-1.5-6.5-5.5-9Z'], ['c', 12, 15, 2.5]] },
  { key: 'medal', group: 'work', id: 'Bonus', en: 'Bonus', d: [['c', 12, 15.5, 5], ['p', 'M9 11 6.5 3h3.5l2 5 2-5h3.5L15 11'], ['p', 'M12 13.5v4']] },
  { key: 'calculator', group: 'work', id: 'Kalkulator', en: 'Calculator', d: [['r', 5, 3, 14, 18, 2], ['p', 'M8 7h8'], ['dot', 9, 12, 1], ['dot', 12, 12, 1], ['dot', 15, 12, 1], ['dot', 9, 16, 1], ['dot', 12, 16, 1], ['dot', 15, 16, 1]] },

  // family & people
  { key: 'person', group: 'people', id: 'Diri sendiri', en: 'Myself', d: [['c', 12, 8, 3.5], ['p', 'M5 20a7 7 0 0 1 14 0']] },
  { key: 'people', group: 'people', id: 'Berdua', en: 'Two people', d: [['c', 9, 8, 3], ['c', 16.5, 9, 2.5], ['p', 'M3 20a6 6 0 0 1 12 0M15 14.5a5 5 0 0 1 6 5.5']] },
  { key: 'child', group: 'people', id: 'Anak', en: 'Child', d: [['c', 12, 9, 4.5], ['p', 'M8 20.5a4 4 0 0 1 8 0'], ['p', 'M11 4.5c0-1 .6-1.5 1.5-1.5']] },
  { key: 'elder', group: 'people', id: 'Orang tua', en: 'Parent', d: [['c', 10, 7, 3], ['p', 'M4 21a6 6 0 0 1 11-3.3'], ['p', 'M18 21v-8a1.5 1.5 0 0 1 3 0']] },
  { key: 'bottle', group: 'people', id: 'Bayi', en: 'Baby', d: [['p', 'M9 9h6v10a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2Z'], ['p', 'M10.5 9V7c0-2 .5-4 1.5-4s1.5 2 1.5 4v2'], ['p', 'M9 13h2.5M9 16h2.5']] },

  // pets & nature
  { key: 'cat', group: 'nature', id: 'Kucing', en: 'Cat', d: [['p', 'M5 11V4l4 3h6l4-3v7a7 7 0 0 1-14 0Z'], ['dot', 9.5, 12, 1], ['dot', 14.5, 12, 1], ['p', 'M11 15h2']] },
  { key: 'dog', group: 'nature', id: 'Anjing', en: 'Dog', d: [['p', 'M7 10a5 5 0 0 1 10 0v5a5 5 0 0 1-10 0Z'], ['p', 'M7 9 3.5 7.5V13L7 14M17 9l3.5-1.5V13L17 14'], ['dot', 10, 12, 1], ['dot', 14, 12, 1], ['p', 'M11 16.5h2']] },
  { key: 'paw', group: 'nature', id: 'Hewan peliharaan', en: 'Pets', d: [['c', 6.5, 10.5, 1.8], ['c', 10, 6.5, 1.8], ['c', 14, 6.5, 1.8], ['c', 17.5, 10.5, 1.8], ['p', 'M12 12c-3 0-5 3.5-5 5.5 0 1.5 1 2.5 2.5 2.5s1.5-.8 2.5-.8 1 .8 2.5.8 2.5-1 2.5-2.5c0-2-2-5.5-5-5.5Z']] },
  { key: 'plant', group: 'nature', id: 'Tanaman', en: 'Plants', d: [['p', 'M12 21v-9'], ['p', 'M12 12c0-4 3-7 8-7 0 5-3 7-8 7Z'], ['p', 'M12 14c0-3-2-5-6-5 0 3.5 2 5 6 5Z']] },
  { key: 'tree', group: 'nature', id: 'Pohon', en: 'Tree', d: [['p', 'M12 21v-5'], ['p', 'M12 3 6 11h3l-4 5h14l-4-5h3Z']] },
  { key: 'flower', group: 'nature', id: 'Bunga', en: 'Flowers', d: [['c', 12, 9, 1.8], ['c', 12, 5, 2.2], ['c', 16, 9, 2.2], ['c', 12, 13, 2.2], ['c', 8, 9, 2.2], ['p', 'M12 15.5V21M12 18.5c1.5-1.5 3-2 4.5-1.5']] },
  { key: 'sun', group: 'nature', id: 'Cuaca', en: 'Weather', d: [['c', 12, 12, 4], ['p', 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4']] },

  // travel & leisure
  { key: 'plane', group: 'leisure', id: 'Pesawat', en: 'Flights', d: [['p', 'M12 3c1 0 1.5 1 1.5 2.5V10l7 4v2l-7-2v4l2 1.5V21l-3.5-1-3.5 1v-1.5l2-1.5v-4l-7 2v-2l7-4V5.5C10.5 4 11 3 12 3Z']] },
  { key: 'luggage', group: 'leisure', id: 'Koper', en: 'Luggage', d: [['r', 6, 7, 12, 13, 2], ['p', 'M9.5 7V4.5h5V7'], ['p', 'M10 11v5M14 11v5']] },
  { key: 'beach', group: 'leisure', id: 'Liburan', en: 'Holiday', d: [['p', 'M3.5 11a8.5 7 0 0 1 17 0Z'], ['p', 'M12 4v7M12 11l-2.5 9.5'], ['p', 'M4 20.5h16']] },
  { key: 'game', group: 'leisure', id: 'Game', en: 'Games', d: [['p', 'M7 8h10a4 4 0 0 1 4 4v2a3 3 0 0 1-5.4 1.8L14.5 14h-5l-1.1 1.8A3 3 0 0 1 3 14v-2a4 4 0 0 1 4-4Z'], ['p', 'M7.5 10.5v3M6 12h3'], ['dot', 15.5, 11, 1], ['dot', 17.5, 13, 1]] },
  { key: 'ticket', group: 'leisure', id: 'Tiket', en: 'Tickets', d: [['p', 'M3 8a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2.5a1.5 1.5 0 0 0 0 3V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2.5a1.5 1.5 0 0 0 0-3Z'], ['p', 'M14 8v1.5M14 11.25v1.5M14 14.5V16']] },
  { key: 'film', group: 'leisure', id: 'Film', en: 'Movies', d: [['r', 4, 4, 16, 16, 2], ['p', 'M8 4v16M16 4v16M4 9h4M4 15h4M16 9h4M16 15h4']] },
  { key: 'music', group: 'leisure', id: 'Musik', en: 'Music', d: [['p', 'M9 18V6l11-2v12'], ['c', 6.5, 18, 2.5], ['c', 17.5, 16, 2.5]] },
  { key: 'ball', group: 'leisure', id: 'Olahraga & hobi', en: 'Sports', d: [['c', 12, 12, 9], ['p', 'M5 6.5c2.5 1 4 3.5 4 5.5s-1.5 4.5-4 5.5M19 6.5c-2.5 1-4 3.5-4 5.5s1.5 4.5 4 5.5']] },
  { key: 'bed', group: 'leisure', id: 'Penginapan', en: 'Lodging', d: [['p', 'M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6'], ['c', 7, 11.5, 2]] },
  { key: 'mountain', group: 'leisure', id: 'Alam & wisata', en: 'Outdoors', d: [['p', 'M3 19 9 9l4 6 2.5-3.5L21 19Z'], ['c', 17, 6, 1.8]] },

  // finance & wallets
  { key: 'cash', group: 'finance', id: 'Tunai', en: 'Cash', d: [['r', 3, 6, 18, 12, 2], ['c', 12, 12, 2.5], ['dot', 6.5, 12, 1], ['dot', 17.5, 12, 1]] },
  { key: 'card', group: 'finance', id: 'Kartu', en: 'Card', d: [['r', 3, 5, 18, 14, 2], ['p', 'M3 10h18M7 15h4']] },
  { key: 'purse', group: 'finance', id: 'Dompet', en: 'Wallet', d: [['p', 'M3 7.5A2.5 2.5 0 0 1 5.5 5H18v3'], ['p', 'M3 7.5V17a2.5 2.5 0 0 0 2.5 2.5H21V8H5.5A2.5 2.5 0 0 1 3 7.5Z'], ['dot', 16.5, 13.75, 0.9]] },
  { key: 'ewallet', group: 'finance', id: 'Dompet digital', en: 'E-wallet', d: [['r', 4, 3, 10, 18, 2], ['p', 'M8 17.5h2'], ['c', 18, 13, 3]] },
  { key: 'bank', group: 'finance', id: 'Bank', en: 'Bank', d: [['p', 'M3 9.5 12 4l9 5.5Z'], ['p', 'M5 10v8M9.5 10v8M14.5 10v8M19 10v8'], ['p', 'M3 20.5h18']] },
  { key: 'piggy', group: 'finance', id: 'Tabungan', en: 'Savings', d: [['p', 'M4 12c0-3.9 3.6-6.5 8-6.5 2.4 0 4.5.8 5.9 2.1L20 6.5v3.4c.6.6 1 1.4 1.2 2.1h.8v3h-1.3c-.6 1.2-1.6 2.2-2.7 2.8V20h-3v-1.6a10 10 0 0 1-4 0V20H8v-2.2C5.6 16.5 4 14.4 4 12Z'], ['dot', 16, 10.5, 1], ['p', 'M10 8h3']] },
  { key: 'coins', group: 'finance', id: 'Koin', en: 'Coins', d: [['c', 12, 12, 8.5], ['c', 12, 12, 5]] },
  { key: 'chartUp', group: 'finance', id: 'Investasi', en: 'Investment', d: [['p', 'M4 20h16'], ['p', 'M6 16l4-4 3 3 5-6'], ['p', 'M14 9h4v4']] },
  { key: 'invoice', group: 'finance', id: 'Tagihan', en: 'Bills', d: [['p', 'M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5Z'], ['p', 'M9 8h6M9 12h6M9 16h3']] },
  { key: 'tax', group: 'finance', id: 'Pajak', en: 'Tax', d: [['p', 'M6 3h9l4 4v14H6Z'], ['p', 'M15 3v4h4'], ['p', 'M9.5 17l5-6'], ['dot', 10, 11.5, 1], ['dot', 14, 16.5, 1]] },
  { key: 'safe', group: 'finance', id: 'Brankas', en: 'Safe', d: [['r', 3, 4, 18, 15, 2], ['c', 12, 11.5, 3.5], ['p', 'M12 8v1M6 19v2M18 19v2']] },
  { key: 'gold', group: 'finance', id: 'Emas', en: 'Gold', d: [['p', 'M3 20l2-5h6l2 5ZM11 20l2-5h6l2 5ZM7 15l2-5h6l2 5Z']] },
  { key: 'handCoin', group: 'finance', id: 'Piutang', en: 'Money lent', d: [HAND, ['c', 14, 6.5, 3]] },

  // gifts & social
  { key: 'gift', group: 'social', id: 'Hadiah', en: 'Gifts', d: [['r', 3.5, 8, 17, 4, 1], ['p', 'M5 12v8h14v-8M12 8v12'], ['p', 'M12 8c-1.5-3-5-4-5-1.5S10 8 12 8Zm0 0c1.5-3 5-4 5-1.5S14 8 12 8Z']] },
  { key: 'cheers', group: 'social', id: 'Sosial', en: 'Social', d: [['p', 'M5 4h5l-.4 5.5a2.1 2.1 0 0 1-4.2 0Z'], ['p', 'M7.5 11.5V20M5.5 20h4'], ['p', 'M14 4h5l-.4 5.5a2.1 2.1 0 0 1-4.2 0Z'], ['p', 'M16.5 11.5V20M14.5 20h4']] },
  { key: 'heart', group: 'social', id: 'Pasangan', en: 'Partner', d: [['p', HEART]] },
  { key: 'charity', group: 'social', id: 'Donasi', en: 'Donations', d: [HAND, ['p', 'M14 11s-3.5-2-3.5-4.5a1.8 1.8 0 0 1 3.5-.8 1.8 1.8 0 0 1 3.5.8c0 2.5-3.5 4.5-3.5 4.5Z']] },
  { key: 'mosque', group: 'social', id: 'Ibadah', en: 'Worship', d: [['p', 'M7.5 13a4.5 4.5 0 0 1 9 0'], ['p', 'M5 13h14v7H5Z'], ['p', 'M10.5 20v-3a1.5 1.5 0 0 1 3 0v3'], ['p', 'M12 8.5v-3M2.5 20V10M21.5 20V10']] },
  { key: 'balloon', group: 'social', id: 'Perayaan', en: 'Celebration', d: [['p', 'M12 15c-3 0-5-3-5-6a5 5 0 0 1 10 0c0 3-2 6-5 6Z'], ['p', 'M12 15l-1 1.5h2Z'], ['p', 'M12 16.5c0 1.5-1.5 2-1.5 3.5']] },

  // other
  { key: 'notebook', group: 'other', id: 'Buku catatan', en: 'Ledger', d: [['r', 5, 3, 14, 18, 2], ['p', 'M9 3v18M12.5 8h3M12.5 12h3']] },
  { key: 'star', group: 'other', id: 'Favorit', en: 'Favourite', d: [['p', 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z']] },
  { key: 'box', group: 'other', id: 'Paket', en: 'Parcels', d: [['p', 'M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5Z'], ['p', 'M3.5 7.5 12 12l8.5-4.5M12 12v9']] },
  { key: 'clock', group: 'other', id: 'Langganan', en: 'Subscriptions', d: [['c', 12, 12, 9], ['p', 'M12 7v5l3 2']] },
  { key: 'shield', group: 'other', id: 'Asuransi', en: 'Insurance', d: [['p', 'M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6Z'], ['p', 'M9 12l2 2 4-4']] },
  { key: 'question', group: 'other', id: 'Tidak tahu', en: 'Unknown', d: [['c', 12, 12, 9], ['p', 'M9.5 9.5a2.5 2.5 0 0 1 4.8.9c0 1.6-2.3 2.1-2.3 3.6'], ['dot', 12, 17, 1]] },
  { key: 'dots', group: 'other', id: 'Lain-lain', en: 'Misc', d: [['r', 3, 6, 18, 12, 3], ['dot', 8, 12, 1.2], ['dot', 12, 12, 1.2], ['dot', 16, 12, 1.2]] },
];

// Drawn for an unknown key, an empty value or an emoji left over from older data.
export const FALLBACK_SHAPES = [['r', 4, 4, 16, 16, 4], ['dot', 12, 12, 1.2]];

// Bank and e-wallet logos for accounts: official SVGs in src/brands/<key>.svg, drawn on a white tile.
// Stored in the account's `icon` like any key; builds that lack them draw the fallback icon.
// `color` is the brand colour, given to the account when its logo is picked.
export const BRAND_GROUPS = [
  { key: 'bank', id: 'Bank', en: 'Banks' },
  { key: 'ewallet', id: 'E-wallet', en: 'E-wallets' },
];
const bank = (key, name, color) => ({ key: `bank-${key}`, group: 'bank', id: name, en: name, color });
const ew = (key, name, color) => ({ key: `ew-${key}`, group: 'ewallet', id: name, en: name, color });
export const BRAND_LIST = [
  bank('bca', 'BCA', '#0060af'), bank('mandiri', 'Mandiri', '#003a70'), bank('bri', 'BRI', '#00529c'),
  bank('bni', 'BNI', '#f15a22'), bank('bsi', 'BSI', '#00a39d'), bank('cimb', 'CIMB Niaga', '#790008'),
  bank('permata', 'Permata', '#0064ff'), bank('danamon', 'Danamon', '#f05a24'), bank('btn', 'BTN', '#015bfd'),
  bank('jago', 'Jago', '#feae27'), bank('seabank', 'SeaBank', '#ea5f00'),
  bank('jenius', 'Jenius', '#009bd2'), bank('neo', 'Neo Commerce', '#ffcd00'), bank('superbank', 'Superbank', '#afee00'),
  ew('gopay', 'GoPay', '#00aed6'), ew('ovo', 'OVO', '#4b2489'), ew('dana', 'DANA', '#008ceb'),
  ew('shopeepay', 'ShopeePay', '#ee4d2d'), ew('linkaja', 'LinkAja', '#e82529'),
];
export const BRAND_MAP = Object.fromEntries(BRAND_LIST.map((i) => [i.key, i]));
export const brandsByGroup = () => BRAND_GROUPS.map((g) => ({ ...g, icons: BRAND_LIST.filter((i) => i.group === g.key) }));

// Every known key, logos included, so store.js keeps a logo picked for a built-in account.
export const ICON_MAP = Object.fromEntries([...ICON_LIST, ...BRAND_LIST].map((i) => [i.key, i]));
export const iconShapes = (key) => ICON_MAP[key]?.d || FALLBACK_SHAPES;
export const iconName = (key, lang) => ICON_MAP[key]?.[lang === 'en' ? 'en' : 'id'] || '';
export const iconsByGroup = () => ICON_GROUPS.map((g) => ({ ...g, icons: ICON_LIST.filter((i) => i.group === g.key) }));

// Icon for each built-in record, applied to the starter data in bolt 002.
export const DEFAULT_ICONS = {
  categories: {
    'cat-food': 'food', 'cat-daily': 'toiletries', 'cat-traffic': 'bus', 'cat-social': 'cheers', 'cat-home': 'house',
    'cat-gift': 'gift', 'cat-phone': 'phone', 'cat-dress': 'shirt', 'cat-fun': 'game', 'cat-beauty': 'lipstick',
    'cat-medical': 'pill', 'cat-tax': 'tax', 'cat-edu': 'book', 'cat-baby': 'bottle', 'cat-pet': 'cat',
    'cat-travel': 'plane', 'cat-wage': 'moneybag', 'cat-bonus': 'medal', 'cat-invest': 'chartUp',
    'cat-parttime': 'briefcase', 'cat-other-in': 'coins',
  },
  walletTypes: {
    cash: 'cash', debit: 'card', credit: 'card', ewallet: 'ewallet', invest: 'chartUp',
    receivable: 'handCoin', payable: 'invoice', other: 'bank',
  },
  members: { 'mem-me': 'person', 'mem-partner': 'heart', 'mem-child': 'child', 'mem-parent': 'elder' },
  ledger: 'notebook',
};
