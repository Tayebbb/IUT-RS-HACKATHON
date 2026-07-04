import { useState } from 'react';
import Header from './components/Header.jsx';
import SummaryCards from './components/SummaryCards.jsx';
import RoomCard from './components/RoomCard.jsx';
import PowerBreakdown from './components/PowerBreakdown.jsx';
import IncidentPanel from './components/IncidentPanel.jsx';
import OfficeLayout from './components/OfficeLayout.jsx';
import DemoControls from './components/DemoControls.jsx';
import EcoToast from './components/EcoToast.jsx';
import SimulationPanel from './components/SimulationPanel.jsx';
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

  const [isSimMode, setIsSimMode] = useState(false);
  const [simulatedDevices, setSimulatedDevices] = useState([]);

  const handleToggleSimMode = () => {
    if (isSimMode) {
      setIsSimMode(false);
      setSimulatedDevices([]);
    } else {
      setIsSimMode(true);
      // Deep clone the live devices
      setSimulatedDevices(JSON.parse(JSON.stringify(devices)));
    }
  };

  const handleDeviceToggle = (deviceId) => {
    if (!isSimMode) {
      return;
    }
    setSimulatedDevices((prev) =>
      prev.map((d) => {
        if (d.id === deviceId) {
          const nextStatus = d.status === 'on' ? 'off' : 'on';
          return { ...d, status: nextStatus, power: nextStatus === 'on' ? d.wattage : 0 };
        }
        return d;
      })
    );
  };

  return (
    <div className="min-h-screen bg-radial-fade">
      <div className="mx-auto max-w-[1400px] px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <Header connected={connected} />
          <button
            onClick={handleToggleSimMode}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
              isSimMode
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            {isSimMode ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                  ></path>
                </svg>
                Exit Simulation
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                  ></path>
                </svg>
                Digital Twin
              </>
            )}
          </button>
        </div>

        <SummaryCards usage={usage} alerts={alerts} />

        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <main className="space-y-6">
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rooms.map((room, idx) => (
                <RoomCard key={room.id} room={room} delay={idx * 0.05} />
              ))}
            </section>

            <OfficeLayout
              devices={isSimMode ? simulatedDevices : devices}
              rooms={rooms}
              alerts={alerts}
              isSimMode={isSimMode}
              onDeviceToggle={handleDeviceToggle}
            />

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

      {/* Simulation Panel overlay */}
      {isSimMode && <SimulationPanel simulatedDevices={simulatedDevices} />}
    </div>
  );
}
