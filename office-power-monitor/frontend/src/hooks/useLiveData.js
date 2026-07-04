import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

/**
 * Single Socket.IO connection shared across the app. Exposed via a hook
 * that subscribes to all monitor streams and returns a consolidated
 * snapshot. The socket sends full snapshots on connect (backend
 * SocketBroadcaster), so we never need to poll.
 *
 * Listened Events:
 * - `devices:update`: Array of all raw device objects.
 * - `rooms:update`: Array of aggregated room summaries.
 * - `usage:update`: Live power metrics and energy estimates.
 * - `alerts:update`: Array of active/resolved system alerts.
 * - `incidents:update`: Array of aggregated incidents.
 * - `eco:action`: Eco-Mode auto-shutdown notification payload.
 */
export function useLiveData() {
  const [state, setState] = useState({
    connected: false,
    devices: [],
    rooms: [],
    usage: null,
    alerts: [],
    incidents: [],
    ecoNotifications: []
  });

  useEffect(() => {
    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true
    });

    const patch = (partial) => setState((s) => ({ ...s, ...partial }));

    socket.on('connect', () => patch({ connected: true }));
    socket.on('disconnect', () => patch({ connected: false }));
    socket.on('devices:update', (devices) => patch({ devices }));
    socket.on('rooms:update', (rooms) => patch({ rooms }));
    socket.on('usage:update', (usage) => patch({ usage }));
    socket.on('alerts:update', (alerts) => patch({ alerts }));
    socket.on('incidents:update', (incidents) => patch({ incidents }));
    socket.on('eco:action', (payload) => {
      setState((s) => ({
        ...s,
        ecoNotifications: [
          { ...payload, id: `${payload.roomId}-${Date.now()}` },
          ...s.ecoNotifications
        ].slice(0, 5) // Keep latest 5 only
      }));
    });

    return () => socket.close();
  }, []);

  return state;
}
