'use client';

import { useAppConfig } from '@/hooks/use-app-config';
import { solanaWebSocketService } from '@/lib/solana-websocket-service';
import { useEffect, useRef, useState } from 'react';

interface CompactSlotWidgetProps {
  className?: string;
}

const TOTAL_CIRCLES = 72; // 3 rows x 24 columns
const ACTIVE_SLOT_COLOR = '#62D595';
const INACTIVE_SLOT_COLOR = '#2F2F32';
const DISCONNECTED_SLOT_COLOR = '#ef4444'; // red-500

export default function CompactSlotWidget({ className = '' }: CompactSlotWidgetProps) {
  const { rpcUrl, wsUrl } = useAppConfig();
  const [slotHeight, setSlotHeight] = useState<number>(0);
  const [epoch, setEpoch] = useState<number>(0);
  const [epochProgress, setEpochProgress] = useState<number>(0);
  const [currentRect, setCurrentRect] = useState<number>(0);
  const [filledRects, setFilledRects] = useState<Set<number>>(new Set());
  const [slotsInEpoch, setSlotsInEpoch] = useState<number>(432000);
  const [isClockPaused, setIsClockPaused] = useState<boolean>(false);
  const [dimmingPhase, setDimmingPhase] = useState<number>(0);
  const [isDisconnected, setIsDisconnected] = useState<boolean>(false);
  const lastSlotReceivedRef = useRef<number>(Date.now());
  const isClockPausedRef = useRef<boolean>(false);

  // Keep ref in sync with state
  useEffect(() => {
    isClockPausedRef.current = isClockPaused;
  }, [isClockPaused]);

  // Fetch initial epoch data
  useEffect(() => {
    const fetchEpochData = async () => {
      try {
        const epochResponse = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getEpochInfo',
          }),
        });
        const epochData = await epochResponse.json();
        if (epochData.result) {
          setEpoch(epochData.result.epoch);
          setSlotHeight(epochData.result.slotIndex);
          setSlotsInEpoch(epochData.result.slotsInEpoch);
          const progress = (epochData.result.slotIndex / epochData.result.slotsInEpoch) * 100;
          setEpochProgress(progress);
        }
      } catch (error) {
        console.error('Error fetching epoch info:', error);
      }
    };

    fetchEpochData();
  }, [rpcUrl]);

  // WebSocket subscription for slot updates - persistent across page changes
  useEffect(() => {
    let subscriptionId: string | null = null;
    let reconnectInterval: NodeJS.Timeout | null = null;
    let isSubscribing = false;

    const startSlotSubscription = async () => {
      // Prevent multiple concurrent subscription attempts
      if (isSubscribing) {
        console.log('CompactSlotWidget: Subscription already in progress, skipping...');
        return;
      }

      try {
        isSubscribing = true;
        console.log('CompactSlotWidget: Connecting to WebSocket...');

        // Unsubscribe from any existing subscription before creating a new one
        if (subscriptionId) {
          console.log('CompactSlotWidget: Cleaning up old subscription before reconnecting...');
          try {
            solanaWebSocketService.unsubscribeAll();
          } catch (err) {
            console.warn('CompactSlotWidget: Error cleaning up old subscription:', err);
          }
          subscriptionId = null;
        }

        await solanaWebSocketService.connect(wsUrl);
        subscriptionId = await solanaWebSocketService.subscribeToSlots();
        console.log('CompactSlotWidget: Subscribed to slots with ID:', subscriptionId);
        isSubscribing = false;
      } catch (error) {
        isSubscribing = false;
        console.error('CompactSlotWidget: Error starting slot subscription:', error);
        // Retry connection after 2 seconds
        setTimeout(startSlotSubscription, 2000);
      }
    };

    startSlotSubscription();

    // Watchdog: Check if we're still receiving slots, reconnect if not
    reconnectInterval = setInterval(() => {
      const timeSinceLastSlot = Date.now() - lastSlotReceivedRef.current;
      // If no slot received in 5 seconds, reconnect
      if (timeSinceLastSlot > 5000) {
        console.log('CompactSlotWidget: No slots received for 5s, reconnecting...');
        startSlotSubscription();
      }
    }, 5000);

    // Don't unsubscribe on cleanup - keep the connection alive
    // This widget is always visible in the header
    return () => {
      if (reconnectInterval) clearInterval(reconnectInterval);
      isSubscribing = false;
      // Keep subscription alive across page navigations
    };
  }, [wsUrl]);

  // Listen for slot events
  useEffect(() => {
    const handleSlot = (data: any) => {
      if (data?.parent && data?.root) {
        const newSlot = data.parent;
        const slotIndexInEpoch = newSlot % slotsInEpoch;

        // Update last received timestamp (using ref to avoid re-renders)
        lastSlotReceivedRef.current = Date.now();

        setSlotHeight(slotIndexInEpoch);

        // Calculate epoch progress
        const progress = (slotIndexInEpoch / slotsInEpoch) * 100;
        setEpochProgress(progress);

        // Update animation - move to next circle and add current to trail
        setCurrentRect((prev) => {
          const nextRect = (prev + 1) % TOTAL_CIRCLES;

          // Add the previous circle to trail
          setFilledRects((prevRects) => {
            const nextRects = new Set(prevRects);
            nextRects.add(prev);

            // Reset trail if we're at the end
            if (nextRect === 0) {
              return new Set();
            }

            return nextRects;
          });

          return nextRect;
        });
      }
    };

    solanaWebSocketService.on('slot', handleSlot);

    return () => {
      solanaWebSocketService.off('slot', handleSlot);
    };
  }, [slotsInEpoch]);

  // Listen for WebSocket connection status
  useEffect(() => {
    const handleConnected = () => {
      console.log('CompactSlotWidget: WebSocket connected');
      setIsDisconnected(false);
    };

    const handleDisconnected = () => {
      console.log('CompactSlotWidget: WebSocket disconnected');
      setIsDisconnected(true);
    };

    // Listen for WebSocket connection events
    solanaWebSocketService.on('connected', handleConnected);
    solanaWebSocketService.on('disconnected', handleDisconnected);

    // Check initial connection status
    setIsDisconnected(!solanaWebSocketService.isConnected());

    return () => {
      solanaWebSocketService.off('connected', handleConnected);
      solanaWebSocketService.off('disconnected', handleDisconnected);
    };
  }, []);

  // Listen for global pause state changes from other components
  useEffect(() => {
    const handlePauseChange = (event: CustomEvent) => {
      console.log('CompactSlotWidget: Received pause state change:', event.detail.isPaused);
      setIsClockPaused(event.detail.isPaused);
    };

    window.addEventListener('clockPauseStateChanged', handlePauseChange as EventListener);

    return () => {
      window.removeEventListener('clockPauseStateChanged', handlePauseChange as EventListener);
    };
  }, []);

  // Listen for epoch changes (e.g., from time travel)
  useEffect(() => {
    const handleEpochChange = (event: CustomEvent) => {
      console.log('CompactSlotWidget: Received epoch change:', event.detail);
      if (event.detail.epoch !== undefined) {
        setEpoch(event.detail.epoch);
      }
      if (event.detail.slotIndex !== undefined) {
        setSlotHeight(event.detail.slotIndex);
        // Recalculate progress with the new slot index
        const progress = (event.detail.slotIndex / slotsInEpoch) * 100;
        setEpochProgress(progress);
      }
    };

    window.addEventListener('epochChanged', handleEpochChange as EventListener);

    return () => {
      window.removeEventListener('epochChanged', handleEpochChange as EventListener);
    };
  }, [slotsInEpoch]);

  // Blinking animation when clock is paused
  useEffect(() => {
    if (!isClockPaused) {
      setDimmingPhase(1); // Reset to visible when not paused
      return;
    }

    const blinkInterval = setInterval(() => {
      setDimmingPhase((prev) => (prev === 0 ? 1 : 0));
    }, 500); // Blink every 500ms

    return () => clearInterval(blinkInterval);
  }, [isClockPaused]);

  // Helper to determine circle color with blinking effect
  const getCircleColor = (index: number) => {
    const isFilled = index === currentRect || filledRects.has(index);

    // If disconnected, show red for filled dots
    if (isDisconnected) {
      return isFilled ? DISCONNECTED_SLOT_COLOR : INACTIVE_SLOT_COLOR;
    }

    if (!isFilled) {
      return INACTIVE_SLOT_COLOR;
    }

    // Apply blinking effect when clock is paused
    if (isClockPaused && dimmingPhase === 0) {
      return INACTIVE_SLOT_COLOR; // Blink off
    }

    return ACTIVE_SLOT_COLOR;
  };

  return (
    <div
      className={`flex items-center rounded-full border ${
        isDisconnected
          ? 'border-red-500/30 bg-red-900/20'
          : 'border-zinc-200/40 bg-white max-lg:bg-zinc-100 dark:border-zinc-700/30 dark:bg-zinc-900 max-lg:dark:bg-zinc-800'
      } ${className} gap-2 px-3 py-2.5 max-w-[280px] lg:gap-3 lg:px-4 lg:py-2 lg:w-[400px] lg:max-w-none`}
    >
      {/* Mini Slot Grid - 3 rows x 6 columns on mobile, 24 columns on desktop */}
      <div className="flex flex-col gap-0.5 lg:gap-0.5">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex gap-0.5 lg:gap-0.5">
            {/* Mobile: 6 columns */}
            {Array.from({ length: 6 }).map((_, col) => {
              const index = row * 24 + col * 4; // Sample every 4th dot to maintain animation continuity
              const color = getCircleColor(index);
              return (
                <div
                  key={`${row}-${col}`}
                  className="h-1.5 w-1.5 rounded-full lg:hidden"
                  style={{
                    backgroundColor: color,
                  }}
                />
              );
            })}
            {/* Desktop: 24 columns */}
            {Array.from({ length: 24 }).map((_, col) => {
              const index = row * 24 + col;
              const color = getCircleColor(index);
              return (
                <div
                  key={`${row}-${col}-desktop`}
                  className="hidden h-1 w-1 rounded-full lg:block"
                  style={{
                    backgroundColor: color,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Slot Height */}
      <div className="flex items-center gap-1.5">
        <span
          className={`text-[11px] font-medium tracking-wide uppercase lg:text-[10px] ${
            isDisconnected ? 'text-red-300' : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          Slot
        </span>
        <span
          className={`font-mono text-sm font-semibold lg:text-xs ${
            isDisconnected ? 'text-red-300' : 'text-zinc-950 dark:text-zinc-50'
          }`}
        >
          {slotHeight.toLocaleString()}
        </span>
      </div>

      {/* Separator */}
      <div className={`h-4 w-px lg:h-3 ${isDisconnected ? 'bg-red-500/30' : 'bg-zinc-200/60 dark:bg-zinc-700/60'}`} />

      {/* Epoch with circular progress */}
      <div className="flex items-center gap-2">
        <span
          className={`hidden text-[10px] font-medium tracking-wide uppercase lg:block ${
            isDisconnected ? 'text-red-300' : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          Epoch
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className={`font-mono text-sm font-semibold lg:text-xs ${
              isDisconnected ? 'text-red-300' : 'text-zinc-950 dark:text-zinc-50'
            }`}
          >
            {epoch}
          </span>
          {/* Circular progress indicator */}
          <div className="relative flex h-5 w-5 items-center justify-center lg:h-4 lg:w-4">
            <svg className="h-5 w-5 -rotate-90 transform lg:h-4 lg:w-4">
              {/* Background circle */}
              <circle
                cx="10"
                cy="10"
                r="7"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                className="text-zinc-200 dark:text-zinc-700 lg:hidden"
              />
              <circle
                cx="8"
                cy="8"
                r="6"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                className="text-zinc-200 dark:text-zinc-700 max-lg:hidden"
              />
              {/* Progress circle */}
              <circle
                cx="10"
                cy="10"
                r="7"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 7}`}
                strokeDashoffset={`${2 * Math.PI * 7 * (1 - epochProgress / 100)}`}
                style={{ stroke: isDisconnected ? DISCONNECTED_SLOT_COLOR : ACTIVE_SLOT_COLOR }}
                className="transition-all duration-300 lg:hidden"
                strokeLinecap="round"
              />
              <circle
                cx="8"
                cy="8"
                r="6"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 6}`}
                strokeDashoffset={`${2 * Math.PI * 6 * (1 - epochProgress / 100)}`}
                style={{ stroke: isDisconnected ? DISCONNECTED_SLOT_COLOR : ACTIVE_SLOT_COLOR }}
                className="transition-all duration-300 max-lg:hidden"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
