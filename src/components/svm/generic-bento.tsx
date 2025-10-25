'use client';

import { Navbar, NavbarItem, NavbarSection } from '@/components/catalyst/navbar';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { ReactNode, useEffect, useState } from 'react';

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
  renderDetailHeader: (item: T) => ReactNode;
  renderDetailContent: (item: T, activeTab: string) => ReactNode;
  tabs?: Array<{
    id: string;
    label: string;
    icon: ReactNode;
  }>;
  defaultTab?: string;
  headerContent?: ReactNode;
}

export default function GenericBento<T extends BentoItem>({
  items,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No items found',
  renderItem,
  renderDetailHeader,
  renderDetailContent,
  tabs = [],
  defaultTab = 'overview',
  headerContent,
}: GenericBentoProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<T | null>(null);
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [isExpanded, setIsExpanded] = useState(false);

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

  // Reset expansion when item changes
  useEffect(() => {
    if (selectedItem) {
      setIsExpanded(false);
      setActiveTab(defaultTab);
    }
  }, [selectedItem, defaultTab]);

  // Filter items based on search query
  const filteredItems = items.filter((item) => {
    const query = searchQuery.toLowerCase();
    const name = String(item.name).toLowerCase();
    const description = String(item.description).toLowerCase();
    return name.includes(query) || description.includes(query);
  });

  return (
    <div className="flex h-[100vh] flex-col lg:h-[calc(100vh-120px)]">
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
            <div className="flex justify-center">
              <div className="relative w-full max-w-md">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-5">
                  <MagnifyingGlassIcon className="h-6 w-6 text-zinc-400" aria-hidden="true" />
                  <input
                    type="text"
                    placeholder={searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full rounded-full border border-zinc-200/40 bg-white py-4 pr-5 pl-14 text-lg text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-zinc-400 focus:outline-none dark:border-zinc-700/30 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-500 dark:focus:ring-zinc-500"
                  />
                </div>
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full rounded-full border border-zinc-200/40 bg-white py-4 pr-5 pl-14 text-lg text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-zinc-400 focus:outline-none dark:border-zinc-700/30 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-500 dark:focus:ring-zinc-500"
                />
              </div>
            </div>
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
          <div className="flex items-center justify-between px-6 py-4">
            {renderDetailHeader(selectedItem)}
            <button
              onClick={() => setSelectedItem(null)}
              className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              title="Close details"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
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
