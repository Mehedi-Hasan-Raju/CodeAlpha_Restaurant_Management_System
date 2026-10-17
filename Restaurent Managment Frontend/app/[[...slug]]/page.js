import { notFound, redirect } from 'next/navigation';
import Crud from '@/components/Crud';
import AuthPage from '@/components/pages/AuthPage';
import Dashboard from '@/components/pages/Dashboard';
import Floor from '@/components/pages/Floor';
import Kitchen from '@/components/pages/Kitchen';
import Orders from '@/components/pages/Orders';
import Pos from '@/components/pages/Pos';

const CRUD_PAGES = new Set([
  'addons',
  'category',
  'coupons',
  'customers',
  'invoices',
  'inventory',
  'menu',
  'payments',
  'reservations',
]);

export default function Page({ params }) {
  const route = params.slug?.[0];

  if (!route) {
    redirect('/dashboard');
  }

  if (CRUD_PAGES.has(route)) {
    return <Crud k={route} />;
  }

  switch (route) {
    case 'dashboard':
      return <Dashboard />;
    case 'floor':
      return <Floor />;
    case 'kitchen':
      return <Kitchen />;
    case 'login':
    case 'register':
    case 'forgot':
      return <AuthPage kind={route} />;
    case 'orders':
      return <Orders />;
    case 'pos':
      return <Pos />;
    default:
      notFound();
  }
}
