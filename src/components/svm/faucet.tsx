'use client'

import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { PlayIcon, PlusIcon } from '@heroicons/react/24/solid'
import confetti from 'canvas-confetti'
import { useEffect, useState } from 'react'
import { Dialog, DialogDescription, DialogTitle } from '../catalyst/dialog'
import { Field, Label } from '../catalyst/fieldset'
import { useWorkspaceContext } from '@/contexts/workspace-context'

export type Network = {
  id: string,
  name: string,
  description: string,
  status: string,
  created_at: string,
  rpc_url: string,
  datasource_rpc_url: string,
}

interface Token {
  ticker: string
  imageUrl: string
  address?: string
  name: string
  decimals: number
}

interface TokenRequest {
  token: Token
  amount: number
}

export default function Faucet() {
  const defaultFundingRequest = {
    token: {
      ticker: 'SOL',
      imageUrl: 'https://img-v1.raydium.io/icon/So11111111111111111111111111111111111111112.png',
      address: undefined,
      decimals: 9,
      name: 'Solana',
    },
    amount: 0,
  }
  const [tokenDialogOpen, setTokenDialogOpen] = useState(0)
  const [successDialogOpen, setSuccessDialogOpen] = useState(false)
  const [tokenShortcuts, setTokenShortcuts] = useState<Token[]>([])
  const [tokenMatches, setTokenMatches] = useState<Token[]>([])
  const [claimedTokens, setClaimedTokens] = useState(0)
  const [tokenFundingRequests, setTokenFundingRequest] = useState<TokenRequest[]>([defaultFundingRequest])
  const [processedTokens, setProcessedTokens] = useState<TokenRequest[]>([])
  const [processedRecipients, setProcessedRecipients] = useState<{address: string | undefined}[]>([])
  const [reccipients, setReccipients] = useState<
    {
      address: string | undefined
    }[]
  >([
    {
      address: '',
    },
  ])
  const [tokenSearch, setTokenSearch] = useState('')

  const [tokens, setTokens] = useState<any[]>([])

  const [networkStatuses, setNetworkStatuses] = useState<Record<string, boolean>>({})

  const workspaceContext = useWorkspaceContext()

  const rpcUrl = 'http://127.0.0.1:8899'

  async function fetchData() {
    // Fetch tokens from Jupiter API only once
    if (tokens.length === 0) {
      try {
        const response = await fetch('https://lite-api.jup.ag/tokens/v1/tagged/verified')
        const data = await response.json()

        // console.log(`data: ${JSON.stringify(data)}`)
        let usdc = filterTokensByTicker('USDC', data, true)
        let usdt = filterTokensByTicker('USDT', data, true)
        let ray = filterTokensByTicker('RAY', data, true)
        let jup = filterTokensByTicker('JUP', data, true)

        // Log the raw data first to debug
        console.log('Raw token data:', data)

        // Log each token search result
        console.log('USDC tokens:', usdc)
        console.log('USDT tokens:', usdt)
        console.log('RAY tokens:', ray)
        console.log('JUP tokens:', jup)

        // Log the filter function parameters for debugging
        console.log('Filter function called with:', {
          ticker: 'USDC',
          tokensLength: data.length,
          first: true,
        })
        setTokens(data)
        setTokenShortcuts([usdc[0], usdt[0], ray[0], jup[0]])
      } catch (error) {
        console.error('Error fetching tokens:', error)
      }
    }
  }

  const handleTokenSearch = (value: string) => {
    setTokenSearch(value)
    setTokenMatches(filterTokensByTicker(value, tokens, false))
  }

  useEffect(() => {
    fetchData()
  }, [])

  const filterTokensByTicker = (ticker: string, remoteTokens: any[], first: boolean): Token[] => {
    if (!ticker || !remoteTokens) return []
    const filteredTokens: Token[] = []
    const normalizedTicker = ticker.toLowerCase().trim()
    for (const entry of remoteTokens) {
      if (entry.symbol.toLowerCase() === normalizedTicker) {
        const token = {
          name: entry.name,
          ticker: entry.symbol,
          imageUrl: entry.logoURI,
          address: entry.address,
          decimals: entry.decimals,
        }
        if (first == true) {
          return [token]
        } else {
          filteredTokens.push(token)
        }
      }
    }
    return filteredTokens
  }

  const resetToInitialState = () => {
    setTokenFundingRequest([defaultFundingRequest])
    setReccipients([{ address: '' }])
  }

  const handleClaimTokens = async () => {
    // Store the tokens and recipients that were processed before resetting
    setProcessedTokens([...tokenFundingRequests])
    setProcessedRecipients([...reccipients])
    
    // Simulate claiming tokens
    setClaimedTokens(claimedTokens + 10)
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    })

    for (const tokenFundingRequest of tokenFundingRequests) {
      for (const recipient of reccipients) {
        console.log(`Sending ${tokenFundingRequest.amount} ${tokenFundingRequest.token.ticker} to ${recipient.address}`)
        console.log(``)
        // send surfnet_setTokenAccount RPC request
        var rpcRequest = {}
        if (tokenFundingRequest.token.address) {
          rpcRequest = {
            id: 1,
            jsonrpc: '2.0',
            method: 'surfnet_setTokenAccount',
            params: [recipient.address, tokenFundingRequest.token.address, { amount: tokenFundingRequest.amount * tokenFundingRequest.token.decimals }],
          }
        } else {
          rpcRequest = {
            id: 1,
            jsonrpc: '2.0',
            method: 'surfnet_setAccount',
            params: [recipient.address, { lamports: tokenFundingRequest.amount * tokenFundingRequest.token.decimals }],
          }
        }

        try {
          const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(rpcRequest),
          })
          if (!response.ok) {
            throw new Error('Network response was not ok')
          }
          const data = await response.json()
        } catch (error) {
          console.error('Error in RPC request:', error)
        }
      }
    }
    setSuccessDialogOpen(true)
    resetToInitialState()
  }

  const handleAddFundingRequest = () => {
    setTokenFundingRequest([...tokenFundingRequests, defaultFundingRequest])
  }

  const handleAddAddress = () => {
    setReccipients([...reccipients, { address: undefined }])
  }

  const handleTokenFundingRequestChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const newTokenFundingRequests = [...tokenFundingRequests]
    newTokenFundingRequests[index].amount = parseFloat(e.target.value)
    setTokenFundingRequest(newTokenFundingRequests)
  }

  return (
    <div className="faucet mx-auto flex min-h-[340px] w-full md:max-w-[340px] items-center justify-center rounded-xl bg-zinc-800 relative shadow-lg z-10 mt-3 md:mt-0">
      <div className="flex flex-col items-center space-y-2 pt-1">
        {/* Box 1: Tokens needed */}
        <Field className="w-full pl-4 uppercase">
          <Label className="text-lg">Faucet</Label>
        </Field>

        {tokenFundingRequests.map((tokenFundingRequest, index) => (
          <div key={index} className="flex flex-col items-center pr-1 pl-1">
            <Field className="rounded-xl bg-zinc-900 p-4">
              <Label className="text-lg">Amount</Label>
              <div className="flex items-center space-x-2">
                <input
                  id={`amount-${index}`}
                  type="text"
                  placeholder="0"
                  value={tokenFundingRequest.amount || ''}
                  className="w-full border-none bg-transparent text-left text-4xl focus:outline-none"
                  onChange={(e) => handleTokenFundingRequestChange(e, index)}
                  autoFocus
                />
                <div
                  className="flex cursor-pointer items-center justify-between rounded-full border border-zinc-700 p-2 text-xl uppercase hover:bg-zinc-800"
                  onClick={() => setTokenDialogOpen(index + 1)}
                >
                  <img
                    src={tokenFundingRequest.token.imageUrl}
                    alt={tokenFundingRequest.token.ticker}
                    className="h-8 w-8 rounded-full object-cover mr-2"
                  />
                  <span className="flex-grow text-right mr-5">{tokenFundingRequest.token.ticker}</span>
                  <ChevronDownIcon className="h-4 w-4" />
                </div>
              </div>
            </Field>
          </div>
        ))}

        <div
          className="-mt-6 gap-2 rounded-xl border-2 border-zinc-800 bg-zinc-950 p-2 uppercase cursor-pointer"
          onClick={() => handleAddFundingRequest()}
        >
          <PlusIcon className="h-6 w-6" />
        </div>

        <Field className="w-full pt-4 pl-4 uppercase">
          <Label className="text-sm">Recipients</Label>
        </Field>

        {reccipients.map((reccipient, index) => (
          <div key={index} className="flex w-full flex-col items-center pr-1 pl-1">
            <Field className="w-full rounded-xl bg-zinc-900 p-4 pt-5 pb-5">
              <div className="flex w-full items-center space-x-2">
                <input
                  type="text"
                  placeholder="ABAq2R9gSpDDGguQxBk4u13s4ZYW6zbwKVBx15mCMG8"
                  className="w-full border-none bg-transparent text-left text-[12px] focus:outline-none"
                  value={reccipient.address}
                  onChange={(e) => {
                    const newRecipients = [...reccipients]
                    newRecipients[index].address = e.target.value
                    setReccipients(newRecipients)
                  }}
                />
              </div>
            </Field>
          </div>
        ))}

        <div
          className="-mt-6 gap-2 rounded-xl border-2 border-zinc-800 bg-zinc-950 p-2 uppercase cursor-pointer"
          onClick={() => handleAddAddress()}
        >
          <PlusIcon className="h-6 w-6" />
        </div>


        <div className="absolute bottom-0 right-8 transform translate-y-1/2">
            <div
              className="flex gap-2 rounded-full bg-[#E034AE] p-4 text-center text-sm uppercase cursor-pointer"
              onClick={() => handleClaimTokens()}
            >
              <PlayIcon className="h-5 w-5" />
            </div>
            {/* <div className="flex h-full w-36 items-center justify-center gap-2 rounded-lg bg-zinc-700 p-2 text-center text-sm uppercase">
              Get Config
            </div> */}
          </div>

      </div>

      <Dialog open={tokenDialogOpen > 0} onClose={() => setTokenDialogOpen(0)} size="xl">
        <DialogDescription>{''}</DialogDescription>
        <input
          type="text"
          placeholder="Search for ticker (WSOL, $TRUMP, etc.)"
          className="w-full border-none bg-transparent text-left text-xl focus:outline-none"
          onChange={(e) => handleTokenSearch(e.target.value)}
          autoFocus
          ref={(input) => {
            if (tokenDialogOpen > 0 && input) {
              input.focus();
            }
          }}
        />
        <div className="mt-4 grid grid-cols-4 gap-4">
          {tokenShortcuts.map((tokenShortcut, index) => (
            <div
              key={index}
              className="flex cursor-pointer flex-col items-center rounded-xl bg-zinc-800 p-4 transition-colors"
              onClick={() => {
                const newTokenFundingRequests = [...tokenFundingRequests]
                newTokenFundingRequests[tokenDialogOpen - 1].token = tokenShortcut
                setTokenFundingRequest(newTokenFundingRequests)
                setTokenDialogOpen(0) // Close the dialog after selection
              }}
            >
              <img src={tokenShortcut.imageUrl} alt={tokenShortcut.ticker} className="mb-2 h-8 w-8" />
              <div className="text-center text-sm font-bold">{tokenShortcut.ticker}</div>
            </div>
          ))}
        </div>
        <div className="mt-8">
          {tokenMatches.map((tokenMatch, index) => (
            <div
              key={index}
              className="flex cursor-pointer flex-row items-center gap-6 rounded-xl border-2 border-zinc-700 p-4 transition-colors"
              onClick={() => {
                const newTokenFundingRequests = [...tokenFundingRequests]
                newTokenFundingRequests[tokenDialogOpen - 1].token = tokenMatch
                setTokenFundingRequest(newTokenFundingRequests)
                setTokenMatches([])
                setTokenSearch('')
                setTokenDialogOpen(0)
              }}
            >
              <img src={tokenMatch.imageUrl} alt={tokenMatch.ticker} className="mb-2 h-12 w-12 bg-transparent rounded-full" />
              <div className="text-center text-lg font-bold">{tokenMatch.ticker}</div>
            </div>
          ))}
        </div>
      </Dialog>
      <Dialog open={successDialogOpen} onClose={() => setSuccessDialogOpen(false)} size="3xl">
        <DialogTitle>Token Accounts Updated</DialogTitle>
        <DialogDescription>{''}</DialogDescription>
          {processedTokens.map((fundingRequest, tokenIndex) => (
            processedRecipients.map((recipient, recipientIndex) => (
              <div key={`${tokenIndex}-${recipientIndex}`} className="flex items-center gap-4 mt-4 p-4 rounded-lg bg-zinc-800/50">
                <img 
                  src={fundingRequest.token.imageUrl} 
                  alt={fundingRequest.token.ticker} 
                  className="h-8 w-8 rounded-full"
                />
                <div className="flex flex-col">
                  <div className="font-medium">
                    {fundingRequest.token.ticker}
                  </div>
                  <div className="text-sm text-zinc-400">
                    {fundingRequest.token.address} 
                  </div>
                  <div className="text-xs text-zinc-500">
                    To: {recipient.address}
                  </div>
                </div>
                <div className="ml-auto font-bold text-green-400">
                  {fundingRequest.amount} {fundingRequest.token.ticker}
                </div>
              </div>
            ))
          ))}
      </Dialog>
    </div>
  )
}
