'use client';
import { Fragment } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Store } from '@/lib/store';

const NAV = [
  ['Restaurant', [['dashboard', '🏠', 'Dashboard'], ['pos', '🛒', 'POS'], ['floor', '🪑', 'Floor plan'], ['kitchen', '🍳', 'Kitchen display'], ['orders', '🧾', 'Orders'], ['reservations', '📅', 'Reservations']]],
  ['Menu management', [['category', '🗂️', 'Category'], ['menu', '🍽️', 'Items'], ['addons', '➕', 'Addons'], ['coupons', '🏷️', 'Coupons'], ['inventory', '📦', 'Inventory']]],
  ['Operations', [['customers', '👥', 'Customers'], ['invoices', '📄', 'Invoices'], ['payments', '💳', 'Payments']]],
  ['Auth pages', [['login', '🔑', 'Login'], ['register', '📝', 'Register'], ['forgot', '❓', 'Forget password']]],
];

export default function Shell({ children }) {
  const p = usePathname().slice(1);
  const theme = () => { const r = document.documentElement; r.dataset.theme = r.dataset.theme == 'dark' ? 'light' : 'dark'; };
  return (
    <Store>
      <div id="app">
        <aside>
          <div className="logo"><i>✕</i>RestroPOS</div>
          {NAV.map(([g, ls]) => (
            <Fragment key={g}><h6>{g}</h6>
              {ls.map(([k, e, n]) => <Link key={k} href={'/' + k} className={k == p ? 'on' : ''}>{e} {n}</Link>)}
            </Fragment>
          ))}
        </aside>
        <main>
          <header><input placeholder="Type to search..." aria-label="Search" /><span className="sp" />
            <button className="ib" onClick={theme}>🌓</button><button className="ib">🔔</button><span className="av">A</span></header>
          <section>{children}</section>
        </main>
      </div>
    </Store>
  );
}
