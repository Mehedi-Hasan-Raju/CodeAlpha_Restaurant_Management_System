import { Badge, Thumb, money } from '@/components/Ui';

// One config per CRUD page: t=title, s=count label, n=item name, ch=column index used by filter chips,
// h=table headers, f=form fields [label, type | options[] | 'img'], r=row renderer, top=optional header block.
const S = ['Active', 'Inactive'], T = ['Dine-in', 'Takeaway', 'Delivery'], P = ['Card', 'UPI', 'Cash', 'Online'], R = ['Upcoming', 'Seated', 'Completed', 'Cancelled'];
const CATS = ['Pizza', 'Burgers', 'Salads', 'Soups', 'Desserts', 'Drinks'];
const mono = x => <span className="mono">{x}</span>;
const lead = (a, b, c) => <div className="ln" style={{ justifyContent: 'flex-start' }}>{a}<span><b>{b}</b><br /><small className="sub">{c}</small></span></div>;
const av = n => <span className="av" style={{ background: `hsl(${n.length * 47 % 360} 55% 50%)` }}>{n[0]}</span>;
const stat = x => x[3] == 0 ? 'Out' : x[3] < x[4] ? 'Low' : 'Adequate';
const BC = { Adequate: 'var(--ok)', Low: 'var(--wa)', Out: 'var(--rd)' };

export const MODS = {
  category: { t: 'Categories', s: 'categories', n: 'category', h: ['#', 'Name', 'Description', 'Status'],
    f: [['Emoji'], ['Name'], ['Description'], ['Status', S]],
    r: (x, i) => [i + 1, <>{x[0]} <b>{x[1]}</b></>, x[2], <Badge s={x[3]} />] },
  addons: { t: 'Addon groups', s: 'groups', n: 'group', h: ['Group', 'Type', 'Required', 'Options', 'Max select', 'Status'],
    f: [['Group name'], ['Type', ['Single', 'Multi']], ['Required', ['Required', 'Optional']], ['Options', 'number'], ['Max select', 'number'], ['Status', S]],
    r: x => [<b>{x[0]}</b>, <Badge s={x[1]} />, x[2] == 'Required' ? <Badge s="Required" /> : x[2], x[3] + ' options', x[4], <Badge s={x[5]} />] },
  coupons: { t: 'Coupons', s: 'coupons', n: 'coupon', ch: 7, o: S, h: ['Code', 'Description', 'Type', 'Value', 'Min. order', 'Expires', 'Used', 'Status'],
    f: [['Code'], ['Description'], ['Type', ['Percentage', 'Flat amount']], ['Value'], ['Min. order'], ['Expires'], ['Used'], ['Status', S]],
    r: x => [mono(x[0]), x[1], x[2], x[3], x[4], x[5], x[6], <Badge s={x[7]} />] },
  menu: { t: 'Menu items', s: 'items', n: 'item', ch: 2, o: CATS, h: ['Item', 'Category', 'Price', 'Type', 'Status'],
    f: [['Item image', 'img'], ['Name'], ['Category', CATS], ['Price ($)', 'number'], ['Type', ['Veg', 'Non-Veg', 'Egg']], ['Description']],
    r: x => [lead(<Thumb v={x[0]} />, x[1], x[5]), x[2], money(x[3]), <Badge s={x[4]} />, <Badge s="Active" />] },
  inventory: { t: 'Inventory', s: 'items', n: 'item', h: ['Item', 'Category', 'Unit', 'Stock', 'Level', 'Min / Max', 'Status', 'Adjust'],
    f: [['Item name'], ['Category', ['Grains', 'Dairy', 'Vegetables', 'Proteins', 'Essentials']], ['Unit', ['kg', 'ltr', 'pcs']], ['Stock', 'number'], ['Min stock', 'number'], ['Max stock', 'number']],
    top: rows => (
      <div className="stats">
        <div className="card"><span className="sub">Total items</span><b>{rows.length}</b></div>
        <div className="card"><span className="sub">Low stock</span><b style={{ color: 'var(--wa)' }}>{rows.filter(x => stat(x) == 'Low').length}</b></div>
        <div className="card"><span className="sub">Out of stock</span><b style={{ color: 'var(--rd)' }}>{rows.filter(x => !x[3]).length}</b></div>
      </div>),
    r: (x, i, c) => [<b>{x[0]}</b>, x[1], x[2], <b style={{ fontSize: 15 }}>{x[3]}</b>,
      <div className="bar2"><i style={{ width: Math.min(100, x[3] / (x[5] || 1) * 100) + '%', background: BC[stat(x)] }} /></div>,
      `${x[4]} / ${x[5]}`, <Badge s={stat(x)} />,
      <span><button className="chip" onClick={() => c.adj(i, -1)}>−</button> <button className="chip" onClick={() => c.adj(i, 1)}>+</button></span>] },
  customers: { t: 'Customers', s: 'customers registered', n: 'customer', h: ['Customer', 'Phone', 'Orders', 'Total spent', 'Joined'],
    f: [['Name'], ['Phone'], ['Email', 'email'], ['Orders', 'number'], ['Total spent ($)', 'number'], ['Joined']],
    r: x => [lead(av(x[0]), x[0], x[2]), x[1], x[3], '$' + x[4], x[5]] },
  invoices: { t: 'Invoices', s: 'invoices', n: 'invoice', ch: 6, o: ['Paid', 'Pending', 'Cancelled'], h: ['Invoice #', 'Customer', 'Date', 'Type', 'Payment', 'Total', 'Status'],
    f: [['Invoice #'], ['Customer'], ['Date'], ['Type', T], ['Payment', P], ['Total ($)', 'number'], ['Status', ['Paid', 'Pending', 'Cancelled']]],
    r: x => [mono(x[0]), x[1], x[2], x[3], x[4], money(x[5]), <Badge s={x[6]} />] },
  payments: { t: 'Payments', s: 'payments recorded', n: 'payment', ch: 6, o: ['Completed', 'Pending', 'Failed', 'Refunded'], h: ['Payment #', 'Customer', 'Date', 'Method', 'Invoice ref', 'Amount', 'Status'],
    f: [['Payment #'], ['Customer'], ['Date'], ['Method', P], ['Invoice ref'], ['Amount ($)', 'number'], ['Status', ['Completed', 'Pending', 'Failed', 'Refunded']]],
    r: x => [<b>{x[0]}</b>, x[1], x[2], x[3], mono(x[4]), money(x[5]), <Badge s={x[6]} />] },
  reservations: { t: 'Reservations', s: 'reservations', n: 'reservation', ch: 5, o: R, h: ['Guest', 'Date & time', 'Party', 'Table', 'Status'],
    f: [['Guest'], ['Date'], ['Time'], ['Party size', 'number'], ['Table', Array.from({ length: 12 }, (_, i) => 'Table ' + (i + 1))], ['Status', R]],
    r: x => [<b>{x[0]}</b>, <>{x[1]}<br /><small className="sub">{x[2]}</small></>, x[3] + ' guests', x[4], <Badge s={x[5]} />] },
};
