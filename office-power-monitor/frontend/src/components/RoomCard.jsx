import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatRelative, formatWatts } from '../lib/format.js';
import { FanIcon, LightIcon } from './DeviceIcons.jsx';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

/**
 * Interactive animated device chip.
 * Clicking the chip toggles the device on/off via the REST API.
 * Includes optimistic UI updates and a transient loading state.
 */
function DeviceChip({ device, index = 0 }) {
  const [pending, setPending] = useState(false);
  const on = device.status === 'on';
  const isFan = device.type === 'fan';

  const handleToggle = async () => {
    if (pending) { return; }
    setPending(true);
    try {
      await fetch(`${BACKEND_URL}/api/devices/${device.id}/toggle`, { method: 'POST' });
    // eslint-disable-next-line no-unused-vars
    } catch (e) {
      // Socket update from backend will reconcile state regardless
    } finally {
      setPending(false);
    }
  };

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: 'easeOut' }}
      onClick={handleToggle}
      disabled={pending}
      className={`
        relative w-full flex items-center justify-between overflow-hidden
        rounded-xl border px-3 py-2.5 text-left transition-all duration-300
        cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/50
        ${pending ? 'opacity-60' : ''}
        ${on
          ? isFan
            ? 'border-sky-500/30 bg-sky-500/5 hover:border-sky-400/50 hover:bg-sky-500/10 active:scale-[0.99]'
            : 'border-yellow-400/30 bg-yellow-400/5 hover:border-yellow-300/50 hover:bg-yellow-400/10 active:scale-[0.99]'
          : 'border-white/[0.07] bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06] active:scale-[0.99]'}
      `}
    >
      {/* Subtle animated shimmer when ON */}
      {on && (
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{
            background: isFan
              ? 'linear-gradient(90deg, transparent, rgba(56,189,248,0.06), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(253,224,71,0.07), transparent)',
          }}
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.5 }}
        />
      )}

      <div className="flex items-center gap-3">
        {/* Animated icon container */}
        <motion.div
          className={`
            grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl
            transition-colors duration-300
            ${on
              ? isFan
                ? 'bg-sky-500/15 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                : 'bg-yellow-400/15 shadow-[0_0_12px_rgba(253,224,71,0.25)]'
              : 'bg-white/5'}
          `}
          animate={on ? { scale: [1, 1.04, 1] } : { scale: 1 }}
          transition={{ duration: 3, repeat: on ? Infinity : 0, ease: 'easeInOut' }}
        >
          {isFan
            ? <FanIcon on={on} wattage={device.power || 75} size={20} />
            : <LightIcon on={on} size={18} />
          }
        </motion.div>

        <div>
          <div className="text-sm font-medium text-slate-100">{device.label}</div>
          <div className="mt-0.5 text-[11px] uppercase tracking-wider text-slate-500">
            {device.type} · {formatRelative(device.lastChanged)}
          </div>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-3 text-right">
        {/* Toggle switch visual */}
        <div className={`relative h-5 w-9 rounded-full transition-colors duration-300 ${on ? (isFan ? 'bg-sky-500/60' : 'bg-yellow-400/60') : 'bg-white/10'}`}>
          <motion.div
            className={`absolute top-0.5 h-4 w-4 rounded-full shadow-sm transition-colors duration-300 ${on ? 'bg-white' : 'bg-slate-500'}`}
            animate={{ x: on ? 16 : 2 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          />
          {/* Pending spinner overlay */}
          {pending && (
            <motion.div
              className="absolute inset-0 rounded-full border border-white/30"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          )}
        </div>

        <div>
          <motion.div
            className={`text-xs font-semibold tracking-widest ${on ? (isFan ? 'text-sky-400' : 'text-yellow-300') : 'text-slate-500'}`}
            animate={on ? { opacity: [0.7, 1, 0.7] } : { opacity: 1 }}
            transition={{ duration: 2, repeat: on ? Infinity : 0 }}
          >
            {on ? 'ON' : 'OFF'}
          </motion.div>
          <div className="mt-0.5 text-[11px] text-slate-400">{formatWatts(on ? device.power : 0)}</div>
        </div>
      </div>
    </motion.button>
  );
}

