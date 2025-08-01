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
import { CommandLineIcon, CloudIcon } from '@heroicons/react/24/solid';

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

export type Plan = {
  name: string
  id: string
  price: { monthly: string }
  price_id: string
  description: string
  features: string[]
  mostPopular: boolean
  available: boolean
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
          setPlans(data.plans || []);
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
                {/* Free Plan + First Paid Plan - Full Width */}
                <div className="space-y-6 mb-10">
                  {/* Free Plan */}
                  <div className="p-2">
                    <div>
                      {/* Title */}
                      <div className="mb-0">
                        <h3 className="text-2xl font-semibold">Surfpool</h3>
                      </div>
                      
                      {/* Labels and Call to Action Row */}
                      <div className="flex items-center justify-between mt-2 mb-4">
                        <div className="flex gap-2">
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
                        <button 
                          onClick={() => window.open('https://github.com/txtx/surfpool', '_blank')}
                          className="flex items-center bg-zinc-800 hover:bg-zinc-700 rounded-md text-white text-sm font-medium transition-colors overflow-hidden min-w-fit cursor-pointer -mt-10"
                        >
                          <div className="flex items-center gap-2 px-2 py-2 border-r border-zinc-600">
                            <img src="/assets/github.svg" alt="GitHub" className="w-5 h-5" />
                            <span>Stars</span>
                          </div>
                          <div className="px-2 py-2 bg-[#E034AE]">
                            <span>+1</span>
                          </div>
                        </button>
                      </div>
                      
                      {/* Description and Features Row */}
                      <div className="flex items-start gap-8">
                        {/* Description */}
                        <div className="w-7/12">
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            Perfect for getting started with Solana development.<br/>Build, test, and deploy your programs locally with all the tools you need to succeed.
                          </p>
                        </div>
                        
                        {/* Features */}
                        <div className="w-5/12">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-sm">Surfpool Studio: 1 seat</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-sm">Community support</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* First Paid Plan */}
                  {plans.length > 0 && (
                    <div className="p-2 border-t border-zinc-200 dark:border-zinc-700">
                      <div>
                                                {/* Title */}
                        <div className="mb-0">
                          <h3 className="text-2xl font-semibold">{plans[0].name}</h3>
                        </div>
                        
                        {/* Labels and Call to Action Row */}
                        <div className="flex items-center justify-between mt-2 mb-4">
                          <div className="flex gap-2">
                            <span className="bg-blue-900/30 text-blue-300 border border-blue-500/30 px-2 py-1 text-xs rounded">
                              {plans[0].price.monthly} / MONTH
                            </span>
                            <span className="bg-orange-900/30 text-orange-300 border border-orange-500/30 px-2 py-1 text-xs rounded">
                              CLOUD SERVICES
                            </span>
                          </div>
                          <Button 
                            color="blue" 
                            className="whitespace-nowrap -mt-10"
                            disabled={!plans[0].available}
                          >
                            {plans[0].available ? 'Subscribe' : 'Coming Soon'}
                          </Button>
                        </div>
                        
                        {/* Description and Features Row */}
                        <div className="flex items-start gap-8">
                          {/* Description */}
                          <div className="w-7/12">
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                              {plans[0].description}
                            </p>
                          </div>
                          
                          {/* Features */}
                          <div className="w-5/12">
                            <div className="space-y-2">
                              {plans[0].features.slice(0, 3).map((feature, index) => (
                                <div key={index} className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                  <span className="text-sm">{feature}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Paid Plans Grid - Only 2nd and 3rd plans */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  {plans.slice(1, 3).map((plan) => (
                  <div key={plan.id} className={`relative p-6 rounded-lg border-2 flex flex-col ${
                    plan.mostPopular 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800'
                  }`}>
                    {plan.mostPopular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                          Recommended
                        </span>
                      </div>
                    )}
                    <div className="text-center flex-1">
                      <h3 className="text-lg font-semibold mb-2">{plan.name}</h3>
                      <div className="text-3xl font-bold mb-4">{plan.price.monthly}<span className="text-sm font-normal text-zinc-500">/month</span></div>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                        {plan.description}
                      </p>
                      <ul className="text-sm space-y-2 mb-6 text-left">
                        {plan.features.map((feature, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-auto">
                      <Button 
                        color={plan.mostPopular ? "blue" : "dark"} 
                        className="w-full"
                        disabled={!plan.available}
                      >
                        {plan.available ? 'Subscribe' : 'Coming Soon'}
                      </Button>
                    </div>
                  </div>
                ))}
                </div>
              </div>
            )}
            
            {/* Contact Information */}
            <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-700 text-center">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">
                Custom Needs? Let's Talk.
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                For advanced setups with simulations, subgraphs, or Crypto Infrastructure as Code workflows, please reach out!
              </p>
              <Button 
                color="pink" 
                onClick={() => window.open('mailto:ludo@txtx.builders', '_blank')}
                className="bg-[#E034AE] hover:bg-[#C02A8F] border-[#E034AE] hover:border-[#C02A8F]"
              >
                Contact us
              </Button>
            </div>
          </div>
        </Dialog>
    </div>
  );
}
