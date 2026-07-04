import { motion, AnimatePresence } from 'framer-motion';

/**
 * Eco-Mode auto-shutdown toast notification panel.
 * Renders a stacked list of eco action events received from the backend.
 * Positioned in the top-right corner of the viewport.
 *
 * @param {{ notifications: Array<{id:string, roomName:string, devicesShutdown:number, savingsBdt:number, timestamp:string}>, onDismiss: (id:string) => void }} props
 */
export default function EcoToast({ notifications, onDismiss }) {
  return (
    <div className="pointer-events-none fixed right-5 top-5 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {notifications.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.95 }}
            transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            className="pointer-events-auto relative w-80 overflow-hidden rounded-xl border border-emerald-500/30 bg-slate-900/90 shadow-[0_0_30px_rgba(16,185,129,0.15)] backdrop-blur-md"
          >
            {/* Animated top-border accent */}
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-emerald-400 to-teal-300" />

            {/* Shimmer sweep */}
            <motion.div
              className="pointer-events-none absolute inset-0"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.06), transparent)' }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2, ease: 'linear' }}
            />

            <div className="relative p-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-400">
                  Eco-Mode Activated
                </span>
                <button
                  onClick={() => onDismiss(n.id)}
                  className="rounded px-1.5 py-0.5 text-[10px] text-slate-500 transition-colors hover:text-slate-300"
                >
                  Dismiss
                </button>
              </div>
              <p className="text-sm font-semibold text-white">{n.roomName}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {n.devicesShutdown} device{n.devicesShutdown !== 1 ? 's' : ''} automatically
                powered down after sustained inactivity.
              </p>
              {n.savingsBdt > 0 && (
                <p className="mt-2 text-xs font-semibold text-emerald-400">
                  Projected saving: {n.savingsBdt} BDT
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
