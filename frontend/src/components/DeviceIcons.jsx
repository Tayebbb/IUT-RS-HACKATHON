import { motion } from 'framer-motion';

/**
 * Animated spinning fan blade SVG using Framer Motion.
 * Speed (RPM) is proportional to wattage. Smooth spin-up/spin-down.
 */
export function FanIcon({ on = false, wattage = 75, size = 20 }) {
  // Map wattage to duration: 75W fan → 1.1s/rev, lighter → faster
  const duration = on ? Math.max(0.6, 1.4 - (wattage / 200)) : 0;

  return (
    <motion.svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{ display: 'block' }}
    >
      {/* Outer ring glow when on */}
      {on && (
        <motion.circle
          cx="12" cy="12" r="11"
          fill="none"
          stroke="rgba(56,189,248,0.35)"
          strokeWidth="1"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Spinning blade group */}
      <motion.g
        style={{ transformOrigin: '12px 12px' }}
        animate={on ? { rotate: 360 } : { rotate: 0 }}
        transition={
          on
            ? { repeat: Infinity, duration, ease: 'linear' }
            : { duration: 0.8, ease: [0.25, 0, 0.75, 1] }
        }
      >
        {/* 3 blades at 120° each */}
        {[0, 120, 240].map((angle) => (
          <g key={angle} transform={`rotate(${angle} 12 12)`}>
            {/* Blade teardrop shape */}
            <ellipse
              cx="12" cy="6.5"
              rx="3.2" ry="5.5"
              fill={on ? 'rgba(56,189,248,0.92)' : 'rgba(100,116,139,0.6)'}
            />
            {/* Blade highlight */}
            <ellipse
              cx="11.2" cy="5.5"
              rx="1.2" ry="2.5"
              fill={on ? 'rgba(255,255,255,0.35)' : 'transparent'}
            />
          </g>
        ))}

        {/* Center hub */}
        <circle
          cx="12" cy="12" r="2.8"
          fill={on ? '#38bdf8' : '#475569'}
        />
        <circle
          cx="12" cy="12" r="1.4"
          fill={on ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.1)'}
        />
      </motion.g>
    </motion.svg>
  );
}

/**
 * Animated light bulb with glowing filament and pulsing halo.
 */
export function LightIcon({ on = false, size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <radialGradient id={`bulb-glow-${on}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(253,224,71,1)" />
          <stop offset="100%" stopColor="rgba(253,224,71,0)" />
        </radialGradient>
      </defs>

      {/* Halo rings — only when on */}
      {on && (
        <>
          <motion.circle
            cx="12" cy="10" r="9"
            fill="none"
            stroke="rgba(253,224,71,0.25)"
            strokeWidth="1"
            initial={{ opacity: 0.6, scale: 0.8 }}
            animate={{ opacity: 0, scale: 1.5 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            style={{ transformOrigin: '12px 10px' }}
          />
          <motion.circle
            cx="12" cy="10" r="9"
            fill="none"
            stroke="rgba(253,224,71,0.15)"
            strokeWidth="1"
            initial={{ opacity: 0.4, scale: 0.8 }}
            animate={{ opacity: 0, scale: 2 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.8 }}
            style={{ transformOrigin: '12px 10px' }}
          />
        </>
      )}

      {/* Bulb body */}
      <motion.path
        d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"
        fill={on ? '#fde047' : '#475569'}
        animate={{ opacity: on ? 1 : 0.5 }}
        transition={{ duration: 0.4 }}
      />

      {/* Filament glow when on */}
      {on && (
        <motion.ellipse
          cx="12" cy="10" rx="3" ry="4"
          fill="url(#bulb-glow-true)"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </svg>
  );
}
