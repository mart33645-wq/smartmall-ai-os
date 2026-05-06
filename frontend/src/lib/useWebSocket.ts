import { useCallback, useEffect, useRef } from 'react';

import { useStore } from '../store/useStore';
import { wsUrl } from './api';

export function useWebSocket() {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const shouldReconnectRef = useRef(false);
  const connectRef = useRef<() => void>(() => {});

  // Select each value separately to avoid creating new objects per render.
  const addAlert = useStore(state => state.addAlert);
  const updateShop = useStore(state => state.updateShop);
  const mergeParkingSlot = useStore(state => state.mergeParkingSlot);
  const user = useStore(state => state.user);

  const connect = useCallback(() => {
    if (!shouldReconnectRef.current) return;
    if (
      socketRef.current?.readyState === WebSocket.OPEN ||
      socketRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    const socket = new WebSocket(wsUrl());

    socket.onopen = () => {
      console.log('Connected to SmartMall Global Network');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'ALERT':
          case 'ALERT_NEW': {
            const alertData = data.payload || data.alert;
            if (alertData) {
              addAlert(alertData);
            }
            break;
          }

          case 'SHOP_UPDATE': {
            const shopId = data.shop_id || data.payload?.id;
            const changes = data.changes || data.payload;
            if (shopId) updateShop(shopId, changes);
            break;
          }

          case 'SHOP_DELETED':
            if (data.payload?.id) useStore.getState().removeShop(data.payload.id);
            break;

          case 'PARKING_UPDATE': {
            const slot = data.slot || data.payload?.slot;
            if (slot) mergeParkingSlot(slot);
            if (data.payload?.stats) useStore.getState().setParkingStats(data.payload.stats);
            break;
          }

          case 'ALERT_RESOLVED':
            if (data.payload?.id) useStore.getState().resolveAlert(data.payload.id);
            break;

          case 'ALERT_DELETED':
            if (data.payload?.id) useStore.getState().removeAlert(data.payload.id);
            break;

          default:
            console.debug('Unhandled WS message type:', data.type);
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    socket.onclose = () => {
      if (!shouldReconnectRef.current) {
        return;
      }
      console.log('Disconnected from SmartMall network. Retrying...');
      reconnectTimerRef.current = window.setTimeout(() => connectRef.current(), 5000);
    };

    socket.onerror = (err) => {
      console.error('WS Error:', err);
      socket.close();
    };

    socketRef.current = socket;
  }, [addAlert, updateShop, mergeParkingSlot]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    if (user) {
      shouldReconnectRef.current = true;
      connect();
    } else {
      shouldReconnectRef.current = false;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      socketRef.current?.close();
      socketRef.current = null;
    }

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [user, connect]);

  // This hook manages websocket side-effects only.
}
