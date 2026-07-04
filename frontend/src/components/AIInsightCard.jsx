import { motion, AnimatePresence } from 'framer-motion';

/**
 * Typewriter effect hook — reveals text character by character.
 */
import { useState, useEffect } from 'react';

function useTypewriter(text, speed = 18) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    if (!text) { setDisplayed(''); return; }
    setDisplayed('');
    let i = 0;
    const timer = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i += 1;
      if (i >= text.length) {clearInterval(timer);}
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);
  return displayed;
}

/**
 * Pulsing "Analysing…" skeleton shown while the LLM is generating.
 */
function AnalysingSkeleton() {
  return (
    <div className="mt-2 space-y-1.5">
      {[80, 95, 60].map((w, i) => (
        <motion.div
          key={i}
          className="h-2.5 rounded-full bg-cyan-400/20"
          style={{ width: `${w}%` }}
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
      <div className="mt-2 flex items-center gap-1.5">
        <motion.div
          className="h-1.5 w-1.5 rounded-full bg-cyan-400"
          animate={{ scale: [1, 1.6, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.9, repeat: Infinity }}
        />
        <span className="text-[10px] tracking-widest text-cyan-400/70 uppercase">AI Analysing…</span>
      </div>
    </div>
  );
}

/**
 * Renders the AI insight text with a typewriter reveal.
 */
function InsightText({ text }) {
  const displayed = useTypewriter(text, 14);
  return (
    <p className="mt-2 text-[12px] leading-relaxed text-slate-200/90">
      {displayed}
      {displayed.length < text.length && (
        <motion.span
          className="ml-0.5 inline-block h-3 w-0.5 bg-cyan-400"
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
      )}
    </p>
  );
}

/**
 * AI Insight card — shown inside an alert item when aiInsight is available
 * or pending. Shows a shimmer skeleton while waiting, then types out the
 * LLM-generated explanation with a cursor animation.
 *
 * @param {{ insight: string|null, isPowerAnomaly: boolean }} props
 */
export default function AIInsightCard({ insight, isPowerAnomaly }) {
  if (!isPowerAnomaly) {return null;}

  return (
    <AnimatePresence>
      <motion.div
        key="ai-card"
        initial={{ opacity: 0, height: 0, marginTop: 0 }}
        animate={{ opacity: 1, height: 'auto', marginTop: 10 }}
        exit={{ opacity: 0, height: 0, marginTop: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="overflow-hidden rounded-xl border border-cyan-500/25 bg-cyan-950/40 px-3 py-2.5"
        style={{ backdropFilter: 'blur(8px)' }}
      >
        {/* Header badge */}
        <div className="flex items-center gap-2">
          {/* Animated glow dot */}
          <motion.div
            className="h-2 w-2 flex-shrink-0 rounded-full bg-cyan-400"
            animate={insight ? { scale: 1, opacity: 1 } : { scale: [1, 1.5, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.2, repeat: insight ? 0 : Infinity }}
          />
          <span className="bg-gradient-to-r from-cyan-300 to-purple-400 bg-clip-text text-[10px] font-semibold uppercase tracking-widest text-transparent">
            AI Power Analyst
          </span>

          {/* Shimmer sweep on the badge when loading */}
          {!insight && (
            <motion.div
              className="ml-auto h-4 w-16 overflow-hidden rounded-full bg-cyan-500/10"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.1, repeat: Infinity }}
            />
          )}
        </div>

        {/* Content area */}
        {insight ? (
          <InsightText text={insight} />
        ) : (
          <AnalysingSkeleton />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
