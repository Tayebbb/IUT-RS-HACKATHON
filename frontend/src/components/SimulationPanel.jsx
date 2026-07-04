import { useEffect, useState } from 'react';

export default function SimulationPanel({ simulatedDevices }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSim = async () => {
      setLoading(true);
      try {
        const res = await fetch(import.meta.env.VITE_BACKEND_URL + '/api/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ simulatedDevices })
        });
        const json = await res.json();
        if (json.success) {
          setResult(json.data);
        }
      } catch (err) {
        console.error('Simulation failed', err);
      } finally {
        setLoading(false);
      }
    };

    // Simple debounce
    const timer = setTimeout(fetchSim, 300);
    return () => clearTimeout(timer);
  }, [simulatedDevices]);

  if (!result) {
    return null;
  }

  const isSaving = result.savedWatts > 0;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-blue-500/30 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 w-[90%] max-w-xl">
      <div className="bg-blue-600/20 px-4 py-3 border-b border-blue-500/20 flex items-center justify-between">
        <h3 className="font-semibold text-blue-400 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
            ></path>
          </svg>
          Digital Twin Lite (Simulation Mode)
        </h3>
        {loading && (
          <div className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
        )}
      </div>

      <div className="p-4 grid grid-cols-3 gap-4 divide-x divide-white/5">
        <div className="flex flex-col">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">
            Live Cost (Run Rate)
          </span>
          <span className="text-xl font-bold text-white">
            {result.liveMonthlyBdt.toFixed(0)} BDT
            <span className="text-sm font-normal text-slate-400">/mo</span>
          </span>
          <span className="text-xs text-slate-500 mt-1">{result.livePowerWatts} W currently</span>
        </div>

        <div className="flex flex-col pl-4">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">
            Simulated Cost
          </span>
          <span className="text-xl font-bold text-white">
            {result.simMonthlyBdt.toFixed(0)} BDT
            <span className="text-sm font-normal text-slate-400">/mo</span>
          </span>
          <span className="text-xs text-slate-500 mt-1">{result.simPowerWatts} W projected</span>
        </div>

        <div className="flex flex-col pl-4">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">
            Projected Savings
          </span>
          <span className={`text-xl font-bold ${isSaving ? 'text-emerald-400' : 'text-slate-300'}`}>
            {isSaving ? '-' : ''}
            {result.savedMonthlyBdt.toFixed(0)} BDT
          </span>
          <span className="text-xs text-slate-500 mt-1">
            {isSaving ? `Prevents ${result.savedWatts}W of waste` : 'No net savings'}
          </span>
        </div>
      </div>

      {result.simulatedAlerts.length > 0 && (
        <div className="bg-red-500/10 border-t border-red-500/10 px-4 py-2">
          <p className="text-xs text-red-400">
            <strong>Warning:</strong> The simulated state would trigger{' '}
            {result.simulatedAlerts.length} alert(s) (e.g. {result.simulatedAlerts[0].message})
          </p>
        </div>
      )}
    </div>
  );
}
