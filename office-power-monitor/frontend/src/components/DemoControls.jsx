import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DemoControls() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const trigger = async (scenario) => {
    setLoading(true);
    try {
      const url = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
      await fetch(`${url}/api/demo/${scenario}`, { method: 'POST' });
    } catch (err) {
      console.error('Demo trigger failed', err);
    }
    setLoading(false);
    setOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="glass mb-4 flex flex-col gap-2 p-4 shadow-2xl"
          >
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              Demo Scenarios
            </div>
            <button
              disabled={loading}
              onClick={() => trigger('everything-off')}
              className="rounded bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
            >
              Everything OFF
            </button>
            <button
              disabled={loading}
              onClick={() => trigger('office-hours')}
              className="rounded bg-accent-500/20 px-4 py-2 text-sm text-accent-400 hover:bg-accent-500/30"
            >
              High Power (Office Hours)
            </button>
            <button
              disabled={loading}
              onClick={() => trigger('alert-scenario')}
              className="rounded bg-warn/20 px-4 py-2 text-sm text-warn hover:bg-warn/30"
            >
              Alert Scenario (Drawing Room)
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen(!open)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-white shadow-lg ring-1 ring-white/10 hover:bg-slate-700"
        aria-label="Toggle Demo Controls"
      >
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
        </svg>
      </button>
    </div>
  );
}
