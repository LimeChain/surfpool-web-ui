import TransactionInspector from '@/components/svm/transaction-inspector';
import { useAppConfig } from '@/hooks/use-app-config';
import { Faucet } from '@surfpool/svm';
import { LabeledLink } from './labeled-link';
import { solanaWebSocketService } from '@/lib/solana-websocket-service';
import { useEffect, useState } from 'react';
import { CalendarIcon, PauseIcon, PlayIcon } from '@heroicons/react/24/outline';
import { ArchiveBoxArrowDownIcon } from '@heroicons/react/24/solid';
import { Dialog, DialogActions, DialogBody, DialogTitle } from '@surfpool/ui';
import { Button } from '@surfpool/ui';
import { Listbox, ListboxOption } from '@surfpool/ui';

type TimeTravelMode = 'date' | 'epoch' | 'slot';

const ExplorerHeader = () => {
  const { rpcUrl, wsUrl, rpcDatasourceUrl, loading: configLoading, error: configError, refetch } = useAppConfig();
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [isClockPaused, setIsClockPaused] = useState<boolean>(false);
  const [showTimeTravel, setShowTimeTravel] = useState(false);
  const [timeTravelMode, setTimeTravelMode] = useState<TimeTravelMode>('date');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedEpoch, setSelectedEpoch] = useState<number>(0);
  const [selectedSlot, setSelectedSlot] = useState<number>(0);

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

  // Handle time travel
  const handleTimeTravel = async () => {
    try {
      let timeTravelConfig: any;

      switch (timeTravelMode) {
        case 'date':
          const dateTimeString = `${selectedDate}T${selectedTime}`;
          const targetTimestamp = Math.floor(new Date(dateTimeString).getTime() / 1000);
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

        <Faucet rpcUrl={rpcUrl} />

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
                timeTravelMode === 'date'
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              Date & Time
            </button>
            <button
              onClick={() => setTimeTravelMode('epoch')}
              className={`rounded px-3 py-1 text-sm transition-colors ${
                timeTravelMode === 'epoch'
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              Epoch
            </button>
            <button
              onClick={() => setTimeTravelMode('slot')}
              className={`rounded px-3 py-1 text-sm transition-colors ${
                timeTravelMode === 'slot'
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              Slot
            </button>
          </div>

          <DialogBody>
            {timeTravelMode === 'date' && (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-left text-sm font-medium text-zinc-300">Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-left text-sm font-medium text-zinc-300">Time</label>
                  <input
                    type="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
                  />
                </div>
              </div>
            )}

            {timeTravelMode === 'epoch' && (
              <div>
                <label className="mb-2 block text-left text-sm font-medium text-zinc-300">Epoch Number</label>
                <input
                  type="number"
                  value={selectedEpoch}
                  onChange={(e) => setSelectedEpoch(Number(e.target.value))}
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
                  placeholder="Enter epoch number"
                />
              </div>
            )}

            {timeTravelMode === 'slot' && (
              <div>
                <label className="mb-2 block text-left text-sm font-medium text-zinc-300">Slot Number</label>
                <input
                  type="number"
                  value={selectedSlot}
                  onChange={(e) => setSelectedSlot(Number(e.target.value))}
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100"
                  placeholder="Enter slot number"
                />
              </div>
            )}
          </DialogBody>

          <DialogActions>
            <Button color="dark" onClick={() => setShowTimeTravel(false)}>
              Cancel
            </Button>
            <Button onClick={handleTimeTravel}>
              Travel
            </Button>
          </DialogActions>
        </div>
      </Dialog>
    </div>
  );
};

export default ExplorerHeader;
