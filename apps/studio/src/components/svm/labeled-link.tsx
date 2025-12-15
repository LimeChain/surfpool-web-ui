'use client'

import { Button } from '@surfpool/ui'
import { CheckIcon, ClipboardIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'

export interface Endpoint {
  title?: string
  name: string
  url: string
}

interface LabeledLinkProps {
  endpoint: Endpoint
  className?: string
  status?: 'connected' | 'error' | 'loading'
  pulsing?: boolean
}

export function LabeledLink({ endpoint, className = '', status = 'connected', pulsing = false }: LabeledLinkProps) {
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({})

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)

    setCopiedStates((prev) => ({ ...prev, [id]: true }))

    setTimeout(() => {
      setCopiedStates((prev) => ({ ...prev, [id]: false }))
    }, 2000)
  }

  return (
    <div className="space-y-0">
      <div key={endpoint.name} className="mt-0 space-y-0">
        {/* Query Endpoint */}
        <div className="flex-1 space-y-2">
          <div className="text-sm font-medium text-zinc-300 uppercase">{endpoint.title}</div>
          <div className={`group relative flex h-[38px] items-center overflow-hidden border border-zinc-700 bg-zinc-800 font-mono text-xs ${className}`}>
            <span className="flex h-full w-[52px] flex-shrink-0 items-center justify-start gap-2 border-r border-zinc-600 bg-zinc-900 pl-2 text-zinc-300 uppercase sm:w-[95px]">
              <div
                className={`h-2 w-2 flex-shrink-0 rounded-full ${
                  status === 'connected'
                    ? 'bg-green-400'
                    : status === 'error'
                      ? 'bg-red-400'
                      : 'bg-gray-500'
                } ${pulsing ? 'animate-subtle-pulse' : ''}`}
              />
              <span className="hidden whitespace-nowrap sm:inline">{endpoint.name}</span>
              <span className="sm:hidden">
                {endpoint.name === 'RPC URL' ? 'RPC' :
                 endpoint.name === 'WS URL' ? 'WS' :
                 endpoint.name === 'SOURCE' ? 'SRC' :
                 endpoint.name}
              </span>
            </span>
            <span className="flex-1 truncate px-2 text-xs">{endpoint.url}</span>
            <Button
              outline
              onClick={() => copyToClipboard(endpoint.url, `query-${endpoint.name}`)}
              aria-label={`Copy query endpoint for ${endpoint.name}`}
              className={`absolute right-[6px] flex h-[28px] w-[28px] flex-shrink-0 items-center justify-center bg-zinc-800 transition-opacity ${copiedStates[`query-${endpoint.name}`] ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            >
              {copiedStates[`query-${endpoint.name}`] ? (
                <CheckIcon className="h-4 w-4 text-green-500" />
              ) : (
                <ClipboardIcon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Subscription Endpoint */}
      </div>
    </div>
  )
}