/**
 * Simple SVG sparkline for power history
 */
function Sparkline({ samples }) {
  if (!samples || samples.length < 2) {return null;}
  const maxW = Math.max(...samples.map((s) => s.w), 10);
  
  const width = 72;
  const height = 24;
  
  const pts = samples.map((s, i) => {
    const x = (i / (samples.length - 1)) * width;
    const y = height - (s.w / maxW) * height;
    return `${x},${y}`;
  });

  const pathD = `M ${pts.join(' L ')}`;
  const fillD = `${pathD} L ${width},${height} L 0,${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible opacity-80">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(56,189,248,0.2)" />
          <stop offset="100%" stopColor="rgba(56,189,248,0)" />
        </linearGradient>
      </defs>
      <path d={fillD} fill="url(#spark-fill)" />
      <path d={pathD} fill="none" stroke="rgba(56,189,248,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Full room card with animated power bar, device chips, and utilisation ring.
 * @param {{room: any, delay?: number}} props
 */
export default function RoomCard({ room, delay = 0 }) {
  const utilisation = room.totalDevices > 0 ? room.onCount / room.totalDevices : 0;
  const bar = Math.round(utilisation * 100);
  const isHot = room.allOn;

  // Colour the utilisation bar based on load
  const barColor =
    utilisation >= 1
      ? 'from-orange-400 to-red-500'
      : utilisation >= 0.5
      ? 'from-accent-400 to-purple-500'
      : 'from-sky-400 to-accent-400';

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
      className="glass p-5"
    >
      {/* Header row */}
      <div className="relative flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-white">{room.name}</h3>
            {/* Occupancy Prediction Badge */}
            {room.predictions && (
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                room.predictions.predictedState === 'occupied' 
                  ? 'border-green-500/30 text-green-400 bg-green-500/10'
                  : 'border-slate-500/30 text-slate-400 bg-slate-500/10'
              }`}>
                {room.predictions.predictedState === 'occupied' ? 'Occupied' : 'Empty'}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {room.onCount}/{room.totalDevices} devices on ·{' '}
            <span className={room.powerWatts > 0 ? 'text-accent-300' : 'text-slate-500'}>
              {formatWatts(room.powerWatts)}
            </span>
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {/* All-on warning badge */}
          {isHot && (
            <motion.span
              className="chip border-warn/40 bg-warn/10 text-warn"
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            >
              ⚠ All ON
            </motion.span>
          )}
          {/* Sparkline history */}
          {!isHot && room.samples?.length > 1 && (
            <Sparkline samples={room.samples} />
          )}
        </div>
      </div>

      {/* Power utilisation bar */}
      <div className="relative mt-4">
        <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
          <span>Load</span>
          <motion.span
            key={bar}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={bar > 0 ? 'text-slate-300' : ''}
          >
            {bar}%
          </motion.span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${barColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${bar}%` }}
            transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
          />
          {/* Animated shimmer on the bar when > 0 */}
          {bar > 0 && (
            <motion.div
              className="absolute inset-y-0 w-16 rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)' }}
              animate={{ x: ['-4rem', `${bar + 16}%`] }}
              transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' }}
            />
          )}
        </div>
      </div>

      {/* AI Cost-Savings Optimizer Alert */}
      <AnimatePresence>
        {room.predictions?.predictedState === 'unoccupied' && room.predictions?.potentialSavingsBdt > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="overflow-hidden"
          >
            <div className="relative rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
              {/* Shimmer effect inside the alert */}
              <motion.div
                className="pointer-events-none absolute inset-0 rounded-lg"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.1), transparent)' }}
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
              <div className="relative flex items-center gap-3">
                <div className="text-xs text-purple-200">
                  <strong className="block font-semibold tracking-wide text-purple-300">Waste Optimizer</strong>
                  Room is empty. Turn off active devices to save <span className="font-bold text-white">~{room.predictions.potentialSavingsBdt} BDT</span> today.
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Device chips */}
      <div className="mt-4 space-y-2">
        <AnimatePresence initial={false}>
          {room.devices.map((d, i) => (
            <DeviceChip key={d.id} device={d} index={i} />
          ))}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}
