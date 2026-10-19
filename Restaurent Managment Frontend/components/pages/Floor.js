'use client';
import { Badge } from '@/components/Ui';
import { useStore } from '@/lib/store';
export default function Page() {
  const { db, token, ids, updateTableStatus, toast, loading, dataLoaded } = useStore();
  const tables = token && !dataLoaded ? [] : db.tables;
  const changeStatus = async (index, status) => {
    try {
      await updateTableStatus(index, status);
      toast('Table status updated');
    } catch (error) {
      toast(error.message);
    }
  };
  return (<><h1>Tables</h1><p className="sub">Live floor status</p>
    {!token && <p className="sub">Demo data. Log in to load and update database tables.</p>}
    {token && !dataLoaded && <p className="sub">{loading ? 'Loading database tables...' : 'Database tables could not be loaded. Please check the backend and try again.'}</p>}
    <div className="grid">{tables.map((t, i) => <div key={ids.tables?.[i] || t[0]} className={'card tb ' + t[3]}><div className="seat" /><b>{t[0]}</b><div className="sub">{t[1]} seats · {t[2]}</div><Badge s={t[3]} />
      {token && dataLoaded && <select className="in" aria-label={`Status for ${t[0]}`} value={t[3]} onChange={event => changeStatus(i, event.target.value)}>
        {['Available', 'Occupied', 'Reserved', 'Cleaning'].map(status => <option key={status}>{status}</option>)}
      </select>}
    </div>)}</div></>);
}
