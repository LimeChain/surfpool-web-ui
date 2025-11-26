import TransactionInspector from '@/components/svm/transaction-inspector';
import { useAppConfig } from '@/hooks/use-app-config';
import { Faucet } from '@surfpool/svm';
import { LabeledLink } from './labeled-link';
import { solanaWebSocketService } from '@/lib/solana-websocket-service';
import { useEffect, useState } from 'react';
import { CalendarIcon, PauseIcon, PlayIcon } from '@heroicons/react/24/outline';
import { ArchiveBoxArrowDownIcon } from '@heroicons/react/24/solid';
import { Dialog, DialogActions, DialogBody, DialogTitle, Listbox, ListboxOption } from '@surfpool/ui';

type TimeTravelMode = 'date' | 'epoch' | 'slot';

const ExplorerHeader = () => {
  const { rpcUrl, wsUrl, rpcDatasourceUrl, loading: configLoading, error: configError, refetch } = useAppConfig();
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [isClockPaused, setIsClockPaused] = useState<boolean>(false);
  const [showTimeTravel, setShowTimeTravel] = useState(false);
  const [timeTravelMode, setTimeTravelMode] = useState<TimeTravelMode>('date');
  const [selectedEpoch, setSelectedEpoch] = useState<number>(0);
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const [selectedTimeUnit, setSelectedTimeUnit] = useState<'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'>('days');
  const [selectedTimeAmount, setSelectedTimeAmount] = useState<number | null>(null);
  const [currentEpoch, setCurrentEpoch] = useState<number>(0);
  const [currentSlot, setCurrentSlot] = useState<number>(0);
  const [slotsInEpoch, setSlotsInEpoch] = useState<number>(432000);

  // Track WebSocket connection status
  useEffect(() => {
    const handleConnected = () => {
      console.log('ExplorerHeader: WebSocket connected, refreshing config...');
      setWsConnected(true);
      // Refresh config when WebSocket connects
      if (refetch) {
        refetch();
      }
    };

    const handleDisconnected = () => {
      console.log('ExplorerHeader: WebSocket disconnected, refreshing config...');
      setWsConnected(false);
      // Refresh config when WebSocket disconnects
      if (refetch) {
        refetch();
      }
    };

    // Listen for WebSocket connection events
    solanaWebSocketService.on('connected', handleConnected);
    solanaWebSocketService.on('disconnected', handleDisconnected);

    // Check initial connection status
    setWsConnected(solanaWebSocketService.isConnected());

    return () => {
      solanaWebSocketService.off('connected', handleConnected);
      solanaWebSocketService.off('disconnected', handleDisconnected);
    };
  }, [refetch]);

  // Listen for global pause state changes
  useEffect(() => {
    const handlePauseChange = (event: CustomEvent) => {
      setIsClockPaused(event.detail.isPaused);
    };

    window.addEventListener('clockPauseStateChanged', handlePauseChange as EventListener);

    return () => {
      window.removeEventListener('clockPauseStateChanged', handlePauseChange as EventListener);
    };
  }, []);

  // Fetch epoch data on mount
  useEffect(() => {
    const fetchEpochData = async () => {
      try {
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getEpochInfo',
          }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data.result) {
            setCurrentEpoch(data.result.epoch);
            setCurrentSlot(data.result.slotIndex);
            setSlotsInEpoch(data.result.slotsInEpoch);
          }
        }
      } catch (error) {
        console.error('Error fetching epoch data:', error);
      }
    };
    if (rpcUrl) fetchEpochData();
  }, [rpcUrl]);

  // Listen for epoch changes (from time travel or slot updates)
  useEffect(() => {
    const handleEpochChange = (event: CustomEvent) => {
      if (event.detail.epoch !== undefined) {
        setCurrentEpoch(event.detail.epoch);
      }
      if (event.detail.slotIndex !== undefined) {
        setCurrentSlot(event.detail.slotIndex);
      }
    };

    window.addEventListener('epochChanged', handleEpochChange as EventListener);

    return () => {
      window.removeEventListener('epochChanged', handleEpochChange as EventListener);
    };
  }, []);

  // Listen for slot updates from WebSocket
  useEffect(() => {
    const handleSlot = (data: any) => {
      if (data?.parent) {
        const newSlot = data.parent;
        const slotIndexInEpoch = newSlot % slotsInEpoch;
        setCurrentSlot(slotIndexInEpoch);
      }
    };

    solanaWebSocketService.on('slot', handleSlot);

    return () => {
      solanaWebSocketService.off('slot', handleSlot);
    };
  }, [slotsInEpoch]);

  // Toggle clock pause/resume
  const toggleClock = async () => {
    try {
      const method = isClockPaused ? 'surfnet_resumeClock' : 'surfnet_pauseClock';

      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: method,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result !== undefined) {
          const newPauseState = !isClockPaused;
          setIsClockPaused(newPauseState);

          // Dispatch global event so other components can sync
          window.dispatchEvent(new CustomEvent('clockPauseStateChanged', {
            detail: { isPaused: newPauseState }
          }));
        }
      }
    } catch (error) {
      console.error('Error toggling clock:', error);
    }
  };

  // Export snapshot
  const exportSnapshot = async () => {
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'surfnet_exportSnapshot',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📸 Export snapshot response:', data);

        if (data.result) {
          const jsonString = JSON.stringify(data.result, null, 2);
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          link.download = `surfnet-snapshot-${timestamp}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          console.log('✅ Snapshot exported successfully');
        }
      }
    } catch (error) {
      console.error('❌ Error exporting snapshot:', error);
    }
  };

  // Helper function to convert time units to milliseconds
  const getTimeUnitInMs = (unit: string): number => {
    switch (unit) {
      case 'seconds': return 1000;
      case 'minutes': return 60 * 1000;
      case 'hours': return 60 * 60 * 1000;
      case 'days': return 24 * 60 * 60 * 1000;
      case 'weeks': return 7 * 24 * 60 * 60 * 1000;
      case 'months': return 30 * 24 * 60 * 60 * 1000;
      case 'years': return 365 * 24 * 60 * 60 * 1000;
      default: return 1000;
    }
  };

  // Handle time travel
  const handleTimeTravel = async () => {
    try {
      let timeTravelConfig: any;

      switch (timeTravelMode) {
        case 'date':
          if (selectedTimeAmount === null || selectedTimeAmount === 0) {
            console.error('Please enter a valid time amount');
            return;
          }
          const now = new Date();
          const timeAmountMs = selectedTimeAmount * getTimeUnitInMs(selectedTimeUnit);
          const targetTimestamp = Math.floor(now.getTime() + timeAmountMs);
          timeTravelConfig = { absoluteTimestamp: targetTimestamp };
          break;
        case 'epoch':
          timeTravelConfig = { absoluteEpoch: selectedEpoch };
          break;
        case 'slot':
          timeTravelConfig = { absoluteSlot: selectedSlot };
          break;
        default:
          console.error('Invalid time travel mode');
          return;
      }

      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'surfnet_timeTravel',
          params: [timeTravelConfig],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          console.log('✅ Time travel successful:', data.result);
          // Dispatch event so other components can update
          window.dispatchEvent(new CustomEvent('epochChanged', {
            detail: {
              epoch: data.result.epoch,
              slotIndex: data.result.slot_index
            }
          }));
          setShowTimeTravel(false);
        }
      }
    } catch (error) {
      console.error('❌ Error during time travel:', error);
    }
  };

  return (
    <div className="mt-8 grid w-full grid-cols-1 items-start gap-8 md:grid-cols-[1fr_450px]">
      <div className="flex w-full flex-col gap-8 px-6 md:pl-4 md:pr-0">
        <TransactionInspector autoStart={true} fetchHistorical={true} />
      </div>
      <div className="flex w-full flex-col gap-4 px-6 md:pr-4 md:pl-0 md:w-[450px] md:max-w-[450px] md:min-w-[450px]">
        <div className="flex w-full flex-col gap-0">
          <h2 className="text-sm font-medium tracking-wide text-white uppercase">SURFNET</h2>
          <div className="w-full">
            <LabeledLink
              endpoint={{
                name: 'RPC URL',
                url: rpcUrl,
              }}
              status={configError ? 'error' : configLoading ? 'loading' : 'connected'}
              className="rounded-t-md"
            />
          </div>
          <div className="w-full">
            <LabeledLink
              endpoint={{
                name: 'WS URL',
                url: wsUrl,
              }}
              status={configError ? 'error' : wsConnected ? 'connected' : 'error'}
              pulsing={wsConnected}
            />
          </div>
          <div className="w-full">
            <LabeledLink
              endpoint={{
                name: 'SOURCE',
                url: rpcDatasourceUrl,
              }}
              status={configError ? 'error' : configLoading ? 'loading' : 'connected'}
              className="rounded-b-md"
            />
          </div>
        </div>

        <Faucet rpcUrl={rpcUrl} primaryColor="#71717a" />

        {/* Control Buttons */}
        <div className="mt-6 flex w-full items-center justify-center gap-4">
          {/* Pause/Resume Button */}
          <button
            onClick={toggleClock}
            className="flex w-32 flex-col items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 py-4 transition-colors hover:bg-zinc-700"
            title={isClockPaused ? 'Resume clock' : 'Pause clock'}
          >
            {isClockPaused ? (
              <PlayIcon className="h-8 w-8 text-zinc-300" />
            ) : (
              <PauseIcon className="h-8 w-8 text-zinc-300" />
            )}
            <span className="text-[10px] font-medium text-zinc-300 uppercase tracking-wide">
              {isClockPaused ? 'Resume' : 'Pause Clock'}
            </span>
          </button>

          {/* Time Travel Button */}
          <button
            onClick={() => setShowTimeTravel(true)}
            className="flex w-32 flex-col items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 py-4 transition-colors hover:bg-zinc-700"
            title="Time Travel"
          >
            <CalendarIcon className="h-8 w-8 text-zinc-300" />
            <span className="text-[10px] font-medium text-zinc-300 uppercase tracking-wide">Time Travel</span>
          </button>

          {/* Export Snapshot Button */}
          <button
            onClick={exportSnapshot}
            className="flex w-32 flex-col items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 py-4 transition-colors hover:bg-zinc-700"
            title="Export Snapshot"
          >
            <ArchiveBoxArrowDownIcon className="h-8 w-8 text-zinc-300" />
            <span className="text-[10px] font-medium text-zinc-300 uppercase tracking-wide">Export State</span>
          </button>
        </div>
      </div>

      {/* Time Travel Dialog */}
      <Dialog open={showTimeTravel} onClose={() => setShowTimeTravel(false)} size="md">
        <div className="text-center">
          <DialogTitle className="mb-8 text-center tracking-wide uppercase">TIME TRAVEL</DialogTitle>

          {/* Mode Selection */}
          <div className="mb-8 flex justify-center gap-2">
            <button
              onClick={() => setTimeTravelMode('date')}
              className={`rounded px-3 py-1 text-sm transition-colors ${
                timeTravelMode === 'date' ? 'bg-[#62D595] text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              DATE
            </button>
            <button
              onClick={() => setTimeTravelMode('epoch')}
              className={`rounded px-3 py-1 text-sm transition-colors ${
                timeTravelMode === 'epoch' ? 'bg-[#62D595] text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              EPOCH
            </button>
            <button
              onClick={() => setTimeTravelMode('slot')}
              className={`rounded px-3 py-1 text-sm transition-colors ${
                timeTravelMode === 'slot' ? 'bg-[#62D595] text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              SLOT
            </button>
          </div>

          <DialogBody>
            {timeTravelMode === 'date' && (
              <div className="space-y-4">
                <div>
                  <div className="relative">
                    <div className="-ml-8 flex items-center justify-center gap-3">
                      <input
                        type="number"
                        value={selectedTimeAmount || ''}
                        onChange={(e) => setSelectedTimeAmount(parseInt(e.target.value) || null)}
                        className="w-24 [appearance:textfield] border-none bg-transparent text-right text-2xl font-bold text-zinc-300 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        placeholder="7"
                        autoFocus
                      />
                      <div className="w-25">
                        <Listbox value={selectedTimeUnit} onChange={setSelectedTimeUnit}>
                          <ListboxOption value="seconds">Seconds</ListboxOption>
                          <ListboxOption value="minutes">Minutes</ListboxOption>
                          <ListboxOption value="hours">Hours</ListboxOption>
                          <ListboxOption value="days">Days</ListboxOption>
                          <ListboxOption value="weeks">Weeks</ListboxOption>
                          <ListboxOption value="months">Months</ListboxOption>
                          <ListboxOption value="years">Years</ListboxOption>
                        </Listbox>
                      </div>
                      <span className="text-sm text-zinc-400">from clock</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {timeTravelMode === 'epoch' && (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-400">Provide Epoch to set</label>
                  <input
                    type="number"
                    value={selectedEpoch || ''}
                    onChange={(e) => setSelectedEpoch(parseInt(e.target.value) || 0)}
                    className="w-full [appearance:textfield] border-none bg-transparent text-center text-5xl font-bold text-zinc-300 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    placeholder={`${currentEpoch + 1}`}
                    autoFocus
                  />
                </div>
              </div>
            )}

            {timeTravelMode === 'slot' && (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-medium text-zinc-400">Provide Absolute Slot to set</label>
                  <input
                    type="number"
                    value={selectedSlot || ''}
                    onChange={(e) => setSelectedSlot(parseInt(e.target.value) || 0)}
                    className="w-full [appearance:textfield] border-none bg-transparent text-center text-3xl font-bold text-zinc-300 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    placeholder={`${currentSlot + currentEpoch * slotsInEpoch}`}
                    autoFocus
                  />
                </div>
              </div>
            )}
          </DialogBody>

          <DialogActions className="!justify-center">
            <button
              onClick={handleTimeTravel}
              className="rounded border border-[#E034AE] bg-[#E034AE] px-6 py-2 font-medium text-white transition-colors hover:bg-[#C02A8F]"
            >
              Jump
            </button>
          </DialogActions>
        </div>
      </Dialog>
    </div>
  );
};

export default ExplorerHeader;
