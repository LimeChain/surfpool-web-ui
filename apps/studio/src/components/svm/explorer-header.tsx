import TransactionInspector from '@/components/svm/transaction-inspector';
import { useAppConfig } from '@/hooks/use-app-config';
import { solanaWebSocketService } from '@/lib/solana-websocket-service';
import { CalendarIcon, PauseIcon, PlayIcon } from '@heroicons/react/24/outline';
import { ArchiveBoxArrowDownIcon, CloudArrowUpIcon } from '@heroicons/react/24/solid';
import { Faucet } from '@surfpool/svm';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
  Listbox,
  ListboxOption,
  Switch,
} from '@surfpool/ui';
import { useEffect, useRef, useState } from 'react';
import { LabeledLink } from './labeled-link';

type TimeTravelMode = 'date' | 'epoch' | 'slot';

const ExplorerHeader = () => {
  const { rpcUrl, wsUrl, rpcDatasourceUrl, loading: configLoading, error: configError, refetch } = useAppConfig();
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [isClockPaused, setIsClockPaused] = useState<boolean>(false);
  const [showTimeTravel, setShowTimeTravel] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [publishAccounts, setPublishAccounts] = useState(true);
  const [publishPrograms, setPublishPrograms] = useState(true);
  const [publishLandingPage, setPublishLandingPage] = useState(false);
  const [selectedPricingTier, setSelectedPricingTier] = useState<'starter' | 'pro' | 'enterprise'>('pro');
  const [subdomain, setSubdomain] = useState('');
  const [isCheckingSubdomain, setIsCheckingSubdomain] = useState(false);
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subdomainInputRef = useRef<HTMLInputElement>(null);
  const [timeTravelMode, setTimeTravelMode] = useState<TimeTravelMode>('date');
  const [selectedEpoch, setSelectedEpoch] = useState<number>(0);
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const [selectedTimeUnit, setSelectedTimeUnit] = useState<
    'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'
  >('days');
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

  // Auto-focus subdomain input when publish dialog opens
  useEffect(() => {
    if (showPublishDialog && subdomainInputRef.current) {
      setTimeout(() => subdomainInputRef.current?.focus(), 100);
    }
  }, [showPublishDialog]);

  // Cleanup subdomain check timeout on unmount
  useEffect(() => {
    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, []);

  // Check subdomain availability (mock for now - would hit real API)
  const checkSubdomainAvailability = async (value: string) => {
    if (!value || value.length < 3) {
      setSubdomainAvailable(null);
      return;
    }

    setIsCheckingSubdomain(true);
    try {
      // TODO: Replace with actual API call to check subdomain availability
      // For now, simulate a check with a delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      // Mock: subdomains starting with 'test' are taken
      setSubdomainAvailable(!value.startsWith('test'));
    } catch (error) {
      console.error('Error checking subdomain:', error);
      setSubdomainAvailable(null);
    } finally {
      setIsCheckingSubdomain(false);
    }
  };

  // Handle subdomain input change with debounce
  const handleSubdomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSubdomain(value);

    // Clear existing timeout
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    // Reset availability state while typing
    setSubdomainAvailable(null);

    // Show loading indicator immediately if valid length
    if (value.length >= 3) {
      setIsCheckingSubdomain(true);
      // Set new timeout to check after 1 second
      checkTimeoutRef.current = setTimeout(() => {
        checkSubdomainAvailability(value);
      }, 1000);
    } else {
      setIsCheckingSubdomain(false);
    }
  };

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
          window.dispatchEvent(
            new CustomEvent('clockPauseStateChanged', {
              detail: { isPaused: newPauseState },
            })
          );
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
      case 'seconds':
        return 1000;
      case 'minutes':
        return 60 * 1000;
      case 'hours':
        return 60 * 60 * 1000;
      case 'days':
        return 24 * 60 * 60 * 1000;
      case 'weeks':
        return 7 * 24 * 60 * 60 * 1000;
      case 'months':
        return 30 * 24 * 60 * 60 * 1000;
      case 'years':
        return 365 * 24 * 60 * 60 * 1000;
      default:
        return 1000;
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
          window.dispatchEvent(
            new CustomEvent('epochChanged', {
              detail: {
                epoch: data.result.epoch,
                slotIndex: data.result.slot_index,
              },
            })
          );
          setShowTimeTravel(false);
        }
      }
    } catch (error) {
      console.error('❌ Error during time travel:', error);
    }
  };

  return (
    <div className="mt-8 grid w-full grid-cols-1 gap-8 px-6 lg:grid-cols-[1fr_450px] lg:px-4">
      {/* Left Column on lg / Full width on sm+md */}
      <div className="flex w-full flex-col gap-8">
        {/* Transactions - always here */}
        <TransactionInspector autoStart={true} fetchHistorical={true} />

        {/* Faucet + Controls row on md / Faucet alone then Controls on sm */}
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[350px_1fr] md:gap-8 lg:hidden">
          {/* Faucet */}
          <div className="w-full md:order-1">
            <Faucet rpcUrl={rpcUrl} primaryColor="#71717a" />
          </div>

          {/* Controls + URLs - on md shown next to faucet, on sm shown below */}
          <div className="flex w-full flex-col gap-4 md:order-2">
            {/* Control Buttons */}
            <div className="grid w-full grid-cols-4 gap-2">
              <button
                onClick={toggleClock}
                className="flex flex-col items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 py-4 transition-colors hover:bg-zinc-700"
                title={isClockPaused ? 'Resume clock' : 'Pause clock'}
              >
                {isClockPaused ? (
                  <PlayIcon className="h-8 w-8 text-zinc-300" />
                ) : (
                  <PauseIcon className="h-8 w-8 text-zinc-300" />
                )}
                <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-300">
                  {isClockPaused ? 'Resume' : 'Pause Clock'}
                </span>
              </button>

              <button
                onClick={() => setShowTimeTravel(true)}
                className="flex flex-col items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 py-4 transition-colors hover:bg-zinc-700"
                title="Time Travel"
              >
                <CalendarIcon className="h-8 w-8 text-zinc-300" />
                <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-300">Time Travel</span>
              </button>

              <button
                onClick={exportSnapshot}
                className="flex flex-col items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 py-4 transition-colors hover:bg-zinc-700"
                title="Export Snapshot"
              >
                <ArchiveBoxArrowDownIcon className="h-8 w-8 text-zinc-300" />
                <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-300">Export State</span>
              </button>

              <button
                onClick={() => setShowPublishDialog(true)}
                className="flex flex-col items-center gap-2 rounded-lg border border-pink-500 bg-pink-600 py-4 transition-colors hover:bg-pink-500"
                title="Publish"
              >
                <CloudArrowUpIcon className="h-8 w-8 text-white" />
                <span className="text-[10px] font-medium uppercase tracking-wide text-white">Publish</span>
              </button>
            </div>

            {/* SURFNET URLs */}
            <div className="mt-4 flex w-full flex-col gap-0">
              <h2 className="text-sm font-medium uppercase tracking-wide text-white">SURFNET</h2>
              <div className="w-full">
                <LabeledLink
                  endpoint={{ name: 'RPC URL', url: rpcUrl }}
                  status={configError ? 'error' : configLoading ? 'loading' : 'connected'}
                  className="rounded-t-md"
                />
              </div>
              <div className="w-full">
                <LabeledLink
                  endpoint={{ name: 'WS URL', url: wsUrl }}
                  status={configError ? 'error' : wsConnected ? 'connected' : 'error'}
                  pulsing={wsConnected}
                />
              </div>
              <div className="w-full">
                <LabeledLink
                  endpoint={{ name: 'SOURCE', url: rpcDatasourceUrl }}
                  status={configError ? 'error' : configLoading ? 'loading' : 'connected'}
                  className="rounded-b-md"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - only on lg */}
      <div className="hidden w-full flex-col gap-4 lg:flex">
        {/* Faucet */}
        <Faucet rpcUrl={rpcUrl} primaryColor="#71717a" />

        {/* Control Buttons */}
        <div className="mt-8 grid w-full grid-cols-4 gap-2">
          <button
            onClick={toggleClock}
            className="flex flex-col items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 py-4 transition-colors hover:bg-zinc-700"
            title={isClockPaused ? 'Resume clock' : 'Pause clock'}
          >
            {isClockPaused ? (
              <PlayIcon className="h-8 w-8 text-zinc-300" />
            ) : (
              <PauseIcon className="h-8 w-8 text-zinc-300" />
            )}
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-300">
              {isClockPaused ? 'Resume' : 'Pause Clock'}
            </span>
          </button>

          <button
            onClick={() => setShowTimeTravel(true)}
            className="flex flex-col items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 py-4 transition-colors hover:bg-zinc-700"
            title="Time Travel"
          >
            <CalendarIcon className="h-8 w-8 text-zinc-300" />
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-300">Time Travel</span>
          </button>

          <button
            onClick={exportSnapshot}
            className="flex flex-col items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 py-4 transition-colors hover:bg-zinc-700"
            title="Export Snapshot"
          >
            <ArchiveBoxArrowDownIcon className="h-8 w-8 text-zinc-300" />
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-300">Export State</span>
          </button>

          <button
            onClick={() => setShowPublishDialog(true)}
            className="flex flex-col items-center gap-2 rounded-lg border border-pink-500 bg-pink-600 py-4 transition-colors hover:bg-pink-500"
            title="Publish"
          >
            <CloudArrowUpIcon className="h-8 w-8 text-white" />
            <span className="text-[10px] font-medium uppercase tracking-wide text-white">Publish</span>
          </button>
        </div>

        {/* SURFNET URLs */}
        <div className="mt-4 flex w-full flex-col gap-0">
          <h2 className="text-sm font-medium uppercase tracking-wide text-white">SURFNET</h2>
          <div className="w-full">
            <LabeledLink
              endpoint={{ name: 'RPC URL', url: rpcUrl }}
              status={configError ? 'error' : configLoading ? 'loading' : 'connected'}
              className="rounded-t-md"
            />
          </div>
          <div className="w-full">
            <LabeledLink
              endpoint={{ name: 'WS URL', url: wsUrl }}
              status={configError ? 'error' : wsConnected ? 'connected' : 'error'}
              pulsing={wsConnected}
            />
          </div>
          <div className="w-full">
            <LabeledLink
              endpoint={{ name: 'SOURCE', url: rpcDatasourceUrl }}
              status={configError ? 'error' : configLoading ? 'loading' : 'connected'}
              className="rounded-b-md"
            />
          </div>
        </div>
      </div>

      {/* Time Travel Dialog */}
      <Dialog open={showTimeTravel} onClose={() => setShowTimeTravel(false)} size="md">
        <div className="text-center">
          <DialogTitle className="mb-8 text-center uppercase tracking-wide">TIME TRAVEL</DialogTitle>

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
                        className="w-24 border-none bg-transparent text-right text-2xl font-bold text-zinc-300 [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
                    className="w-full border-none bg-transparent text-center text-5xl font-bold text-zinc-300 [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
                    className="w-full border-none bg-transparent text-center text-3xl font-bold text-zinc-300 [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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

      {/* Publish Dialog */}
      <Dialog open={showPublishDialog} onClose={() => setShowPublishDialog(false)} size="md">
        <DialogTitle className="text-center text-lg font-semibold">New Cloud Surfnet</DialogTitle>
        <DialogDescription className="mt-2 text-center text-sm text-zinc-400">
          This network will be publicly accessible to anyone with the link
        </DialogDescription>
        <DialogBody className="mt-6">
          {/* Subdomain Picker */}
          <div className="mb-6">
            <div className="flex items-center justify-center gap-1 text-lg">
              <span className="text-zinc-500">https://</span>
              <div className="relative">
                <input
                  ref={subdomainInputRef}
                  type="text"
                  value={subdomain}
                  onChange={handleSubdomainChange}
                  placeholder="my-surfnet"
                  maxLength={20}
                  className={`w-36 border-b-2 bg-transparent px-1 pb-1 text-center text-lg font-semibold text-white placeholder-zinc-600 transition-all focus:outline-none ${
                    subdomainAvailable === true
                      ? 'border-green-500'
                      : subdomainAvailable === false
                        ? 'border-red-500'
                        : 'border-zinc-600 focus:border-pink-500'
                  }`}
                />
              </div>
              <span className="text-zinc-500">.surfnet.dev</span>
              <div className="ml-2 flex h-6 w-6 items-center justify-center">
                {isCheckingSubdomain && (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-pink-500"></div>
                )}
                {!isCheckingSubdomain && subdomainAvailable === true && (
                  <svg
                    className="h-6 w-6 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {!isCheckingSubdomain && subdomainAvailable === false && (
                  <svg
                    className="h-6 w-6 text-red-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
            </div>
            {!isCheckingSubdomain && subdomainAvailable === false && subdomain.length >= 3 && (
              <p className="mt-2 text-center text-sm text-red-400">This subdomain is already taken</p>
            )}
            {subdomain.length > 0 && subdomain.length < 3 && (
              <p className="mt-2 text-center text-xs text-zinc-500">Min 3 characters</p>
            )}
          </div>

          {/* Toggle Options */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-white">Accounts</div>
                <div className="text-sm text-zinc-400">Include account states and balances</div>
              </div>
              <Switch checked={publishAccounts} onChange={setPublishAccounts} color="pink" />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-white">Programs</div>
                <div className="text-sm text-zinc-400">Include deployed programs and their data</div>
              </div>
              <Switch checked={publishPrograms} onChange={setPublishPrograms} color="pink" />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-white">Landing Page</div>
                <div className="text-sm text-zinc-400">Custom landing page for your surfnet</div>
                <a
                  href="http://simd-0296.surfnet.dev/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-pink-400 hover:text-pink-300"
                >
                  View example: simd-0296.surfnet.dev
                </a>
              </div>
              <Switch
                checked={publishLandingPage}
                onChange={(checked) => {
                  setPublishLandingPage(checked);
                  if (checked) {
                    setSelectedPricingTier('enterprise');
                  }
                }}
                color="pink"
              />
            </div>
          </div>

          {/* Pricing Tier Segmented Control */}
          <div className="mt-6">
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-zinc-800 p-1">
              <button
                onClick={() => {
                  setSelectedPricingTier('starter');
                  setPublishLandingPage(false);
                }}
                className={`flex flex-col items-center gap-1 rounded-lg px-3 py-3 transition-colors ${
                  selectedPricingTier === 'starter' ? 'bg-pink-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span className="font-semibold">$3.99</span>
                <span className="text-xs opacity-80">50 txns</span>
              </button>
              <button
                onClick={() => {
                  setSelectedPricingTier('pro');
                  setPublishLandingPage(false);
                }}
                className={`flex flex-col items-center gap-1 rounded-lg px-3 py-3 transition-colors ${
                  selectedPricingTier === 'pro' ? 'bg-pink-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span className="font-semibold">$9.99</span>
                <span className="text-xs opacity-80">500 txns</span>
              </button>
              <button
                onClick={() => {
                  setSelectedPricingTier('enterprise');
                }}
                className={`flex flex-col items-center gap-1 rounded-lg px-3 py-3 transition-colors ${
                  selectedPricingTier === 'enterprise' ? 'bg-pink-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span className="font-semibold">$99.99</span>
                <span className="text-xs opacity-80">5,000 txns</span>
              </button>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={() => {
                // TODO: Implement publish logic
                console.log('Publishing network...', {
                  subdomain,
                  publishAccounts,
                  publishPrograms,
                  publishLandingPage,
                  selectedPricingTier,
                });
                setShowPublishDialog(false);
              }}
              disabled={!subdomain || subdomain.length < 3 || !subdomainAvailable}
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-6 py-4 text-lg font-semibold transition-colors ${
                subdomain && subdomain.length >= 3 && subdomainAvailable
                  ? 'bg-pink-600 text-white hover:bg-pink-500'
                  : 'cursor-not-allowed bg-zinc-700 text-zinc-500'
              }`}
            >
              <CloudArrowUpIcon className="h-6 w-6" />
              Create Cloud Surfnet
            </button>
          </div>
        </DialogBody>
      </Dialog>
    </div>
  );
};

export default ExplorerHeader;
