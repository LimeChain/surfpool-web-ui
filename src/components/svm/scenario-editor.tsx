'use client';

import protocolsData from '@/lib/solana-protocols.json';
import { MagnifyingGlassIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/solid';
import { motion } from 'framer-motion';
import React, { useState } from 'react';

interface Protocol {
  id: string;
  title: string;
  description: string;
  icon_url: string;
  actions: Action[];
}

interface Action {
  id: string;
  title: string;
  description: string;
}

interface Slot {
  id: string;
  height: number;
  actions: {
    protocolId: string;
    actionId: string;
    protocol: string;
    action: string;
  }[];
}

export default function ScenarioEditor() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [showProtocolPanel, setShowProtocolPanel] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([{ id: '1', height: 0, actions: [] }]);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('1');
  const [mouseX, setMouseX] = useState<number | null>(null);
  const [hasAnimated, setHasAnimated] = useState<Set<string>>(new Set(['1']));

  // Debug: Log selection changes
  React.useEffect(() => {
    console.log('Selected slot ID changed to:', selectedSlotId);
  }, [selectedSlotId]);

  const protocols = protocolsData.protocols as Protocol[];

  const filteredProtocols = protocols.filter((protocol) => {
    const query = searchQuery.toLowerCase();
    return (
      protocol.title.toLowerCase().includes(query) ||
      protocol.description.toLowerCase().includes(query) ||
      protocol.actions.some(
        (action) => action.title.toLowerCase().includes(query) || action.description.toLowerCase().includes(query)
      )
    );
  });

  const addSlot = () => {
    const newSlot: Slot = {
      id: String(Date.now()),
      height: slots.length,
      actions: [],
    };
    setSlots([...slots, newSlot]);
    setSelectedSlotId(newSlot.id);
    // Mark as animated after a frame
    setTimeout(() => {
      setHasAnimated((prev) => new Set([...prev, newSlot.id]));
    }, 50);
  };

  const deleteSlot = (slotId: string) => {
    if (slots.length === 1) return;

    const updatedSlots = slots.filter((slot) => slot.id !== slotId);
    const reindexedSlots = updatedSlots.map((slot, idx) => ({
      ...slot,
      height: idx,
    }));
    setSlots(reindexedSlots);

    if (selectedSlotId === slotId && reindexedSlots.length > 0) {
      setSelectedSlotId(reindexedSlots[0].id);
    }
  };

  const insertSlotAt = (index: number) => {
    const newSlot: Slot = {
      id: String(Date.now()),
      height: index,
      actions: [],
    };

    const updatedSlots = [...slots.slice(0, index), newSlot, ...slots.slice(index)];
    const reindexedSlots = updatedSlots.map((slot, idx) => ({
      ...slot,
      height: idx,
    }));
    setSlots(reindexedSlots);
    setSelectedSlotId(newSlot.id);
    console.log('New slot created and selected:', newSlot.id);
    // Mark as animated after a frame
    setTimeout(() => {
      setHasAnimated((prev) => new Set([...prev, newSlot.id]));
    }, 50);
  };

  const addActionToSlot = (slotId: string, protocol: Protocol, action: Action) => {
    setSlots(
      slots.map((slot) => {
        if (slot.id === slotId) {
          return {
            ...slot,
            actions: [
              ...slot.actions,
              {
                protocolId: protocol.id,
                actionId: action.id,
                protocol: protocol.title,
                action: action.title,
              },
            ],
          };
        }
        return slot;
      })
    );
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMouseX(e.clientX - rect.left);
  };

  const handleMouseLeave = () => {
    setMouseX(null);
  };

  return (
    <div className="relative h-full">
      {/* Main Stage - Scrollable */}
      <div
        className="absolute inset-0 overflow-auto bg-zinc-950"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255, 255, 255, 0.12) 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={() => setSelectedSlotId('')}
      >
        {/* Vertical cursor line */}
        {mouseX !== null && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-yellow-500/30"
            style={{ left: `${mouseX}px` }}
          />
        )}

        {/* Timeline */}
        <div className={`relative pt-12 pb-64 ${slots.length < 4 ? 'flex min-h-full items-start justify-center' : ''}`}>
          <div className="flex">
            {slots.map((slot, index) => (
              <React.Fragment key={slot.id}>
                <div className="group/slot-wrapper flex">
                  <motion.div
                    layout
                    initial={hasAnimated.has(slot.id) ? false : { opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      layout: { type: 'spring', stiffness: 350, damping: 30 },
                      opacity: { duration: 0.3 },
                      scale: { type: 'spring', stiffness: 400, damping: 25 },
                    }}
                    className="flex flex-col gap-3"
                  >
                    {/* Slot Height Label */}
                    <div className="flex items-center justify-center">
                      <span className="font-mono text-sm text-zinc-400">Slot {slot.height}</span>
                    </div>

                    {/* Slot Card */}
                    <div className="group relative w-[300px] flex-shrink-0">
                      <div
                        className={`min-h-[280px] cursor-pointer rounded-lg border-2 bg-zinc-900 p-6 transition-all ${
                          selectedSlotId === slot.id
                            ? 'border-yellow-500 shadow-lg shadow-yellow-500/20'
                            : 'border-zinc-700 hover:border-zinc-600'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSlotId(slot.id);
                        }}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="font-semibold text-zinc-100">Slot {slot.id}</h4>
                          <span className="font-mono text-xs text-zinc-500">{slot.actions.length} actions</span>
                        </div>

                        {/* Actions in this slot */}
                        {slot.actions.length === 0 ? (
                          <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-zinc-700 p-4">
                            <p className="text-center text-sm text-zinc-500">
                              No actions yet. Click actions from the right panel.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {slot.actions.map((action, actionIndex) => (
                              <div
                                key={`${action.protocolId}-${action.actionId}-${actionIndex}`}
                                className="flex items-center gap-3 rounded-md border border-zinc-700 bg-zinc-800 p-3"
                              >
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-zinc-100">{action.action}</div>
                                  <div className="text-xs text-zinc-400">{action.protocol}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Delete Button - only shown when slot is selected */}
                      {slots.length > 1 && selectedSlotId === slot.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSlot(slot.id);
                          }}
                          className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-all hover:scale-110 hover:bg-red-600"
                          title="Delete slot"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </motion.div>

                  {/* Gap with insert button - shown when hovering the slot before OR the gap itself */}
                  <div className="group/insert relative" style={{ width: '48px' }}>
                    {/* Vertical line - shorter and positioned lower */}
                    <div
                      className="absolute left-1/2 w-0.5 -translate-x-1/2 bg-pink-500 opacity-0 transition-opacity group-hover/insert:opacity-100 group-hover/slot-wrapper:opacity-100"
                      style={{ top: '120px', height: '140px' }}
                    />

                    {/* Plus button - centered on the line */}
                    <button
                      onClick={() => insertSlotAt(index + 1)}
                      className="absolute z-10 flex h-8 w-8 items-center justify-center rounded-full bg-pink-500 text-white opacity-0 shadow-lg transition-all group-hover/insert:opacity-100 group-hover/slot-wrapper:opacity-100 hover:scale-110 hover:bg-pink-600"
                      style={{ top: '170px', left: '50%', transform: 'translateX(-50%)' }}
                      title="Insert slot here"
                    >
                      <PlusIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Centered Toolbox - Fixed Position */}
      <div className="pointer-events-none fixed left-1/2 z-50 w-[1120px] -translate-x-1/2" style={{ bottom: '116px' }}>
        <div className="pointer-events-auto flex flex-col gap-4">
          {/* Search Field and Protocol Icons - Animated */}
          <motion.div
            initial={false}
            animate={{
              opacity: showProtocolPanel ? 0 : 1,
              y: showProtocolPanel ? 20 : 0,
            }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            className={showProtocolPanel ? 'pointer-events-none' : ''}
          >
            {/* Big Search Field - Spotlight style */}
            <div className="relative mx-auto mb-4 w-[800px]">
              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-6">
                <MagnifyingGlassIcon className="h-8 w-8 text-zinc-700" aria-hidden="true" />
              </div>
              <input
                type="text"
                placeholder="Search protocols, addresses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="relative block w-full rounded-full border border-zinc-700/50 bg-zinc-900/40 py-4 pr-6 pl-16 text-lg font-semibold text-zinc-100 shadow-2xl backdrop-blur-2xl placeholder:font-normal placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500 focus:outline-none"
              />
            </div>

            {/* Protocol Icons Grid - Single Row */}
            <div className="flex justify-center gap-6">
              {filteredProtocols.map((protocol) => {
                // Map protocol IDs to local SVG files
                const localIconMap: Record<string, string> = {
                  jito: '/assets/jito.svg',
                  jupiter: '/assets/jupiter.svg',
                  orca: '/assets/orca.svg',
                  raydium: '/assets/raydium.svg',
                  switchboard: '/assets/switchboard.svg',
                  drift: '/assets/drift.svg',
                };

                const iconSrc = localIconMap[protocol.id] || protocol.icon_url;

                return (
                  <div
                    key={protocol.id}
                    className="group cursor-pointer"
                    onClick={() => {
                      setSelectedProtocol(protocol);
                      setSelectedAction(protocol.actions.length > 0 ? protocol.actions[0] : null);
                      setShowProtocolPanel(true);
                    }}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-16 w-16 items-center justify-center transition-all group-hover:scale-110">
                        <img src={iconSrc} alt={protocol.title} className="h-16 w-16" />
                      </div>
                      <span className="text-center text-xs font-medium text-zinc-400 transition-colors group-hover:text-zinc-100">
                        {protocol.title}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Protocol Panel - Animated */}
          <motion.div
            initial={false}
            animate={{
              opacity: showProtocolPanel ? 1 : 0,
              y: showProtocolPanel ? 0 : 20,
            }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            className={!showProtocolPanel ? 'pointer-events-none' : ''}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
          >
            {selectedProtocol && (
              <div className="h-[60vh] w-full overflow-hidden rounded-2xl border border-zinc-700/50 bg-zinc-900/40 shadow-2xl backdrop-blur-2xl">
                <div className="flex h-full flex-col">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-zinc-700/50 p-6 shadow-lg">
                    <div className="flex items-center gap-4">
                      <img
                        src={
                          {
                            jito: '/assets/jito.svg',
                            jupiter: '/assets/jupiter.svg',
                            orca: '/assets/orca.svg',
                            raydium: '/assets/raydium.svg',
                            switchboard: '/assets/switchboard.svg',
                            drift: '/assets/drift.svg',
                          }[selectedProtocol.id] || selectedProtocol.icon_url
                        }
                        alt={selectedProtocol.title}
                        className="h-12 w-12"
                      />
                      <div>
                        <h3 className="text-xl font-semibold text-zinc-100">{selectedProtocol.title}</h3>
                        <p className="text-sm text-zinc-400">{selectedProtocol.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowProtocolPanel(false);
                        setSelectedAction(null);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Two Column Layout */}
                  <div className="flex flex-1 overflow-hidden">
                    {/* Left Column - Actions List */}
                    <div className="w-[400px] flex-shrink-0 overflow-y-auto border-r border-zinc-700/50 p-6">
                      <h4 className="mb-4 text-sm font-semibold tracking-wide text-zinc-400 uppercase">Actions</h4>
                      <div className="space-y-2">
                        {selectedProtocol.actions.map((action) => (
                          <div
                            key={action.id}
                            className={`cursor-pointer rounded-lg border p-4 transition-all ${
                              selectedAction?.id === action.id
                                ? 'border-yellow-500 bg-zinc-800/80'
                                : 'border-zinc-700/50 bg-zinc-800/30 hover:border-zinc-600 hover:bg-zinc-800/50'
                            }`}
                            onClick={() => setSelectedAction(action)}
                          >
                            <h5 className="font-semibold text-zinc-100">{action.title}</h5>
                            <p className="mt-1 text-xs text-zinc-400">{action.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right Column - Action Details */}
                    <div className="flex flex-1 flex-col overflow-y-auto p-6">
                      {selectedAction ? (
                        <>
                          <h4 className="mb-4 text-sm font-semibold tracking-wide text-zinc-400 uppercase">
                            Action Details
                          </h4>
                          <div className="mb-6 flex-1">
                            <h3 className="mb-2 text-2xl font-semibold text-zinc-100">{selectedAction.title}</h3>
                            <p className="text-zinc-300">{selectedAction.description}</p>
                          </div>

                          {/* Add to Slot Button - Right Aligned */}
                          <div className="flex justify-end">
                            <button
                              onClick={() => {
                                if (selectedSlotId && selectedProtocol) {
                                  addActionToSlot(selectedSlotId, selectedProtocol, selectedAction);
                                  setShowProtocolPanel(false);
                                  setSelectedAction(null);
                                }
                              }}
                              disabled={!selectedSlotId}
                              className="w-[300px] rounded-lg bg-yellow-500 px-6 py-3 font-semibold text-zinc-900 transition-all hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {selectedSlotId ? 'Add to Selected Slot' : 'Select a slot first'}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex h-full items-center justify-center text-zinc-500">
                          Select an action to view details
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
