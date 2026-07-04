import { motion } from 'framer-motion';

/**
 * Top bar with the app title and connection status.
 */
export default function Header({ connected }) {
  return (
    <header className="mb-8 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <motion.div
          initial={{ rotate: -20, scale: 0.8, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 18 }}
          className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-accent-400 to-purple-500 text-black shadow-glow"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
            <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
          </svg>
        </motion.div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Office Power Monitor</h1>
          <p className="text-xs text-slate-400">Realtime energy telemetry · 3 rooms · 15 devices</p>
        </div>
      </div>

      <div className="chip">
        <span
          className={`h-2 w-2 rounded-full ${connected ? 'bg-good animate-pulse' : 'bg-bad'}`}
        />
        {connected ? 'Live' : 'Reconnecting…'}
      </div>
    </header>
  );
}
