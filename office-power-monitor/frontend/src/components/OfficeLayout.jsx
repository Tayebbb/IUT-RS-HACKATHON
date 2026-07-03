import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Top-down office layout. Draws three rooms side-by-side with walls,
 * doors, a shared corridor, tables, chairs, ceiling lights, and fans.
 *
 * Highly interactive:
 * - Fans rotate while ON; lights glow while ON.
 * - Hover over devices for a quick tooltip.
 * - Click devices for a detailed modal overlay.
 *
 * @param {{devices: any[], rooms: any[]}} props
 */
export default function OfficeLayout({ devices = [], rooms = [] }) {
  const [hoverId, setHoverId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

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
    // Offset slightly so the cursor doesn't obscure the tooltip
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
            <pattern id="floor-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M20 0H0V20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            </pattern>
            <radialGradient id="light-on" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(253,224,71,1)" />
              <stop offset="60%" stopColor="rgba(253,224,71,0.35)" />
              <stop offset="100%" stopColor="rgba(253,224,71,0)" />
            </radialGradient>

            {/* Masks to cut doors into the solid walls */}
            {roomSlots.map((slot) => (
              <mask id={`door-mask-${slot.id}`} key={slot.id}>
                <rect x="0" y="0" width="860" height="480" fill="white" />
                {/* 50px door gap at the bottom center of each room */}
                <rect x={slot.x + slot.w / 2 - 25} y={slot.y + slot.h - 10} width="50" height="20" fill="black" />
              </mask>
            ))}
          </defs>

          <rect x="0" y="0" width="860" height="480" fill="url(#floor-grid)" />

          {/* Outer building outline */}
          <rect
            x="8"
            y="40"
            width="844"
            height="430"
            rx="12"
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
            const isHot = !!meta?.allOn;
            return (
              <g key={slot.id}>
                {/* Room walls (masked for doors) */}
                <rect
                  x={slot.x}
                  y={slot.y}
                  width={slot.w}
                  height={slot.h}
                  rx="10"
                  fill="rgba(15,23,42,0.55)"
                  stroke={isHot ? 'rgba(245,158,11,0.8)' : 'rgba(148,163,184,0.4)'}
                  strokeWidth="2.5"
                  mask={`url(#door-mask-${slot.id})`}
                />

                {/* Door Arc and Line */}
                <g stroke="rgba(148,163,184,0.7)" strokeWidth="1.5" fill="none">
                  {/* Door swung open */}
                  <line x1={slot.x + slot.w / 2 - 25} y1={slot.y + slot.h} x2={slot.x + slot.w / 2 - 25} y2={slot.y + slot.h + 50} />
                  {/* Swing path */}
                  <path strokeDasharray="4,4" d={`M ${slot.x + slot.w / 2 + 25} ${slot.y + slot.h} A 50 50 0 0 0 ${slot.x + slot.w / 2 - 25} ${slot.y + slot.h + 50}`} />
                </g>

                {/* Room label and aggregate stats */}
                <text x={slot.x + 12} y={slot.y + 22} fill="rgba(226,232,240,0.85)" fontSize="13" fontWeight="600">
                  {slot.label}
                </text>
                {meta && (
                  <text x={slot.x + slot.w - 12} y={slot.y + 22} fill="rgba(148,163,184,0.9)" fontSize="11" textAnchor="end">
                    {meta.onCount}/{meta.totalDevices} ON · {Math.round(meta.powerWatts)}W
                  </text>
                )}

                {/* Decorative Table */}
                <rect x={slot.x + slot.w / 2 - 55} y={slot.y + slot.h / 2 - 25} width="110" height="60" rx="6" fill="rgba(56,189,248,0.08)" stroke="rgba(56,189,248,0.35)" strokeWidth="1.5" />
                {/* Decorative Chairs */}
                {[
                  { cx: -75, cy: 5 },
                  { cx: 75, cy: 5 },
                  { cx: -30, cy: -50 },
                  { cx: 30, cy: -50 },
                  { cx: -30, cy: 60 },
                  { cx: 30, cy: 60 }
                ].map((c, i) => (
                  <circle key={i} cx={slot.x + slot.w / 2 + c.cx} cy={slot.y + slot.h / 2 + c.cy} r="10" fill="rgba(148,163,184,0.15)" stroke="rgba(148,163,184,0.5)" strokeWidth="1.2" />
                ))}

                {/* Lights */}
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
                      className="cursor-pointer transition-transform hover:scale-110"
                      onMouseEnter={() => setHoverId(id)}
                      onMouseLeave={() => setHoverId(null)}
                      onClick={() => setSelectedId(id)}
                    >
                      {on && (
                        <motion.circle cx={cx} cy={cy} r={isHovered ? 34 : 28} fill="url(#light-on)" initial={{ opacity: 0.5 }} animate={{ opacity: [0.5, 0.95, 0.5] }} transition={{ duration: 2.4, repeat: Infinity }} />
                      )}
                      <circle cx={cx} cy={cy} r={isHovered ? 9 : 7} fill={on ? '#fde047' : '#475569'} stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
                      <text x={cx} y={cy + (isHovered ? 26 : 22)} fill={isHovered ? '#fff' : 'rgba(148,163,184,0.85)'} fontSize="9" textAnchor="middle" className="pointer-events-none">
                        L{idx + 1}
                      </text>
                    </g>
                  );
                })}

                {/* Fans */}
                {fanSlots.map((pos, idx) => {
                  const id = `${slot.id}-fan-${idx + 1}`;
                  const dev = byId.get(id);
                  const on = dev?.status === 'on';
                  const cx = slot.x + pos.x;
                  const cy = slot.y + pos.y;
                  const isHovered = hoverId === id;
                  return (
                    <g
                      key={id}
                      className="cursor-pointer transition-transform hover:scale-105"
                      onMouseEnter={() => setHoverId(id)}
                      onMouseLeave={() => setHoverId(null)}
                      onClick={() => setSelectedId(id)}
                    >
                      <circle cx={cx} cy={cy} r={isHovered ? 29 : 26} fill={isHovered ? 'rgba(30,41,59,0.9)' : 'rgba(30,41,59,0.6)'} stroke={on ? 'rgba(56,189,248,0.8)' : 'rgba(148,163,184,0.4)'} strokeWidth="1.5" />
                      <motion.g style={{ transformOrigin: `${cx}px ${cy}px` }} animate={on ? { rotate: 360 } : { rotate: 0 }} transition={on ? { repeat: Infinity, duration: 1.1, ease: 'linear' } : { duration: 0.4 }}>
                        {[0, 60, 120, 180, 240, 300].map((angle) => (
                          <ellipse key={angle} cx={cx} cy={cy - 12} rx="4" ry="14" fill={on ? 'rgba(56,189,248,0.9)' : 'rgba(148,163,184,0.6)'} transform={`rotate(${angle} ${cx} ${cy})`} />
                        ))}
                        <circle cx={cx} cy={cy} r="4" fill={on ? '#38bdf8' : '#64748b'} />
                      </motion.g>
                      <text x={cx} y={cy + (isHovered ? 44 : 40)} fill={isHovered ? '#fff' : 'rgba(148,163,184,0.85)'} fontSize="9" textAnchor="middle" className="pointer-events-none">
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

        {/* Selected Device Details Modal (Glass Overlay) */}
        <AnimatePresence>
          {selectedDevice && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm"
              onClick={() => setSelectedId(null)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                className="w-72 rounded-2xl border border-white/10 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-xl"
                onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside modal
              >
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-white">{selectedDevice.label}</h4>
                    <p className="text-xs capitalize text-slate-400">{selectedDevice.room.replace(/-/g, ' ')}</p>
                  </div>
                  <button onClick={() => setSelectedId(null)} className="rounded-full bg-white/5 p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
                    ✕
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between border-b border-white/5 pb-2 text-sm">
                    <span className="text-slate-400">Status</span>
                    <span className={`font-medium uppercase tracking-wider ${selectedDevice.status === 'on' ? 'text-accent-400' : 'text-slate-500'}`}>
                      {selectedDevice.status}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2 text-sm">
                    <span className="text-slate-400">Power Draw</span>
                    <span className="font-medium text-white">{selectedDevice.status === 'on' ? selectedDevice.wattage : 0} W</span>
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

      {/* Floating Hover Tooltip (Portaled to mouse coordinates) */}
      <AnimatePresence>
        {hoverDevice && !selectedDevice && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none fixed z-50 rounded-lg border border-white/10 bg-slate-900/95 px-3 py-2 text-sm shadow-xl backdrop-blur-md"
            style={{ left: mousePos.x, top: mousePos.y }}
          >
            <div className="font-medium text-white">{hoverDevice.label}</div>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span className={`uppercase ${hoverDevice.status === 'on' ? 'text-accent-400' : 'text-slate-500'}`}>
                {hoverDevice.status}
              </span>
              <span className="text-slate-400">· {hoverDevice.status === 'on' ? hoverDevice.wattage : 0}W</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-yellow-300 shadow-[0_0_8px_rgba(253,224,71,0.8)]" /> Light ON</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-500" /> Light OFF</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent-400" /> Fan ON</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-500" /> Fan OFF</span>
      </div>
    </section>
  );
}
