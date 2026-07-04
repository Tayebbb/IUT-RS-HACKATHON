import { useState, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Top-down office layout. Draws three rooms side-by-side with walls,
 * doors, a shared corridor, tables, chairs, ceiling lights, and fans.
 *
 * Highly interactive:
 * - Fans have animated 3-blade spin with speed proportional to wattage.
 * - Lights emit animated halo bloom rings when ON.
 * - Hover over devices for a quick tooltip.
 * - Click devices for a detailed modal overlay.
 *
 * @param {{devices: any[], rooms: any[]}} props
 */
export default function OfficeLayout({ devices = [], rooms = [], alerts = [] }) {
  const [hoverId, setHoverId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const uid = useId().replace(/:/g, '');

  // Fast lookup
  const byId = new Map(devices.map((d) => [d.id, d]));
  const roomByIdMeta = new Map(rooms.map((r) => [r.id, r]));

  // Room coordinates
  const roomSlots = [
    { id: 'drawing-room', x: 20, y: 60, w: 260, h: 360, label: 'Drawing Room' },
    { id: 'work-room-1', x: 300, y: 60, w: 260, h: 360, label: 'Work Room 1' },
    { id: 'work-room-2', x: 580, y: 60, w: 260, h: 360, label: 'Work Room 2' }
  ];

  // Local positions inside each room
  const lightSlots = [
    { x: 60, y: 70 },
    { x: 130, y: 70 },
    { x: 200, y: 70 }
  ];
  const fanSlots = [
    { x: 90, y: 210 },
    { x: 170, y: 210 }
  ];

  const handleMouseMove = (e) => {
    setMousePos({ x: e.clientX + 15, y: e.clientY + 15 });
  };

  const hoverDevice = hoverId ? byId.get(hoverId) : null;
  const selectedDevice = selectedId ? byId.get(selectedId) : null;

  return (
    <section className="glass relative p-5" onMouseMove={handleMouseMove}>
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
          Office Layout · Interactive Map
        </h3>
        <div className="text-xs text-slate-400">Hover for info · Click for details</div>
      </div>

      <div className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-ink-900/60 shadow-inner">
        <svg
          viewBox="0 0 860 480"
          className="block h-auto w-full select-none"
          role="img"
          aria-label="Interactive Top-down office floor plan"
        >
          <defs>
            <pattern id={`floor-grid-${uid}`} width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M20 0H0V20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            </pattern>

            {/* Warm amber glow for lights */}
            <radialGradient id={`light-bloom-${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(253,224,71,1)" />
              <stop offset="45%" stopColor="rgba(251,191,36,0.55)" />
              <stop offset="100%" stopColor="rgba(253,224,71,0)" />
            </radialGradient>

            {/* Fan on glow */}
            <radialGradient id={`fan-glow-${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(56,189,248,0.5)" />
              <stop offset="100%" stopColor="rgba(56,189,248,0)" />
            </radialGradient>
            
            {/* Anomaly heat pulse */}
            <radialGradient id={`anomaly-pulse-${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(239,68,68,0.25)" />
              <stop offset="100%" stopColor="rgba(239,68,68,0.05)" />
            </radialGradient>

            {/* Masks to cut doors into the solid walls */}
            {roomSlots.map((slot) => (
              <mask id={`door-mask-${slot.id}-${uid}`} key={slot.id}>
                <rect x="0" y="0" width="860" height="480" fill="white" />
                <rect x={slot.x + slot.w / 2 - 25} y={slot.y + slot.h - 10} width="50" height="20" fill="black" />
              </mask>
            ))}
          </defs>

          <rect x="0" y="0" width="860" height="480" fill={`url(#floor-grid-${uid})`} />

          {/* Outer building outline */}
          <rect
            x="8" y="40" width="844" height="430" rx="12"
            fill="none"
            stroke="rgba(148,163,184,0.3)"
            strokeWidth="2"
            strokeDasharray="8,4"
          />
          <text x="20" y="30" fill="rgba(226,232,240,0.7)" fontSize="14" fontWeight="600" letterSpacing="2">
            OFFICE FLOOR PLAN
          </text>

          {roomSlots.map((slot) => {
            const meta = roomByIdMeta.get(slot.id);
            const hasAnomaly = alerts.some(a => a.room === slot.id && a.kind === 'power_anomaly');
            
            // Heatmap calculation
            const utilisation = meta && meta.totalDevices > 0 ? meta.onCount / meta.totalDevices : 0;
            // Base color: from cool blue (low load) to warm amber (high load)
            let fillColor = 'rgba(15,23,42,0.55)'; // default vacant
            if (utilisation > 0) {
              if (utilisation < 0.5) {fillColor = 'rgba(14,165,233,0.1)';} // cool blue
              else if (utilisation < 1) {fillColor = 'rgba(245,158,11,0.1)';} // warm amber
              else {fillColor = 'rgba(245,158,11,0.2)';} // hot amber
            }

            return (
              <g key={slot.id}>
                {/* Room walls (masked for doors) */}
                <rect
                  x={slot.x} y={slot.y} width={slot.w} height={slot.h} rx="10"
                  fill={fillColor}
                  stroke={hasAnomaly ? 'rgba(239,68,68,0.9)' : (meta?.allOn ? 'rgba(245,158,11,0.8)' : 'rgba(148,163,184,0.4)')}
                  strokeWidth={hasAnomaly ? "3" : "2.5"}
                  mask={`url(#door-mask-${slot.id}-${uid})`}
                  style={{ transition: 'fill 1s ease, stroke 0.5s ease' }}
                />
                
                {/* Anomaly heat pulse overlay */}
                {hasAnomaly && (
                  <motion.rect
                    x={slot.x + 2} y={slot.y + 2} width={slot.w - 4} height={slot.h - 4} rx="8"
                    fill={`url(#anomaly-pulse-${uid})`}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                    mask={`url(#door-mask-${slot.id}-${uid})`}
                    pointerEvents="none"
                  />
                )}

                {/* Door Arc */}
                <g stroke="rgba(148,163,184,0.7)" strokeWidth="1.5" fill="none">
                  <line x1={slot.x + slot.w / 2 - 25} y1={slot.y + slot.h} x2={slot.x + slot.w / 2 - 25} y2={slot.y + slot.h + 50} />
                  <path strokeDasharray="4,4" d={`M ${slot.x + slot.w / 2 + 25} ${slot.y + slot.h} A 50 50 0 0 0 ${slot.x + slot.w / 2 - 25} ${slot.y + slot.h + 50}`} />
                </g>

                {/* Room label and aggregate stats */}
                <text x={slot.x + 12} y={slot.y + 22} fill="rgba(226,232,240,0.85)" fontSize="13" fontWeight="600">
                  {slot.label}
                </text>
                {meta && (
                  <text x={slot.x + slot.w - 12} y={slot.y + 22} fill={hasAnomaly ? 'rgba(239,68,68,0.9)' : 'rgba(148,163,184,0.9)'} fontSize="11" textAnchor="end" fontWeight={hasAnomaly ? 'bold' : 'normal'}>
                    {meta.onCount}/{meta.totalDevices} ON · {Math.round(meta.powerWatts)}W
                  </text>
                )}

                {/* Decorative Table */}
                <rect x={slot.x + slot.w / 2 - 55} y={slot.y + slot.h / 2 - 25} width="110" height="60" rx="6"
                  fill="rgba(56,189,248,0.08)" stroke="rgba(56,189,248,0.35)" strokeWidth="1.5" />
                {/* Decorative Chairs */}
                {[
                  { cx: -75, cy: 5 }, { cx: 75, cy: 5 },
                  { cx: -30, cy: -50 }, { cx: 30, cy: -50 },
                  { cx: -30, cy: 60 }, { cx: 30, cy: 60 }
                ].map((c, i) => (
                  <circle key={i}
                    cx={slot.x + slot.w / 2 + c.cx} cy={slot.y + slot.h / 2 + c.cy}
                    r="10" fill="rgba(148,163,184,0.15)" stroke="rgba(148,163,184,0.5)" strokeWidth="1.2" />
                ))}

                {/* ── LIGHTS ─────────────────────────────────────── */}
                {lightSlots.map((pos, idx) => {
                  const id = `${slot.id}-light-${idx + 1}`;
                  const dev = byId.get(id);
                  const on = dev?.status === 'on';
                  const cx = slot.x + pos.x;
                  const cy = slot.y + pos.y;
                  const isHovered = hoverId === id;

                  return (
                    <g
                      key={id}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoverId(id)}
                      onMouseLeave={() => setHoverId(null)}
                      onClick={() => setSelectedId(id)}
                    >
                      {/* Large ambient bloom */}
                      {on && (
                        <motion.circle
                          cx={cx} cy={cy} r={isHovered ? 44 : 36}
                          fill={`url(#light-bloom-${uid})`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0.6, 1, 0.6] }}
                          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      )}

                      {/* Expanding halo ring 1 */}
                      {on && (
                        <motion.circle
                          cx={cx} cy={cy} r="10"
                          fill="none"
                          stroke="rgba(253,224,71,0.5)"
                          strokeWidth="1.5"
                          initial={{ r: 10, opacity: 0.7 }}
                          animate={{ r: 32, opacity: 0 }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                        />
                      )}

                      {/* Expanding halo ring 2 (offset) */}
                      {on && (
                        <motion.circle
                          cx={cx} cy={cy} r="10"
                          fill="none"
                          stroke="rgba(253,224,71,0.3)"
                          strokeWidth="1"
                          initial={{ r: 10, opacity: 0.5 }}
                          animate={{ r: 42, opacity: 0 }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.7 }}
                        />
                      )}

                      {/* Bulb body */}
                      <motion.circle
                        cx={cx} cy={cy}
                        r={isHovered ? 9 : 7}
                        fill={on ? '#fde047' : '#334155'}
                        stroke={on ? 'rgba(253,224,71,0.8)' : 'rgba(148,163,184,0.3)'}
                        strokeWidth="2"
                        animate={on ? {
                          filter: ['drop-shadow(0 0 4px rgba(253,224,71,0.6))', 'drop-shadow(0 0 10px rgba(253,224,71,0.9))', 'drop-shadow(0 0 4px rgba(253,224,71,0.6))']
                        } : {}}
                        transition={{ duration: 2.2, repeat: on ? Infinity : 0 }}
                      />

                      {/* Filament highlight */}
                      {on && (
                        <circle cx={cx - 1.5} cy={cy - 1.5} r="2" fill="rgba(255,255,255,0.7)" />
                      )}

                      <text
                        x={cx} y={cy + (isHovered ? 26 : 22)}
                        fill={isHovered ? '#fff' : 'rgba(148,163,184,0.85)'}
                        fontSize="9" textAnchor="middle"
                        className="pointer-events-none"
                      >
                        L{idx + 1}
                      </text>
                    </g>
                  );
                })}

                {/* ── FANS ───────────────────────────────────────── */}
                {fanSlots.map((pos, idx) => {
                  const id = `${slot.id}-fan-${idx + 1}`;
                  const dev = byId.get(id);
                  const on = dev?.status === 'on';
                  const wattage = dev?.wattage || 75;
                  const cx = slot.x + pos.x;
                  const cy = slot.y + pos.y;
                  const isHovered = hoverId === id;
                  // Faster spin for higher wattage
                  const spinDuration = Math.max(0.55, 1.3 - (wattage / 220));

                  return (
                    <g
                      key={id}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoverId(id)}
                      onMouseLeave={() => setHoverId(null)}
                      onClick={() => setSelectedId(id)}
                    >
                      {/* Outer glow ring when on */}
                      {on && (
                        <motion.circle
                          cx={cx} cy={cy} r={isHovered ? 34 : 30}
                          fill={`url(#fan-glow-${uid})`}
                          animate={{ opacity: [0.4, 0.8, 0.4] }}
                          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      )}

                      {/* Fan housing circle */}
                      <circle
                        cx={cx} cy={cy}
                        r={isHovered ? 27 : 24}
                        fill={isHovered ? 'rgba(30,41,59,0.95)' : 'rgba(15,23,42,0.75)'}
                        stroke={on ? 'rgba(56,189,248,0.85)' : 'rgba(100,116,139,0.4)'}
                        strokeWidth={on ? '2' : '1.5'}
                      />

                      {/* Spinning 3-blade fan */}
                      <motion.g
                        style={{ transformOrigin: `${cx}px ${cy}px` }}
                        animate={on ? { rotate: 360 } : { rotate: 0 }}
                        transition={
                          on
                            ? { repeat: Infinity, duration: spinDuration, ease: 'linear' }
                            : { duration: 1.0, ease: [0.25, 0, 0.5, 1] }
                        }
                      >
                        {/* 3 blades at 120° spacing */}
                        {[0, 120, 240].map((angle) => (
                          <g key={angle} transform={`rotate(${angle} ${cx} ${cy})`}>
                            <ellipse
                              cx={cx} cy={cy - 10}
                              rx="5" ry="9"
                              fill={on ? 'rgba(56,189,248,0.88)' : 'rgba(100,116,139,0.55)'}
                            />
                            {/* Blade sheen */}
                            <ellipse
                              cx={cx - 1.2} cy={cy - 12}
                              rx="1.8" ry="4"
                              fill={on ? 'rgba(255,255,255,0.35)' : 'transparent'}
                            />
                          </g>
                        ))}

                        {/* Center hub */}
                        <circle cx={cx} cy={cy} r="4.5" fill={on ? '#38bdf8' : '#475569'} />
                        <circle cx={cx} cy={cy} r="2" fill={on ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.1)'} />
                      </motion.g>

                      {/* F label */}
                      <text
                        x={cx} y={cy + (isHovered ? 42 : 38)}
                        fill={isHovered ? '#fff' : 'rgba(148,163,184,0.85)'}
                        fontSize="9" textAnchor="middle"
                        className="pointer-events-none"
                      >
                        F{idx + 1}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          <text x="430" y="465" fill="rgba(148,163,184,0.6)" fontSize="10" textAnchor="middle" letterSpacing="3">
            — MAIN CORRIDOR —
          </text>
        </svg>

        {/* Selected Device Details Modal */}
        <AnimatePresence>
          {selectedDevice && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm"
              onClick={() => setSelectedId(null)}
            >
              <motion.div
                initial={{ scale: 0.92, y: 14 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.92, y: 14 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                className="w-72 rounded-2xl border border-white/10 bg-slate-900/95 p-5 shadow-2xl backdrop-blur-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-white">{selectedDevice.label}</h4>
                    <p className="text-xs capitalize text-slate-400">
                      {selectedDevice.room.replace(/-/g, ' ')} · {selectedDevice.type}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="rounded-full bg-white/5 p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                {/* Animated icon in modal */}
                <div className="mb-4 flex justify-center">
                  <div className={`grid h-16 w-16 place-items-center rounded-2xl ${
                    selectedDevice.status === 'on'
                      ? selectedDevice.type === 'fan'
                        ? 'bg-sky-500/15 shadow-[0_0_24px_rgba(56,189,248,0.3)]'
                        : 'bg-yellow-400/15 shadow-[0_0_24px_rgba(253,224,71,0.3)]'
                      : 'bg-white/5'
                  }`}>
                    {selectedDevice.type === 'fan'
                      ? <FanModalIcon on={selectedDevice.status === 'on'} wattage={selectedDevice.wattage} />
                      : <LightModalIcon on={selectedDevice.status === 'on'} />
                    }
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between border-b border-white/5 pb-2 text-sm">
                    <span className="text-slate-400">Status</span>
                    <motion.span
                      className={`font-semibold uppercase tracking-wider ${selectedDevice.status === 'on' ? (selectedDevice.type === 'fan' ? 'text-sky-400' : 'text-yellow-300') : 'text-slate-500'}`}
                      animate={selectedDevice.status === 'on' ? { opacity: [0.7, 1, 0.7] } : {}}
                      transition={{ duration: 1.8, repeat: Infinity }}
                    >
                      {selectedDevice.status}
                    </motion.span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2 text-sm">
                    <span className="text-slate-400">Power Draw</span>
                    <span className="font-medium text-white">
                      {selectedDevice.status === 'on' ? selectedDevice.wattage : 0} W
                    </span>
                  </div>
                  <div className="flex justify-between pb-1 text-sm">
                    <span className="text-slate-400">Last Changed</span>
                    <span className="font-medium text-slate-200">
                      {new Date(selectedDevice.lastChanged).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Hover Tooltip */}
      <AnimatePresence>
        {hoverDevice && !selectedDevice && (
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: -4 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none fixed z-50 rounded-lg border border-white/10 bg-slate-900/95 px-3 py-2 text-sm shadow-xl backdrop-blur-md"
            style={{ left: mousePos.x, top: mousePos.y }}
          >
            <div className="font-medium text-white">{hoverDevice.label}</div>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <motion.span
                className={`font-semibold uppercase ${hoverDevice.status === 'on' ? (hoverDevice.type === 'fan' ? 'text-sky-400' : 'text-yellow-300') : 'text-slate-500'}`}
                animate={hoverDevice.status === 'on' ? { opacity: [0.6, 1, 0.6] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {hoverDevice.status}
              </motion.span>
              <span className="text-slate-400">· {hoverDevice.status === 'on' ? hoverDevice.wattage : 0}W</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-5 text-xs text-slate-400">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-300 shadow-[0_0_8px_rgba(253,224,71,0.9)]" />
          Light ON
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
          Light OFF
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
          Fan ON
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
          Fan OFF
        </span>
      </div>
    </section>
  );
}

/** Large animated fan for the modal */
function FanModalIcon({ on, wattage = 75 }) {
  const duration = on ? Math.max(0.6, 1.4 - wattage / 220) : 0;
  return (
    <svg viewBox="0 0 48 48" width="48" height="48">
      {on && (
        <motion.circle cx="24" cy="24" r="22" fill="none" stroke="rgba(56,189,248,0.3)" strokeWidth="1"
          animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1.6, repeat: Infinity }} />
      )}
      <motion.g
        style={{ transformOrigin: '24px 24px' }}
        animate={on ? { rotate: 360 } : { rotate: 0 }}
        transition={on ? { repeat: Infinity, duration, ease: 'linear' } : { duration: 1 }}
      >
        {[0, 120, 240].map((angle) => (
          <g key={angle} transform={`rotate(${angle} 24 24)`}>
            <ellipse cx="24" cy="13" rx="6.5" ry="11" fill={on ? 'rgba(56,189,248,0.9)' : 'rgba(100,116,139,0.5)'} />
            <ellipse cx="22.5" cy="10" rx="2.5" ry="5" fill={on ? 'rgba(255,255,255,0.3)' : 'transparent'} />
          </g>
        ))}
        <circle cx="24" cy="24" r="5.5" fill={on ? '#38bdf8' : '#475569'} />
        <circle cx="24" cy="24" r="2.5" fill={on ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.1)'} />
      </motion.g>
    </svg>
  );
}

/** Large animated light for the modal */
function LightModalIcon({ on }) {
  return (
    <svg viewBox="0 0 48 48" width="48" height="48" style={{ overflow: 'visible' }}>
      {on && (
        <>
          <motion.circle cx="24" cy="20" r="14" fill="none" stroke="rgba(253,224,71,0.4)" strokeWidth="1.5"
            initial={{ r: 14, opacity: 0.8 }} animate={{ r: 28, opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }} />
          <motion.circle cx="24" cy="20" r="14" fill="none" stroke="rgba(253,224,71,0.25)" strokeWidth="1"
            initial={{ r: 14, opacity: 0.6 }} animate={{ r: 38, opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.8 }} />
        </>
      )}
      <motion.circle cx="24" cy="20" r="12"
        fill={on ? '#fde047' : '#334155'}
        stroke={on ? 'rgba(253,224,71,0.7)' : 'rgba(100,116,139,0.3)'}
        strokeWidth="2"
        animate={on ? { opacity: [0.85, 1, 0.85] } : {}}
        transition={{ duration: 2, repeat: on ? Infinity : 0 }}
      />
      {on && <circle cx="21" cy="17" r="4" fill="rgba(255,255,255,0.6)" />}
      <rect x="20" y="33" width="8" height="3" rx="1.5" fill={on ? 'rgba(253,224,71,0.5)' : 'rgba(100,116,139,0.4)'} />
      <rect x="21" y="37" width="6" height="3" rx="1.5" fill={on ? 'rgba(253,224,71,0.4)' : 'rgba(100,116,139,0.3)'} />
    </svg>
  );
}
