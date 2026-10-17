import { Badge } from '@/components/Ui';
import * as D from '@/lib/data';
export default function Page() {
  return (<><h1>Tables</h1><p className="sub">Live floor status</p>
    <div className="grid">{D.tables.map(t => <div key={t[0]} className={'card tb ' + t[3]}><div className="seat" /><b>{t[0]}</b><div className="sub">{t[1]} seats · {t[2]}</div><Badge s={t[3]} /></div>)}</div></>);
}
