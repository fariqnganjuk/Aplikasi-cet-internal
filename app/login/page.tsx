import { redirect } from 'next/navigation';
import { getSessionUser } from '../../lib/auth';
import AuthScreen from '../../src/components/AuthScreen';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Masuk - Akselera.Tech Internal Chat',
  description: 'Login untuk mengakses aplikasi chat internal Akselera.Tech.',
};

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) {
    redirect('/');
  }
  return <AuthScreen />;
}
