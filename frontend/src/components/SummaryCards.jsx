import { motion } from 'framer-motion';
import { formatKwh, formatWatts } from '../lib/format.js';

/**
 * Small animated stat card used inside the summary grid.
 */
function StatCard({ label, value, sub, tone = 'accent', delay = 0 }) {
  const toneRing = {
    accent: 'from-accent-400/40 to-purple-500/40',
    good: 'from-good/40 to-emerald-400/40',
    warn: 'from-warn/40 to-orange-400/40',
    bad: 'from-bad/40 to-rose-500/40'
  }[tone];

  return (
    <motion.div
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      className="glass p-5"
    >
      <div
        className={`absolute -inset-px rounded-2xl bg-gradient-to-br ${toneRing} opacity-30 blur-2xl`}
      />
      <div className="relative">
        <div className="stat-label">{label}</div>
        <div className="stat-value mt-2">{value}</div>
        {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
      </div>
    </motion.div>
  );
}

/**
 * @param {{usage: any, alerts: any[]}} props
 */
export default function SummaryCards({ usage, alerts }) {
  const power = usage?.currentPowerWatts ?? 0;
  const kwh = usage?.energyTodayKwh ?? 0;
  const top = usage?.highestConsumingRoom;
  const active = alerts.filter((a) => a.status === 'active').length;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Current Power"
        value={formatWatts(power)}
        sub="Instantaneous draw"
        tone="accent"
        delay={0}
      />
      <StatCard
        label="Energy Today"
        value={formatKwh(kwh)}
        sub={usage?.energyCostBdt !== undefined ? `Est. Cost: ${usage.energyCostBdt} BDT` : "Since local midnight"}
        tone="good"
        delay={0.05}
      />
      <StatCard
        label="Top Consuming Room"
        value={top?.name || '—'}
        sub={top?.roomId ? formatWatts(top.watts) : 'All rooms idle'}
        tone="warn"
        delay={0.1}
      />
      <StatCard
        label="Active Alerts"
        value={active}
        sub={active === 0 ? 'All clear' : 'Attention needed'}
        tone={active === 0 ? 'good' : 'bad'}
        delay={0.15}
      />
    </div>
  );
}
