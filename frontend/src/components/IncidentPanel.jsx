import { motion, AnimatePresence } from 'framer-motion';
import { formatRelative, severityClasses } from '../lib/format.js';
import AIInsightCard from './AIInsightCard.jsx';

/**
 * Right-column panel showing active incidents (grouped alerts) and
 * the most recent alert stream. Both re-render live via socket events.
 *
 * @param {{incidents: any[], alerts: any[]}} props
 */
export default function IncidentPanel({ incidents, alerts }) {
  const activeIncidents = incidents.filter((i) => i.status === 'active');
  const recentAlerts = [...alerts]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8);

  return (
    <motion.aside
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="glass flex h-full flex-col p-5"
    >
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
        Incidents &amp; Alerts
      </h2>

      <section className="relative mt-4">
        <div className="stat-label mb-2">Active Incidents</div>
        {activeIncidents.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-sm text-slate-400">
            No active incidents. Everything is nominal.
          </div>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {activeIncidents.map((inc) => (
                <motion.li
                  key={inc.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={`rounded-xl border p-3 ${severityClasses(inc.severity)}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{inc.title}</div>
                    <span className="text-[10px] uppercase tracking-wider">{inc.severity}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-300/80">
                    {inc.alertIds.length} alert{inc.alertIds.length === 1 ? '' : 's'} · opened{' '}
                    {formatRelative(inc.createdAt)}
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      <section className="relative mt-6 flex-1 overflow-hidden">
        <div className="stat-label mb-2">Recent Alerts</div>
        {recentAlerts.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-sm text-slate-400">
            No alerts yet. The office is behaving.
          </div>
        ) : (
          <ul className="space-y-2 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {recentAlerts.map((a) => (
                <motion.li
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm text-slate-100">{a.message}</div>
                    <span className={`chip shrink-0 ${severityClasses(a.severity)}`}>
                      {a.severity}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {a.kind} · {formatRelative(a.updatedAt)} ·{' '}
                    <span className={a.status === 'active' ? 'text-warn' : 'text-good'}>
                      {a.status}
                    </span>
                  </div>

                  {/* AI Insight — shown for power_anomaly alerts (pending or complete) */}
                  {a.status === 'active' && a.kind === 'power_anomaly' && (
                    <AIInsightCard
                      insight={a.aiInsight}
                      isPowerAnomaly={true}
                    />
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </motion.aside>
  );
}
