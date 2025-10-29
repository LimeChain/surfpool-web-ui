'use client';

import { Navbar, NavbarItem, NavbarSection } from '@/components/catalyst/navbar';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { ReactNode, useEffect, useState } from 'react';
import CollapsibleSearch from './collapsible-search';

export interface BentoItem {
  id: string;
  name: string;
  description: string;
  status?: {
    online: boolean;
    status: string;
  };
  metadata?: Record<string, any>;
}

interface GenericBentoProps<T extends BentoItem> {
  items: T[];
  searchPlaceholder?: string;
  emptyMessage?: string;
  renderItem: (item: T, isSelected: boolean) => ReactNode;
  renderDetailHeader: (item: T, onClose?: () => void) => ReactNode;
  renderDetailContent: (item: T, activeTab: string) => ReactNode;
  renderDetailActions?: (item: T, onClose?: () => void) => ReactNode; // Optional custom actions
  tabs?: Array<{
    id: string;
    label: string;
    icon: ReactNode;
  }>;
  defaultTab?: string;
  headerContent?: ReactNode;
  onSelectionChange?: (item: T | null) => void;
}

export default function GenericBento<T extends BentoItem>({
  items,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No items found',
  renderItem,
  renderDetailHeader,
  renderDetailContent,
  renderDetailActions,
  tabs = [],
  defaultTab = 'overview',
  headerContent,
  onSelectionChange,
}: GenericBentoProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<T | null>(null);
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-select newly created item
  const [previousItemCount, setPreviousItemCount] = useState(items.length);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  useEffect(() => {
    // Track the selected item ID
    if (selectedItem) {
      const currentId = selectedItem.id;

      // Find the item in the current items list to ensure it's up-to-date
      const updatedItem = items.find(item => item.id === selectedItem.id);
      if (updatedItem && updatedItem !== selectedItem) {
        setSelectedItem(updatedItem);
      }

      // Only reset tab if we're switching to a different item (not just updating the same item)
      if (currentId !== selectedItemId) {
        setSelectedItemId(currentId);
        setIsExpanded(false);
        setActiveTab(defaultTab);
      }
    } else {
      setSelectedItemId(null);
    }

    // Auto-select newly added item
    if (items.length > previousItemCount) {
      // Find the newest item (last one in the array, assuming it was just added)
      const newestItem = items[items.length - 1];
      if (newestItem) {
        setSelectedItem(newestItem);
      }
    }

    setPreviousItemCount(items.length);
  }, [items, selectedItem, selectedItemId, defaultTab]);

  // Notify parent when selection changes
  useEffect(() => {
    onSelectionChange?.(selectedItem);
  }, [selectedItem, onSelectionChange]);

  // Handle Escape key to close detail pane
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedItem) {
        setSelectedItem(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem]);

  // Filter items based on search query
  const filteredItems = items.filter((item) => {
    const query = searchQuery.toLowerCase();
    const name = String(item.name).toLowerCase();
    const description = String(item.description).toLowerCase();
    return name.includes(query) || description.includes(query);
  });

  return (
    <div className="flex h-[100vh] flex-col lg:h-[calc(100vh-60px)]">
      {/* Top Section - Grid */}
      <div
        className={`overflow-auto ${
          selectedItem
            ? isExpanded
              ? 'h-[12.5%]' // 1/8 when expanded
              : 'h-1/2' // 1/2 by default
            : 'h-full'
        } transition-all duration-300 ease-in-out`}
        onScroll={(e) => {
          // Emit scroll event for navbar to detect
          const scrollTop = (e.target as HTMLDivElement).scrollTop;
          window.dispatchEvent(new CustomEvent('bentoScroll', { detail: { scrollTop } }));
        }}
      >
        <div className="mx-auto max-w-7xl px-[24px] pt-4 pb-1 sm:px-6 sm:pt-2 lg:px-8">
          {/* Search Field and Header Content */}
          <div className="mb-6">
            <CollapsibleSearch
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>

          {filteredItems.length === 0 ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-zinc-500 dark:text-zinc-400">
                {searchQuery ? 'No items match your search' : emptyMessage}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-[20px] gap-y-[20px]">
              {' '}
              {filteredItems.map((item) => {
                const isSelected = selectedItem?.id === item.id;

                return (
                  <div
                    key={String(item.id)}
                    className="group relative cursor-pointer transition-transform duration-200 ease-out hover:scale-[1.02]"
                    onClick={() => {
                      setSelectedItem(item);
                      setActiveTab(defaultTab);
                    }}
                  >
                    {renderItem(item, isSelected)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section - Detail Pane */}
      {selectedItem && (
        <div
          className={`${
            isExpanded ? 'h-[87.5%]' : 'h-1/2'
          } -mr-5 -ml-5 flex flex-col border-t-2 border-zinc-200 bg-zinc-50 transition-all duration-300 ease-in-out dark:border-zinc-800 dark:bg-zinc-900`}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-3 gap-3">
            {renderDetailHeader(selectedItem, () => setSelectedItem(null))}
            <div className="flex flex-col items-end gap-1.5">
              <button
                onClick={() => setSelectedItem(null)}
                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                title="Close details"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
              {renderDetailActions && renderDetailActions(selectedItem, () => setSelectedItem(null))}
            </div>
          </div>

          {/* Navbar Navigation */}
          {tabs.length > 0 && (
            <div className="border-b border-zinc-200/40 pl-5 dark:border-zinc-700/30">
              <Navbar>
                <NavbarSection>
                  {tabs.map((tab) => (
                    <NavbarItem
                      key={tab.id}
                      current={activeTab === tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        // Expand when clicking on any tab other than the default
                        if (tab.id !== defaultTab) {
                          setIsExpanded(true);
                        } else {
                          setIsExpanded(false);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      {tab.icon && <span className="mr-2">{tab.icon}</span>}
                      {tab.label}
                    </NavbarItem>
                  ))}
                </NavbarSection>
              </Navbar>
            </div>
          )}

          {/* Tab Content */}
          <div className="flex-1 overflow-auto">{renderDetailContent(selectedItem, activeTab)}</div>
        </div>
      )}
    </div>
  );
}
