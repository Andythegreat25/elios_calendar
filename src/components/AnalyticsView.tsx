import type { CalendarEvent, Calendar } from '@/types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from 'recharts';
import { format, startOfWeek, eachDayOfInterval, endOfWeek, getHours, isSameDay, subWeeks, addDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { Clock, TrendingUp, CalendarDays, Zap } from 'lucide-react';

interface AnalyticsViewProps {
  events: CalendarEvent[];
  calendars: Calendar[];
  currentDate: Date;
}

const PIE_COLORS = [
  '#A881F3', '#34D399', '#F472B6', '#60A5FA',
  '#FBBF24', '#F87171', '#818CF8', '#2DD4BF',
];

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

// ── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: typeof Clock;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-zinc-50 dark:bg-[#111113] rounded-2xl p-5 flex flex-col gap-2 border border-zinc-100 dark:border-zinc-700/40">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}22` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-zinc-900 dark:text-white">{value}</div>
      {sub && <div className="text-xs text-zinc-400 dark:text-zinc-500">{sub}</div>}
    </div>
  );
}

export function AnalyticsView({ events, calendars, currentDate }: AnalyticsViewProps) {
  const visibleCalIds = new Set(
    calendars.filter((c) => c.visible !== false).map((c) => c.id),
  );
  const myEvents = events.filter((e) => !e.isExternal && visibleCalIds.has(e.calendarId));

  // ── Dati settimana corrente ────────────────────────────────────────────────
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const weekEvents = myEvents.filter(
    (e) => e.date >= weekStart && e.date <= weekEnd,
  );

  const weekMinutes = weekEvents.reduce((sum, e) => sum + Math.max(0, minutesBetween(e.startTime, e.endTime)), 0);
  const weekHours = (weekMinutes / 60).toFixed(1);

  // ── Grafico: eventi per giorno (settimana corrente) ────────────────────────
  const weekBarData = weekDays.map((day) => ({
    name: format(day, 'EEE', { locale: it }).charAt(0).toUpperCase() + format(day, 'EEE', { locale: it }).slice(1, 3),
    eventi: myEvents.filter((e) => isSameDay(e.date, day)).length,
    ore: parseFloat((myEvents.filter((e) => isSameDay(e.date, day)).reduce((s, e) => s + Math.max(0, minutesBetween(e.startTime, e.endTime)), 0) / 60).toFixed(1)),
  }));

  // ── Grafico: heatmap ore del giorno (ultime 4 settimane) ───────────────────
  const fourWeeksAgo = subWeeks(currentDate, 4);
  const recentEvents = myEvents.filter((e) => e.date >= fourWeeksAgo);

  const hourData = Array.from({ length: 14 }, (_, i) => {
    const hour = i + 7; // 7-20
    const count = recentEvents.filter((e) => {
      const [h] = e.startTime.split(':').map(Number);
      return h === hour;
    }).length;
    return { ora: `${hour}:00`, count };
  });

  const peakHour = hourData.reduce((a, b) => b.count > a.count ? b : a, { ora: '', count: 0 });

  // ── Grafico: distribuzione per calendario (pie) ────────────────────────────
  const pieData = calendars
    .filter((c) => c.visible !== false)
    .map((cal) => ({
      name: cal.name,
      value: myEvents.filter((e) => e.calendarId === cal.id).length,
      color: cal.color,
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // ── Stats cards ────────────────────────────────────────────────────────────
  const totalEvents = myEvents.length;
  const totalHours = (myEvents.reduce((s, e) => s + Math.max(0, minutesBetween(e.startTime, e.endTime)), 0) / 60).toFixed(0);
  const avgEventsPerDay = weekEvents.length > 0 ? (weekEvents.length / 7).toFixed(1) : '0';

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Analytics</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={CalendarDays} label="Settimana corrente" value={`${weekEvents.length}`} sub="eventi" color="#A881F3" />
        <StatCard icon={Clock} label="Ore in riunione" value={`${weekHours}h`} sub="questa settimana" color="#34D399" />
        <StatCard icon={TrendingUp} label="Totale eventi" value={`${totalEvents}`} sub={`${totalHours}h totali`} color="#60A5FA" />
        <StatCard icon={Zap} label="Ora di punta" value={peakHour.count > 0 ? peakHour.ora : '—'} sub={peakHour.count > 0 ? `${peakHour.count} eventi` : 'nessun dato'} color="#F472B6" />
      </div>

      {/* Grafici */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar chart: eventi per giorno */}
        <div className="bg-zinc-50 dark:bg-[#111113] rounded-2xl p-5 border border-zinc-100 dark:border-zinc-700/40">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">Questa settimana</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weekBarData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(161,161,170,0.15)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#71717A' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#71717A' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1C1C1E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', fontSize: '12px' }}
                labelStyle={{ color: '#fff' }}
                itemStyle={{ color: '#A1A1AA' }}
              />
              <Bar dataKey="eventi" fill="#A881F3" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart: per calendario */}
        <div className="bg-zinc-50 dark:bg-[#111113] rounded-2xl p-5 border border-zinc-100 dark:border-zinc-700/40">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">Per calendario</h3>
          {pieData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color ?? PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 min-w-0">
                {pieData.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color ?? PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-zinc-600 dark:text-zinc-400 truncate">{entry.name}</span>
                    <span className="ml-auto text-zinc-400 dark:text-zinc-500 font-medium">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[140px] text-zinc-400 dark:text-zinc-500 text-sm">
              Nessun dato
            </div>
          )}
        </div>
      </div>

      {/* Heatmap ore del giorno */}
      <div className="bg-zinc-50 dark:bg-[#111113] rounded-2xl p-5 border border-zinc-100 dark:border-zinc-700/40">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">Ore di punta (ultime 4 settimane)</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={hourData} barSize={18}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(161,161,170,0.15)" vertical={false} />
            <XAxis dataKey="ora" tick={{ fontSize: 10, fill: '#71717A' }} axisLine={false} tickLine={false} interval={1} />
            <YAxis tick={{ fontSize: 10, fill: '#71717A' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1C1C1E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', fontSize: '12px' }}
              labelStyle={{ color: '#fff' }}
              itemStyle={{ color: '#A1A1AA' }}
              formatter={(value) => [`${value} eventi`, 'Conteggio']}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {hourData.map((entry, i) => (
                <Cell key={i} fill={entry.count === peakHour.count && entry.count > 0 ? '#F472B6' : '#A881F333'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
