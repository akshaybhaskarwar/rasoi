import { useEffect, useCallback, useRef } from 'react';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * Hook for real-time synchronization using Server-Sent Events (SSE)
 * Connects to the backend SSE stream and triggers callbacks on events
 */
export const useRealtimeSync = ({
  onShoppingChange,
  onInventoryChange,
  onMealPlanChange,
  enabled = true
}) => {
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const connect = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    if (!token || !enabled) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const url = `${API}/api/sse/stream?token=${encodeURIComponent(token)}`;
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[SSE] Connected to real-time stream');
      };

      eventSource.onerror = (error) => {
        console.error('[SSE] Connection error:', error);
        eventSource.close();
        
        // Attempt reconnection after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[SSE] Attempting reconnection...');
          connect();
        }, 5000);
      };

      // Connected event
      eventSource.addEventListener('connected', (e) => {
        const data = JSON.parse(e.data);
        console.log('[SSE] Connected with ID:', data.connection_id);
      });

      // Shopping events
      eventSource.addEventListener('shopping_add', (e) => {
        const data = JSON.parse(e.data);
        console.log('[SSE] Shopping item added:', data);
        onShoppingChange?.('add', data);
      });

      eventSource.addEventListener('shopping_update', (e) => {
        const data = JSON.parse(e.data);
        console.log('[SSE] Shopping item updated:', data);
        onShoppingChange?.('update', data);
      });

      eventSource.addEventListener('shopping_delete', (e) => {
        const data = JSON.parse(e.data);
        console.log('[SSE] Shopping item deleted:', data);
        onShoppingChange?.('delete', data);
      });

      eventSource.addEventListener('shopping_status', (e) => {
        const data = JSON.parse(e.data);
        console.log('[SSE] Shopping status changed:', data);
        onShoppingChange?.('status', data);
      });

      // Inventory events
      eventSource.addEventListener('inventory_add', (e) => {
        const data = JSON.parse(e.data);
        console.log('[SSE] Inventory item added:', data);
        onInventoryChange?.('add', data);
      });

      eventSource.addEventListener('inventory_update', (e) => {
        const data = JSON.parse(e.data);
        console.log('[SSE] Inventory item updated:', data);
        onInventoryChange?.('update', data);
      });

      eventSource.addEventListener('inventory_delete', (e) => {
        const data = JSON.parse(e.data);
        console.log('[SSE] Inventory item deleted:', data);
        onInventoryChange?.('delete', data);
      });

      // Meal plan events
      eventSource.addEventListener('meal_plan_update', (e) => {
        const data = JSON.parse(e.data);
        console.log('[SSE] Meal plan updated:', data);
        onMealPlanChange?.('update', data);
      });

      // Keep-alive ping
      eventSource.addEventListener('ping', () => {
        // Just acknowledge the ping, no action needed
      });

      // Member online notification
      eventSource.addEventListener('member_online', (e) => {
        const data = JSON.parse(e.data);
        console.log('[SSE] Member came online:', data.data?.name);
      });

    } catch (error) {
      console.error('[SSE] Failed to create EventSource:', error);
    }
  }, [enabled, onShoppingChange, onInventoryChange, onMealPlanChange]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      console.log('[SSE] Disconnected');
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return { connect, disconnect };
};
