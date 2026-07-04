import { motion } from 'framer-motion';
import { formatWatts } from '../lib/format.js';

/**
 * Compact widget that visualises the office's current power breakdown
 * by room and by device type as animated stacked bars.
 *
 * @param {{usage: any, rooms: any[]}} props
 */
export default function PowerBreakdown({ usage, rooms }) {
  if (!usage) {
    return null;
  }

  const total = usage.currentPowerWatts || 0;
  const rows = rooms.map((r) => ({
    id: r.id,
    name: r.name,
    watts: usage.powerByRoom?.[r.id] || 0
  }));

  const typeRows = [
    {
      id: 'fan',
      label: 'Fans',
      watts: usage.powerByType?.fan || 0,
      tone: 'from-accent-400 to-purple-500'
    },
    {
      id: 'light',
      label: 'Lights',
      watts: usage.powerByType?.light || 0,
      tone: 'from-warn to-orange-400'
    }
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="glass p-5"
    >
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
          Power Breakdown
        </h3>
        <div className="text-xs text-slate-400">Total {formatWatts(total)}</div>
      </div>

      <div className="relative mt-4 space-y-3">
        {rows.map((r) => {
          const pct = total > 0 ? Math.round((r.watts / total) * 100) : 0;
          return (
            <div key={r.id}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-slate-300">{r.name}</span>
                <span className="text-slate-400">
                  {formatWatts(r.watts)} · {pct}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                <motion.div
                  className="h-full bg-gradient-to-r from-accent-400 to-purple-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative mt-6 grid grid-cols-2 gap-3">
        {typeRows.map((t) => {
          const pct = total > 0 ? Math.round((t.watts / total) * 100) : 0;
          return (
            <div key={t.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-xs text-slate-400">{t.label}</div>
              <div className="mt-1 text-xl font-semibold text-white">{formatWatts(t.watts)}</div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <motion.div
                  className={`h-full bg-gradient-to-r ${t.tone}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}
