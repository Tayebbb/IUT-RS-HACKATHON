import { useState } from 'react';
import Header from './components/Header.jsx';
import SummaryCards from './components/SummaryCards.jsx';
import RoomCard from './components/RoomCard.jsx';
import PowerBreakdown from './components/PowerBreakdown.jsx';
import IncidentPanel from './components/IncidentPanel.jsx';
import OfficeLayout from './components/OfficeLayout.jsx';
import DemoControls from './components/DemoControls.jsx';
import EcoToast from './components/EcoToast.jsx';
import { useLiveData } from './hooks/useLiveData.js';

/**
 * Root layout: header, summary strip, room grid + power breakdown,
 * and the incidents/alerts panel on the right. All data comes from
 * a single Socket.IO connection.
 *
 * The Office Layout component (Module 11) will be mounted below the
 * room grid.
 */
export default function App() {
  const { connected, devices, rooms, usage, alerts, incidents, ecoNotifications } = useLiveData();
  const [dismissed, setDismissed] = useState(new Set());

  const visibleEcoNotifications = ecoNotifications.filter((n) => !dismissed.has(n.id));

  const handleDismiss = (id) => {
    setDismissed((prev) => new Set([...prev, id]));
  };

  return (
    <div className="min-h-screen bg-radial-fade">
      <div className="mx-auto max-w-[1400px] px-6 py-8">
        <Header connected={connected} />

        <SummaryCards usage={usage} alerts={alerts} />

        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <main className="space-y-6">
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rooms.map((room, idx) => (
                <RoomCard key={room.id} room={room} delay={idx * 0.05} />
              ))}
            </section>

            <OfficeLayout devices={devices} rooms={rooms} alerts={alerts} />

            <PowerBreakdown usage={usage} rooms={rooms} />
          </main>

          <IncidentPanel incidents={incidents} alerts={alerts} />
        </div>

        <footer className="mt-10 text-center text-xs text-slate-500">
          Office Power Monitor · Realtime IoT telemetry · {connected ? 'Connected' : 'Offline'}
        </footer>
        
        <DemoControls />
      </div>

      {/* Eco-Mode notification toasts — rendered outside main layout flow */}
      <EcoToast notifications={visibleEcoNotifications} onDismiss={handleDismiss} />
    </div>
  );
}
