'use client';

import * as Headless from '@headlessui/react';
import React, { useState, useEffect } from 'react';
import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from './navbar';
import { CircleStackIcon, IdentificationIcon } from '@heroicons/react/16/solid';
import { Avatar } from './avatar';
import { Button } from './button';
import { Dialog, DialogActions, DialogDescription, DialogTitle } from './dialog';
import { Dropdown, DropdownButton, DropdownItem, DropdownLabel, DropdownMenu } from './dropdown';
import { ArrowRightStartOnRectangleIcon } from '@heroicons/react/16/solid';
import { useWorkspaceContext } from '@/contexts/workspace-context';
import { MagnifyingGlassIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/solid';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';
import { ShieldCheckIcon } from '@heroicons/react/24/solid';
import { CommandLineIcon, CloudIcon, InformationCircleIcon } from '@heroicons/react/24/solid';

function OpenMenuIcon() {
  return (
    <svg data-slot="icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M2 6.75C2 6.33579 2.33579 6 2.75 6H17.25C17.6642 6 18 6.33579 18 6.75C18 7.16421 17.6642 7.5 17.25 7.5H2.75C2.33579 7.5 2 7.16421 2 6.75ZM2 13.25C2 12.8358 2.33579 12.5 2.75 12.5H17.25C17.6642 12.5 18 12.8358 18 13.25C18 13.6642 17.6642 14 17.25 14H2.75C2.33579 14 2 13.6642 2 13.25Z" />
    </svg>
  );
}

function CloseMenuIcon() {
  return (
    <svg data-slot="icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  );
}

// Feature interfaces for metadata
interface FeatureItem {
  key: string;
  name: string;
  description: string;
  value: string;
}

interface FeatureSection {
  title: string;
  features: FeatureItem[];
}

interface PlanMetadata {
  description?: string;
  feature_overview?: string;
  feature_subgraph_deployment?: string;
  feature_subgraph_limits?: string;
  feature_surfnets?: string;
  features?: string;
}

export type Plan = {
  name: string
  id: string
  price: { monthly: string }
  price_id: string
  description: string
  features: string[]
  mostPopular: boolean
  available: boolean
  metadata?: PlanMetadata
}

// Helper function to parse feature metadata
function parseFeatureMetadata(metadata: PlanMetadata): Array<{key: string; section: FeatureSection}> {
  const parsedFeatures: Record<string, FeatureSection> = {};
  
  // First, parse all feature sections
  Object.entries(metadata).forEach(([key, value]) => {
    if (key.startsWith('feature_') && typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as FeatureSection;
        const featureKey = key.replace('feature_', '');
        parsedFeatures[featureKey] = parsed;
      } catch (error) {
        console.error(`Failed to parse metadata field ${key}:`, error);
      }
    }
  });
  
  // If there's a features array that defines the order, use it
  if (metadata.features && typeof metadata.features === 'string') {
    try {
      const featureOrder = JSON.parse(metadata.features) as string[];
      const orderedFeatures: Array<{key: string; section: FeatureSection}> = [];
      
      // Add features in the specified order
      featureOrder.forEach(fullFeatureKey => {
        // Extract the key part after "feature_"
        const featureKey = fullFeatureKey.replace('feature_', '');
        if (parsedFeatures[featureKey]) {
          orderedFeatures.push({
            key: featureKey,
            section: parsedFeatures[featureKey]
          });
        }
      });
      
      // Add any remaining features that weren't in the order array
      Object.entries(parsedFeatures).forEach(([key, value]) => {
        const fullKey = `feature_${key}`;
        if (!featureOrder.includes(fullKey)) {
          orderedFeatures.push({
            key: key,
            section: value
          });
        }
      });
      
      console.log('Parsed features (ordered):', orderedFeatures);
      return orderedFeatures;
    } catch (error) {
      console.error('Failed to parse features order array:', error);
    }
  }
  
  // Fallback: return all features as an array
  const featuresArray = Object.entries(parsedFeatures).map(([key, value]) => ({
    key: key,
    section: value
  }));
  
  console.log('Parsed features:', featuresArray);
  return featuresArray;
}

function MobileSidebar({ open, close, children }: React.PropsWithChildren<{ open: boolean; close: () => void }>) {
  return (
    <Headless.Dialog open={open} onClose={close} className="lg:hidden">
      <Headless.DialogBackdrop
        transition
        className="fixed inset-0 bg-black/30 transition data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
      />
      <Headless.DialogPanel
        transition
        className="fixed inset-y-0 w-full max-w-80 p-2 transition duration-300 ease-in-out data-closed:-translate-x-full"
      >
        <div className="flex h-full flex-col items-start rounded-lg bg-white shadow-xs ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
          <div className="-mb-3 px-4 pt-3">
            <Headless.CloseButton as={NavbarItem} aria-label="Close navigation">
              <CloseMenuIcon />
            </Headless.CloseButton>
          </div>
          {children}
        </div>
      </Headless.DialogPanel>
    </Headless.Dialog>
  );
}

export function StackedLayout({
  navbar,
  sidebar,
  children,
  path
}: React.PropsWithChildren<{ navbar: React.ReactNode; sidebar: React.ReactNode, path: string }>) {
  let [showSidebar, setShowSidebar] = useState(false);
  let [showCloudDialog, setShowCloudDialog] = useState(false);
  let [plans, setPlans] = useState<Plan[]>([]);
  let [loading, setLoading] = useState(false);
  let [stars, setStars] = useState<number>(0);

  // Fetch plans and stars when dialog opens
  useEffect(() => {
    if (showCloudDialog) {
      setLoading(true);
      console.log('Fetching plans and stars...');
      
      // Fetch plans
      fetch('https://cloud.txtx.run/api/subscriptions/plans')
        .then(res => {
          console.log('Plans response status:', res.status);
          return res.json();
        })
        .then(data => {
          console.log('Plans data:', data);
          const plansWithMetadata = (data.plans || []).map((plan: Plan) => {
            // Parse feature metadata if available
            if (plan.metadata) {
              const parsedFeatures = parseFeatureMetadata(plan.metadata);
              console.log(`Parsed features for ${plan.name}:`, parsedFeatures);
            }
            return plan;
          });
          setPlans(plansWithMetadata);
        })
        .catch(err => {
          console.error('Failed to fetch plans:', err);
        });
      
      // Fetch GitHub stars
      fetch('https://api.github.com/repos/txtx/surfpool')
        .then(res => {
          console.log('GitHub response status:', res.status);
          return res.json();
        })
        .then(data => {
          console.log('GitHub data:', data);
          setStars(data.stargazers_count || 0);
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to fetch GitHub stars:', err);
          setLoading(false);
        });
    }
  }, [showCloudDialog]);

  return (
    <div className="relative isolate flex min-h-svh w-full flex-col bg-white lg:bg-zinc-100 dark:bg-zinc-900 dark:lg:bg-zinc-950">
      {/* Sidebar on mobile */}
      <MobileSidebar open={showSidebar} close={() => setShowSidebar(false)}>
        {sidebar}
      </MobileSidebar>

      {/* Navbar */}
      <header className="flex items-center px-4">
        <div className="py-2.5 lg:hidden">
          <NavbarItem onClick={() => setShowSidebar(true)} aria-label="Open navigation">
            <OpenMenuIcon />
          </NavbarItem>
        </div>
        <div className="min-w-0 flex-1">
          <Navbar>
            <img src="/assets/txtx.png" alt="Txtx Logo" className="h-5 lg:h-4 lg:ml-4 ml-auto" />
            <NavbarItem href="/" current={path.endsWith('/')} className="max-lg:hidden">
              <CommandLineIcon/>
              Console
            </NavbarItem>
            <NavbarItem href="/subgraphs" current={path.endsWith('/subgraphs')} className="max-lg:hidden">
              <CircleStackIcon />
              Data Indexing
            </NavbarItem>
            <NavbarSpacer />
            <NavbarItem href="#" onClick={() => setShowCloudDialog(true)} className="max-lg:hidden">
              Cloud
              <CloudIcon />
            </NavbarItem>
          </Navbar>
        </div>
      </header>

      {/* Content */}
      <main className="flex flex-1 flex-col pb-2 lg:px-2">
        <div className="grow p-2 lg:rounded-lg lg:bg-white lg:p-2 lg:shadow-xs lg:ring-1 lg:ring-zinc-950/5 dark:lg:bg-zinc-900 dark:lg:ring-white/10">
          <div className="">{children}</div>
        </div>
      </main>
      
      {/* Cloud Dialog */}
      <Dialog open={showCloudDialog} onClose={() => setShowCloudDialog(false)} size="4xl">
        <div className="p-0">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="text-zinc-500">Loading plans...</div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Free Plan */}
                <div>
                  {/* Title and GitHub Badge Row */}
                  <div className="flex items-start justify-between -mb-7">
                    <h3 className="text-2xl font-semibold">Surfpool</h3>
                    <div className="flex flex-col items-end">
                      <button 
                        onClick={() => window.open('https://github.com/txtx/surfpool', '_blank')}
                        className="flex items-center bg-zinc-800 hover:bg-zinc-700 rounded-md text-white text-sm font-medium transition-colors overflow-hidden min-w-fit cursor-pointer"
                      >
                        <div className="flex items-center gap-2 px-2 py-2 border-r border-zinc-600">
                          <img src="/assets/github.svg" alt="GitHub" className="w-5 h-5" />
                          <span>Stars</span>
                        </div>
                        <div className="px-2 py-2 bg-gray-100 text-black">
                          <span className="font-bold">{stars}</span>
                        </div>
                      </button>
                      <div className="text-center mt-2">
                        <span className="text-xs text-zinc-500">Support Surfpool with a&nbsp;&nbsp;⭐️</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Labels Row */}
                  <div className="flex gap-2 mb-4">
                    <span className="bg-green-900/30 text-green-300 border border-green-500/30 px-2 py-1 text-xs rounded">
                      FREE
                    </span>
                    <span className="bg-green-900/30 text-green-300 border border-green-500/30 px-2 py-1 text-xs rounded">
                      OPEN-SOURCE
                    </span>
                    <span className="bg-yellow-900/30 text-yellow-300 border border-yellow-500/30 px-2 py-1 text-xs rounded">
                      LOCAL-FIRST
                    </span>
                  </div>

                  <div className="flex items-start gap-8">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      Build, test, and deploy your programs locally with all the features you need to succeed.
                    </p>
                  </div>
                </div>

                <div className="mt-2  border-t border-zinc-200 dark:border-zinc-700"/>

              <div className="mb-0">
                <h3 className="text-2xl font-semibold">Surfpool Cloud</h3>
              </div>
              <div className="flex items-center justify-between mt-2 mb-4">
                    <div className="flex gap-2">

              <span className="bg-yellow-900/30 text-yellow-300 border border-yellow-500/30 px-2 py-1 text-xs rounded">
                CLOUD SERVICES
              </span>
              </div>
                </div>


              {/* Surfpool+ Section */}
              <div className="mb-8">
                {/* Surfpool+ Features */}
                <div>
                  {plans.length > 0 && plans.some(plan => plan.metadata) ? (() => {
                    // Get all plans with metadata
                    const plansWithMetadata = plans.filter(plan => plan.metadata);
                    const allParsedFeatures = plansWithMetadata.map(plan => parseFeatureMetadata(plan.metadata!));
                    console.log('Parsed features for all plans:', plansWithMetadata.map(plan => ({ name: plan.name, features: parseFeatureMetadata(plan.metadata!) })));
                    
                    // Get all unique feature keys from all plans
                    const allFeatureKeys = new Set<string>();
                    allParsedFeatures.forEach(features => {
                      features.forEach(({key}) => allFeatureKeys.add(key));
                    });
                    
                    if (allFeatureKeys.size === 0) {
                      return (
                        <div className="text-zinc-400 text-sm">
                          No detailed features available.
                        </div>
                      );
                    }
                    
                    return (
                      <div>
                        {/* Main Table with Header */}
                        <table className="w-full table-fixed">
                          <thead>
                            <tr>
                              <th className="py-3 pr-4 text-left w-1/6">
                              </th>
                              {plans.map((plan, index) => (
                                <th key={plan.id} className="w-1/6 pr-2">
                                  <div className={`${plan.mostPopular ? 'bg-white/10 border-[1px] border-white' : 'bg-transparent border border-zinc-300 dark:border-zinc-800'} text-white rounded-lg shadow-sm p-4 w-full h-full`}>
                                    <div className="flex flex-col gap-3">
                                      <div className="text-center">
                                        <h5 className={`text-lg font-semibold tracking-wide text-white`}>
                                          {plan.name}
                                        </h5>
                                      </div>
                                      <div className="text-center">
                                        <div className={`text-3xl font-bold uppercase tracking-wide text-white`}>{plan.price.monthly}<span className="text-sm font-normal text-zinc-400 ml-1">/month</span></div>
                                      </div>
                                      <Button 
                                        color="dark"
                                        className={`text-sm py-2 px-4 ${plan.mostPopular ? '!bg-white hover:!bg-gray-100 !border-white hover:!border-gray-100 !text-black' : ''}`}
                                        disabled={!plan.available}
                                        onClick={() => {
                                          if (plan.available) {
                                            window.open(`https://cloud.txtx.run/?price_id=${plan.price_id}`, '_blank');
                                          }
                                        }}
                                      >
                                        {plan.available ? 'Get started' : 'Coming Soon'}
                                      </Button>
                                    </div>
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from(allFeatureKeys).map((featureKey) => {
                              // Find the section for this feature key from the first plan that has it
                              let section: FeatureSection | null = null;
                              for (const planFeatures of allParsedFeatures) {
                                const found = planFeatures.find(({key}) => key === featureKey);
                                if (found) {
                                  section = found.section;
                                  break;
                                }
                              }
                              
                              if (!section) return null;
                              
                              return (
                                <React.Fragment key={featureKey}>
                                  {/* Section Header Row */}
                                  {section.title && section.title.trim() !== '' && (
                                    <tr>
                                      <td colSpan={plans.length + 1} className="pt-4 pb-2 px-0">
                                        <span className="bg-white/30 text-white border border-white/30 px-2 py-1 text-xs rounded font-medium uppercase tracking-wide">
                                          {section.title}
                                        </span>
                                      </td>
                                    </tr>
                                  )}
                                  {/* Feature Rows */}
                                  {section.features.map((feature: FeatureItem, index: number) => (
                                    <tr key={`${featureKey}-${index}`} className="">
                                      <td className="py-1 pr-4">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm text-zinc-600 dark:text-zinc-400">{feature.name}</span>
                                          <div className="relative group">
                                            <button>
                                              <InformationCircleIcon className="w-4 h-4 text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors" />
                                            </button>
                                            <div className="absolute top-1/2 left-full transform -translate-y-1/2 ml-2 px-3 py-2 bg-zinc-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 max-w-xs">
                                              {feature.description}
                                              <div className="absolute top-1/2 right-full transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-zinc-900"></div>
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                      {plans.map((plan, planIndex) => {
                                        // Find the plan in plansWithMetadata to get its parsed features
                                        const planWithMetadataIndex = plansWithMetadata.findIndex(p => p.id === plan.id);
                                        const planFeatures = planWithMetadataIndex >= 0 ? allParsedFeatures[planWithMetadataIndex] : [];
                                        const planSection = planFeatures?.find(({key}) => key === featureKey);
                                        const planFeature = planSection?.section.features.find(f => f.name === feature.name);
                                        
                                        // Debug logging
                                        if (planIndex === 0 && featureKey === Array.from(allFeatureKeys)[0]) {
                                        }
                                        
                                        return (
                                          <td key={plan.id} className="py-1 text-center">
                                            {planFeature ? (
                                              planFeature.value === 'Yes' ? (
                                                <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center mx-auto">
                                                  <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                  </svg>
                                                </div>
                                              ) : planFeature.value === 'No' ? (
                                                <span className="text-xs text-zinc-500">—</span>
                                              ) : (
                                                <span className="text-sm text-zinc-400 dark:text-zinc-200">{planFeature.value}</span>
                                              )
                                            ) : (
                                              <span className="text-xs text-zinc-500">—</span>
                                            )}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })() : (
                    // Fallback to basic features if no metadata
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 border-b border-zinc-200 dark:border-zinc-700 pb-1">
                        Features
                      </h4>
                      {plans[0]?.features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-2 py-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-xs text-zinc-600 dark:text-zinc-400">{feature}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Contact Information */}
          <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-700">
          <div className="mb-0">
                <h3 className="text-2xl font-semibold mb-2">Custom Needs</h3>
              </div>


                          <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  For advanced setups with simulations, subgraphs, or Crypto Infrastructure as Code workflows, please reach out!
                </p>
                <Button 
                  color="pink" 
                  onClick={() => window.open('mailto:ludo@txtx.builders', '_blank')}
                  className="bg-[#E034AE] hover:bg-[#C02A8F] border-[#E034AE] hover:border-[#C02A8F] ml-4"
                >
                  Contact&nbsp;us
                </Button>
              </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
