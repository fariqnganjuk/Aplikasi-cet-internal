import { redirect } from 'next/navigation';
import { getSessionUser } from '../lib/auth';
import App from '../src/App';
import type { User } from '../src/types/chat';

export const dynamic = 'force-dynamic';

// Aturan Wajib #1: halaman chat tidak bisa dibuka tanpa login.
// Guard ini berjalan di server sebelum HTML apa pun dikirim ke browser.
export default async function Page() {
  const user = await getSessionUser();

  if (!user) {
    redirect('/login');
  }

  const { passwordHash, ...safeUser } = user;
  const initialUser: User = safeUser as unknown as User;

  return <App initialUser={initialUser} />;
}
