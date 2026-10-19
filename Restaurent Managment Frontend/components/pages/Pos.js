'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { Badge, Thumb, Modal, money } from '@/components/Ui';

export default function Page() {
  const { db, ids, items, user, toast, placeOrder, quoteOrder, createInvoice, recordPayment, dataLoaded, dataError } = useStore();
  const [cart, setCart] = useState([]);
  const [cat, setCat] = useState('All');
  const [veg, setVeg] = useState('');
  const [q, setQ] = useState('');
  const [pick, setPick] = useState('Dine-in');
  const [tableId, setTableId] = useState('');
  const [pop, setPop] = useState(null);
  const [sel, setSel] = useState({});
  const [busy, setBusy] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [quote, setQuote] = useState(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentBusy, setPaymentBusy] = useState(false);
  const cats = ['All', ...new Set(db.category.filter(category => category[3] === 'Active').map(category => category[1]))];
  const list = items.filter(item => (cat === 'All' || item.cat === cat) && (!veg || item.type === veg) && item.name.toLowerCase().includes(q.toLowerCase()));
  const lines = cart.filter(line => items[line.itemIndex]);
  const subtotal = lines.reduce((sum, line) => sum + (items[line.itemIndex].price + line.extra) * line.quantity, 0);
  const displayedSubtotal = quote ? Number(quote.subtotal) : subtotal;
  const displayedDiscount = quote ? Number(quote.discount) : 0;
  const displayedTax = quote ? Number(quote.tax) : (subtotal - displayedDiscount) * .05;
  const displayedTotal = quote ? Number(quote.total) : subtotal + displayedTax;
  const availableTables = db.tables.map((table, index) => ({ table, id: ids.tables?.[index] }))
    .filter(entry => entry.id != null && entry.table[3] === 'Available');

  const invalidateQuote = () => {
    setAppliedCoupon('');
    setQuote(null);
  };

  const addToCart = (itemIndex, optionIds, optionNames, extra) => {
    invalidateQuote();
    const key = `${itemIndex}-${[...optionIds].sort((a, b) => a - b).join(',')}`;
    setCart(current => {
      const existing = current.find(line => line.key === key);
      return existing
        ? current.map(line => line.key === key ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { key, itemIndex, optionIds, optionNames, extra, quantity: 1 }];
    });
  };

  const add = item => {
    const linkedGroupIds = new Set((item.addonGroupIds || []).map(Number));
    const groups = db.addons.filter(group =>
      group[5] === 'Active' && linkedGroupIds.has(Number(group[6])));
    if (!groups.length) {
      addToCart(item.id, [], [], 0);
      return;
    }
    setSel(Object.fromEntries(groups.map((group, index) => {
      const first = group[7][0];
      return [index, group[2] === 'Required' && group[1] === 'Single' && first ? [first.id] : []];
    })));
    setPop({ item, groups });
  };

  const confirmAdd = () => {
    for (let index = 0; index < pop.groups.length; index += 1) {
      if (pop.groups[index][2] === 'Required' && !pop.groups[index][7].length) {
        toast(`${pop.groups[index][0]} has no options configured`);
        return;
      }
      if (pop.groups[index][2] === 'Required' && !sel[index]?.length) {
        toast(`Choose an option for ${pop.groups[index][0]}`);
        return;
      }
      if (pop.groups[index][1] === 'Multi' && (sel[index]?.length || 0) > pop.groups[index][4]) {
        toast(`Choose no more than ${pop.groups[index][4]} options for ${pop.groups[index][0]}`);
        return;
      }
    }
    const chosen = pop.groups.flatMap((group, index) => group[7].filter(option => sel[index]?.includes(option.id)));
    addToCart(pop.item.id, chosen.map(option => option.id), chosen.map(option => option.name),
      chosen.reduce((sum, option) => sum + Number(option.extraPrice), 0));
    setPop(null);
  };

  const changeQuantity = (line, delta) => {
    invalidateQuote();
    setCart(current => current.map(entry => entry.key === line.key ? { ...entry, quantity: entry.quantity + delta } : entry)
      .filter(entry => entry.quantity > 0));
  };

  const changeType = type => {
    setPick(type);
    if (type !== 'Dine-in') setTableId('');
    else if (availableTables.length) setTableId(String(availableTables[0].id));
  };

  const applyCoupon = async () => {
    const code = couponCode.trim();
    if (!code || !lines.length) return;
    setCouponBusy(true);
    try {
      const result = await quoteOrder({
        items: lines.map(line => ({
          menuItemId: ids.menu?.[line.itemIndex],
          quantity: line.quantity,
          optionIds: line.optionIds,
        })),
        couponCode: code,
      });
      setQuote(result);
      setAppliedCoupon(result.couponCode);
      setCouponCode(result.couponCode);
      toast(`Coupon ${result.couponCode} applied`);
    } catch (error) {
      setQuote(null);
      setAppliedCoupon('');
      toast(error.message);
    } finally {
      setCouponBusy(false);
    }
  };

  const submit = async () => {
    if (pick === 'Dine-in' && !tableId) {
      toast(availableTables.length ? 'Select a table for this order' : 'No available tables');
      return;
    }
    setBusy(true);
    try {
      const order = await placeOrder({
        type: ({ 'Dine-in': 'DINE_IN', Takeaway: 'TAKEAWAY', Delivery: 'DELIVERY' })[pick],
        ...(pick === 'Dine-in' ? { tableId: Number(tableId) } : {}),
        ...(appliedCoupon ? { couponCode: appliedCoupon } : {}),
        items: lines.map(line => ({
          menuItemId: ids.menu?.[line.itemIndex],
          quantity: line.quantity,
          optionIds: line.optionIds,
        })),
      });
      setCart([]);
      setTableId('');
      setCouponCode('');
      setAppliedCoupon('');
      setQuote(null);
      if (user?.role === 'ADMIN') {
        try {
          const invoice = await createInvoice(order.id);
          setPaymentInvoice(invoice);
          setPaymentMethod('CASH');
          setPaymentAmount(Number(invoice.balance).toFixed(2));
          toast(`Order #${order.id} placed; invoice ${invoice.number} is ready`);
        } catch (error) {
          toast(`Order #${order.id} placed, but invoice creation failed: ${error.message}`);
        }
      } else {
        toast(`Order #${order.id} placed`);
      }
    } catch (error) {
      toast(error.message);
    } finally {
      setBusy(false);
    }
  };

  const submitPayment = async () => {
    if (!paymentInvoice || paymentBusy || Number(paymentAmount) <= 0 ||
      Number(paymentAmount) > Number(paymentInvoice.balance)) return;
    setPaymentBusy(true);
    try {
      await recordPayment(paymentInvoice.id, paymentMethod, Number(paymentAmount));
      setPaymentInvoice(null);
      toast('Payment recorded');
    } catch (error) {
      toast(error.message);
    } finally {
      setPaymentBusy(false);
    }
  };

  return (
    <div className="pos">
      <div>
        <p className="sub">Orders are priced and saved by the restaurant API.</p>
        {!dataLoaded && <p className="sub">{dataError || 'Loading menu and tables...'}</p>}
        <div className="bar"><input className="in" placeholder="Search items..." value={q} onChange={event => setQ(event.target.value)} />
          {['Veg', 'Non-Veg', 'Egg'].map(type => <button key={type} className={'chip ' + (veg === type ? 'on' : '')} onClick={() => setVeg(veg === type ? '' : type)}>{type}</button>)}</div>
        <div className="bar">{cats.map(category => <button key={category} className={'chip ' + (category === cat ? 'on' : '')} onClick={() => setCat(category)}>{category}</button>)}</div>
        <div className="menu">{list.map(item => (
          <div key={item.id} className="card it" onClick={() => add(item)}><Thumb v={item.thumb} c="th" /><div><Badge s={item.type} /></div>
            <div style={{ fontWeight: 700, margin: '4px 0' }}>{item.name}</div><div className="pr">{money(item.price)}</div></div>))}
          {!list.length && dataLoaded && <p className="sub">No menu items are available.</p>}</div>
      </div>
      <div className="card cart">
        <b>New order</b>
        <div className="bar" style={{ margin: 0 }}>{['Dine-in', 'Takeaway', 'Delivery'].map(type => <button key={type} className={'chip ' + (type === pick ? 'on' : '')} onClick={() => changeType(type)}>{type}</button>)}</div>
        {pick === 'Dine-in' && <label>Table
          <select className="in" value={tableId} onChange={event => setTableId(event.target.value)}>
            <option value="">Select a table</option>
            {availableTables.map(({ table, id }) => <option key={id} value={id}>{table[0]} · {table[1]} seats</option>)}
          </select>
        </label>}
        {lines.length ? lines.map(line => (
          <div className="ln" key={line.key}><span>{items[line.itemIndex].name}<br /><small className="sub">{line.optionNames.join(', ') || money(items[line.itemIndex].price)}</small></span>
            <span className="qty"><button onClick={() => changeQuantity(line, -1)}>−</button> {line.quantity} <button onClick={() => changeQuantity(line, 1)}>+</button></span></div>))
          : <p className="sub" style={{ textAlign: 'center', padding: '30px 0' }}>Cart is empty. Tap an item to add it.</p>}
        <div className="bar" style={{ margin: 0 }}>
          <input className="in" aria-label="Coupon code" placeholder="Coupon code" value={couponCode}
            onChange={event => { setCouponCode(event.target.value); invalidateQuote(); }} />
          <button className="chip" disabled={!lines.length || !couponCode.trim() || couponBusy}
            onClick={applyCoupon}>{couponBusy ? 'Checking...' : 'Apply coupon'}</button>
          {appliedCoupon && <button className="chip" onClick={() => { setCouponCode(''); invalidateQuote(); }}>Remove</button>}
        </div>
        <div className="ln"><span className="sub">Subtotal</span><span>{money(displayedSubtotal)}</span></div>
        {displayedDiscount > 0 && <div className="ln"><span className="sub">Coupon {appliedCoupon}</span><span>−{money(displayedDiscount)}</span></div>}
        <div className="ln"><span className="sub">Tax 5%</span><span>{money(displayedTax)}</span></div>
        <div className="tot"><span>Total</span><span>{money(displayedTotal)}</span></div>
        <button className="btn" disabled={!lines.length || busy} style={lines.length ? {} : { opacity: .5 }} onClick={submit}>{busy ? 'Saving order...' : 'Place order'}</button>
      </div>
      {pop && (
        <Modal title={pop.item.name} size="medium" ok="Add to order" onClose={() => setPop(null)} onOk={confirmAdd}>
          <div className="pos-addon-groups">
            {pop.groups.map((group, groupIndex) => (
              <div className="pos-addon-group" key={group[6]}>
                <b className="g">{group[0]} ({group[1] === 'Multi' ? `choose up to ${group[4]}` : 'choose one'})</b>
                {group[7].length ? group[7].map(option => {
                  const selected = (sel[groupIndex] || []).some(id => Number(id) === Number(option.id));
                  const maxReached = group[1] === 'Multi' && !selected &&
                    (sel[groupIndex]?.length || 0) >= Number(group[4]);
                  return (
                    <button key={option.id} type="button"
                      className={'pos-addon-option' + (selected ? ' selected' : '')}
                      aria-pressed={selected} disabled={maxReached}
                      onClick={() => setSel(current => {
                        const selectedIds = current[groupIndex] || [];
                        return {
                          ...current,
                          [groupIndex]: group[1] === 'Multi'
                            ? (selected
                              ? selectedIds.filter(id => Number(id) !== Number(option.id))
                              : [...selectedIds, option.id])
                            : [option.id],
                        };
                      })}>
                      <span className="pos-addon-check" aria-hidden="true">{selected ? '✓' : ''}</span>
                      <span>{option.name}</span>
                      <span className="pos-addon-price">{Number(option.extraPrice) ? `+${money(option.extraPrice)}` : ''}</span>
                    </button>
                  );
                }) : <p className="sub">No options configured for this group.</p>}
              </div>))}
          </div>
        </Modal>
      )}
      {paymentInvoice && (
        <Modal title={`Payment for ${paymentInvoice.number}`} ok={paymentBusy ? 'Saving...' : 'Record payment'}
          okDisabled={paymentBusy || Number(paymentAmount) <= 0 || Number(paymentAmount) > Number(paymentInvoice.balance)}
          onClose={() => !paymentBusy && setPaymentInvoice(null)} onOk={submitPayment}>
          <p className="sub">Order placed. Record the amount received to finish checkout.</p>
          <label>Payment method
            <select className="in" value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)}>
              {['CASH', 'CARD', 'UPI', 'ONLINE'].map(method => <option key={method} value={method}>{method}</option>)}
            </select>
          </label>
          <label>Amount received (balance {money(paymentInvoice.balance)})
            <input className="in" type="number" min="0.01" max={paymentInvoice.balance} step="0.01"
              value={paymentAmount} onChange={event => setPaymentAmount(event.target.value)} />
          </label>
          <p className="sub">This records a payment in the system; it does not charge a card or online gateway.</p>
        </Modal>
      )}
    </div>
  );
}
