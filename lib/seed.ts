import type { DatabaseSchema } from './storage-adapter';

/**
 * Timestamp seed harus selalu berada di MASA LAMPUNG.
 *
 * Jika slot waktu (mis. "hari ini 09.42") jatuh di masa depan — yang bisa
 * terjadi bila seed dijalankan menjelang tengah malam — pesan baru yang
 * dikirim user akan terurut di atas pesan lama, sehingga `lastMessage` dan
 * urutan bubble di layar jadi salah. Karena itu setiap slot digeser mundur
 * satu hari bila hasilnya ternyata belum terjadi.
 */
function buildSeed(hashPassword: (plain: string) => string): DatabaseSchema {
  const now = Date.now();
  const DAY = 86400000;

  const at = (daysAgo: number, hours: number, minutes: number) => {
    const d = new Date(now - daysAgo * DAY);
    d.setHours(hours, minutes, 0, 0);
    if (d.getTime() > now) {
      d.setTime(d.getTime() - DAY);
    }
    return d.toISOString();
  };

  const users = [
    { id: 'user-andi', name: 'Andi Pratama', email: 'andi@contoh.id', initials: 'AP', avatarColor: '#18181B', isOnline: true, lastSeen: 'Online', createdAt: at(30, 8, 0) },
    { id: 'user-rina', name: 'Rina Kartika', email: 'rina@contoh.id', initials: 'RK', avatarColor: '#3F3F46', isOnline: true, lastSeen: 'Online', createdAt: at(25, 8, 0) },
    { id: 'user-dimas', name: 'Dimas Prasetyo', email: 'dimas@contoh.id', initials: 'DP', avatarColor: '#52525B', isOnline: false, lastSeen: '10 menit lalu', createdAt: at(20, 8, 0) },
    { id: 'user-sari', name: 'Sari Wulandari', email: 'sari@contoh.id', initials: 'SW', avatarColor: '#71717A', isOnline: false, lastSeen: '1 jam lalu', createdAt: at(15, 8, 0) },
    { id: 'user-bayu', name: 'Bayu Nugroho', email: 'bayu@contoh.id', initials: 'BN', avatarColor: '#27272A', isOnline: true, lastSeen: 'Online', createdAt: at(10, 8, 0) },
    { id: 'user-maya', name: 'Maya Handayani', email: 'maya@contoh.id', initials: 'MH', avatarColor: '#3F3F46', isOnline: true, lastSeen: 'Online', createdAt: at(8, 8, 0) },
    { id: 'user-yoga', name: 'Yoga Aditya', email: 'yoga@contoh.id', initials: 'YA', avatarColor: '#71717A', isOnline: false, lastSeen: 'Kemarin', createdAt: at(5, 8, 0) },
    { id: 'user-support', name: 'Tim Support', email: 'support@contoh.id', initials: 'TS', avatarColor: '#18181B', isOnline: true, lastSeen: 'Online', createdAt: at(40, 8, 0) },
  ].map((u) => ({ ...u, passwordHash: hashPassword('password123') }));

  const conversations = [
    { id: 'conv-andi-rina', participantIds: ['user-andi', 'user-rina'], createdAt: at(3, 9, 0), updatedAt: at(0, 9, 42) },
    { id: 'conv-andi-dimas', participantIds: ['user-andi', 'user-dimas'], createdAt: at(3, 8, 0), updatedAt: at(0, 9, 15) },
    { id: 'conv-andi-sari', participantIds: ['user-andi', 'user-sari'], createdAt: at(1, 14, 0), updatedAt: at(1, 16, 20) },
    { id: 'conv-andi-bayu', participantIds: ['user-andi', 'user-bayu'], createdAt: at(1, 11, 0), updatedAt: at(1, 13, 45) },
    { id: 'conv-andi-support', participantIds: ['user-andi', 'user-support'], createdAt: at(3, 10, 0), updatedAt: at(3, 11, 10) },
    { id: 'conv-rina-dimas', participantIds: ['user-rina', 'user-dimas'], createdAt: at(1, 10, 0), updatedAt: at(1, 15, 30) },
  ];

  const messages = [
    { id: 'msg-1', conversationId: 'conv-andi-rina', senderId: 'user-rina', recipientId: 'user-andi', text: 'Pagi, data pelanggan minggu ini sudah masuk?', createdAt: at(0, 9, 36), isRead: true },
    { id: 'msg-2', conversationId: 'conv-andi-rina', senderId: 'user-andi', recipientId: 'user-rina', text: 'Pagi. Sudah, tinggal dicek ulang.', createdAt: at(0, 9, 38), isRead: true },
    { id: 'msg-3', conversationId: 'conv-andi-rina', senderId: 'user-rina', recipientId: 'user-andi', text: 'Tolong dikabari kalau sudah beres ya', createdAt: at(0, 9, 40), isRead: true },
    { id: 'msg-4', conversationId: 'conv-andi-rina', senderId: 'user-andi', recipientId: 'user-rina', text: 'Siap, nanti saya cek ya', createdAt: at(0, 9, 42), isRead: true },
    { id: 'msg-5', conversationId: 'conv-andi-dimas', senderId: 'user-dimas', recipientId: 'user-andi', text: 'Halo Andi, ini ringkasan integrasi webhook.', createdAt: at(0, 9, 10), isRead: false },
    { id: 'msg-6', conversationId: 'conv-andi-dimas', senderId: 'user-dimas', recipientId: 'user-andi', text: 'Filenya sudah saya kirim', createdAt: at(0, 9, 15), isRead: false },
    { id: 'msg-7', conversationId: 'conv-andi-sari', senderId: 'user-sari', recipientId: 'user-andi', text: 'Oke, terima kasih', createdAt: at(1, 16, 20), isRead: true },
    { id: 'msg-8', conversationId: 'conv-andi-bayu', senderId: 'user-bayu', recipientId: 'user-andi', text: 'Meeting jadi jam 2?', createdAt: at(1, 13, 45), isRead: true },
    { id: 'msg-9', conversationId: 'conv-andi-support', senderId: 'user-support', recipientId: 'user-andi', text: 'Tiket sudah ditutup', createdAt: at(3, 11, 10), isRead: true },
    { id: 'msg-confidential-1', conversationId: 'conv-rina-dimas', senderId: 'user-rina', recipientId: 'user-dimas', text: 'Halo Dimas, ini pembicaraan rahasia internal tim backend.', createdAt: at(1, 15, 0), isRead: true },
    { id: 'msg-confidential-2', conversationId: 'conv-rina-dimas', senderId: 'user-dimas', recipientId: 'user-rina', text: 'Siap Rina, aman hanya kita berdua yang bisa baca.', createdAt: at(1, 15, 30), isRead: true },
  ];

  return { users, conversations, messages } as DatabaseSchema;
}

export default buildSeed;
