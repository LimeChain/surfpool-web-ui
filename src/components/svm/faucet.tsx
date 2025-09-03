'use client';

import { useWorkspaceContext } from '@/contexts/workspace-context';
import { useAppConfig } from '@/hooks/use-app-config';
import { convertToRawAmount, truncateAddress as truncateAddressUtil } from '@/lib/address-utils';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { PlayIcon, PlusIcon } from '@heroicons/react/24/solid';
import { generateKeyPair, lamports } from '@solana/kit';
import confetti from 'canvas-confetti';
import { useEffect, useState } from 'react';
import { Dialog, DialogDescription, DialogTitle } from '../catalyst/dialog';
import { Field, Label } from '../catalyst/fieldset';
import AddressDisplay from './address-display';
import TokenAmountDisplay from './token-amount-display';
import { getAccountBalance, getTokenBalance, setAccount } from '@/lib/solana-transaction-stream';

const LAMPORTS_PER_SOL = 1000000000;

export type Network = {
  id: string;
  name: string;
  description: string;
  status: string;
  created_at: string;
  rpc_url: string;
  datasource_rpc_url: string;
};

interface Token {
  ticker: string;
  imageUrl: string;
  address?: string;
  name: string;
  decimals: number;
}

interface TokenRequest {
  token: Token;
  amount: number;
}

interface SetAccountRequest {
  address: string;
  lamports: number;
}

const DEFAULT_LAMPORTS_TO_FUND = LAMPORTS_PER_SOL; // 1 SOL

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
  };
  const [tokenDialogOpen, setTokenDialogOpen] = useState(0);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [tokenShortcuts, setTokenShortcuts] = useState<Token[]>([]);
  const [tokenMatches, setTokenMatches] = useState<Token[]>([]);
  const [claimedTokens, setClaimedTokens] = useState(0);
  const [tokenFundingRequests, setTokenFundingRequest] = useState<TokenRequest[]>([defaultFundingRequest]);
  const [inputValues, setInputValues] = useState<string[]>(['']);
  const [processedTokens, setProcessedTokens] = useState<TokenRequest[]>([]);
  const [processedRecipients, setProcessedRecipients] = useState<{ address: string | undefined; ataAddress?: string | undefined; isGenerated: boolean }[]>([]);
  const [processedTokenBalances, setProcessedTokenBalances] = useState<Map<string, { token: Token; finalBalance: number }[]>>(new Map());
  const [reccipients, setReccipients] = useState<
    {
      address: string | undefined;
      isGenerated: boolean;
    }[]
  >([
    {
      address: '',
      isGenerated: false,
    },
  ]);
  const [tokenSearch, setTokenSearch] = useState('');

  const [tokens, setTokens] = useState<any[]>([]);

  const [networkStatuses, setNetworkStatuses] = useState<Record<string, boolean>>({});
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  const workspaceContext = useWorkspaceContext();
  const { rpcUrl, loading: configLoading, error: configError } = useAppConfig();

  // Helper functions for AddressDisplay
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStates((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedStates((prev) => ({ ...prev, [id]: false }));
    }, 2000);
  };

  const truncateAddress = truncateAddressUtil;

  async function fetchData() {
    // Fetch tokens from Jupiter API only once
    if (tokens.length === 0) {
      try {
        const response = await fetch('https://lite-api.jup.ag/tokens/v1/tagged/verified');
        const data = await response.json();

        // console.log(`data: ${JSON.stringify(data)}`)
        let usdc = filterTokensByTicker('USDC', data, true);
        let usdt = filterTokensByTicker('USDT', data, true);
        let ray = filterTokensByTicker('RAY', data, true);
        let jup = filterTokensByTicker('JUP', data, true);

        // Log the raw data first to debug
        console.log('Raw token data:', data);

        // Log each token search result
        console.log('USDC tokens:', usdc);
        console.log('USDT tokens:', usdt);
        console.log('RAY tokens:', ray);
        console.log('JUP tokens:', jup);

        // Log the filter function parameters for debugging
        console.log('Filter function called with:', {
          ticker: 'USDC',
          tokensLength: data.length,
          first: true,
        });
        setTokens(data);
        setTokenShortcuts([usdc[0], usdt[0], ray[0], jup[0]]);
      } catch (error) {
        console.error('Error fetching tokens:', error);
      }
    }
  }

  const handleTokenSearch = (value: string) => {
    setTokenSearch(value);
    setTokenMatches(filterTokensByTicker(value, tokens, false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filterTokensByTicker = (ticker: string, remoteTokens: any[], first: boolean): Token[] => {
    if (!ticker || !remoteTokens) return [];
    const filteredTokens: Token[] = [];
    const normalizedTicker = ticker.toLowerCase().trim();
    for (const entry of remoteTokens) {
      if (entry.symbol.toLowerCase() === normalizedTicker) {
        const token = {
          name: entry.name,
          ticker: entry.symbol,
          imageUrl: entry.logoURI,
          address: entry.address,
          decimals: entry.decimals,
        };
        if (first == true) {
          return [token];
        } else {
          filteredTokens.push(token);
        }
      }
    }
    return filteredTokens;
  };

  const resetToInitialState = () => {
    setTokenFundingRequest([defaultFundingRequest]);
    setInputValues(['']);
    setReccipients([{ address: '', isGenerated: false }]);
  };

  const handleClaimTokens = async () => {
    // Store the tokens and recipients that were processed before resetting
    setProcessedTokens([...tokenFundingRequests]);
    
    // Reset processed recipients for this new airdrop
    const currentAirdropRecipients: { address: string | undefined; ataAddress?: string | undefined; isGenerated: boolean }[] = [];
    const recipientMap = new Map<string, { address: string | undefined; ataAddress?: string | undefined; isGenerated: boolean }>();
    const tokenBalancesMap = new Map<string, { token: Token; finalBalance: number }[]>();

    // Simulate claiming tokens
    setClaimedTokens(claimedTokens + 10);
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });

    for (const tokenFundingRequest of tokenFundingRequests) {
      for (const recipient of reccipients) {
        console.log(
          `Sending ${tokenFundingRequest.amount} ${tokenFundingRequest.token.ticker} to ${recipient.address}`
        );
        console.log(``);

        const is_spl_token: boolean = tokenFundingRequest.token.ticker != 'SOL';
      
        const accountBalance = await getAccountBalance(recipient.address || '', rpcUrl);  // if > 0, the account already exists else account not exists
        if (!accountBalance && is_spl_token) {
          try {
            const response = await setAccount(recipient.address || '', DEFAULT_LAMPORTS_TO_FUND, rpcUrl);
            console.log('SetAccountRequest response:', response);
          } catch (error) {
            console.error('Error in RPC request:', error);
          }
        }  
        let rpcRequest: any = {};
        // now that the account exists lets see if we need to fund it with spl-tokens or lamports
        if (tokenFundingRequest.token.address && is_spl_token){
          const tokenAcountInfo = await getTokenBalance(recipient.address || '', tokenFundingRequest.token.address || '', rpcUrl);
          const balanceUiAmount = Number(tokenAcountInfo?.tokenAmount?.uiAmount) || 0;
          const fundingAmount = Number(tokenFundingRequest.amount) || 0;
          const totalUiAmount = balanceUiAmount + fundingAmount; 
          const ata_address = tokenAcountInfo?.ata_address;
          rpcRequest = {
            id: 1,
            jsonrpc: '2.0',
            method: 'surfnet_setTokenAccount',
            params: [
              recipient.address,
              tokenFundingRequest.token.address,
              { amount: convertToRawAmount(totalUiAmount, tokenFundingRequest.token.decimals) },
            ],
          };
          // Store final balance for this token and recipient
          if (recipient.address) {
            const existingBalances = tokenBalancesMap.get(recipient.address) || [];
            existingBalances.push({ token: tokenFundingRequest.token, finalBalance: totalUiAmount });
            tokenBalancesMap.set(recipient.address, existingBalances);
            
            // Use map to deduplicate recipients by address
            const existing = recipientMap.get(recipient.address);
            if (existing) {
              // Update existing entry with ATA address if not already present
              if (ata_address && !existing.ataAddress) {
                existing.ataAddress = ata_address;
              }
            } else {
              recipientMap.set(recipient.address, {address: recipient.address, ataAddress: ata_address, isGenerated: recipient.isGenerated});
            }
          }
        } else {
          const balanceUiAmount = Number(accountBalance) || 0;
          const fundingAmount = Number(tokenFundingRequest.amount) || 0;
          const totalUiAmount = balanceUiAmount + fundingAmount; 
          rpcRequest = {
            id: 1,
            jsonrpc: '2.0',
            method: 'surfnet_setAccount',
            params: [
              recipient.address,
              { lamports: convertToRawAmount(totalUiAmount, 9) },
            ],
          };
          // Store final balance for this token and recipient
          if (recipient.address) {
            const existingBalances = tokenBalancesMap.get(recipient.address) || [];
            existingBalances.push({ token: tokenFundingRequest.token, finalBalance: totalUiAmount });
            tokenBalancesMap.set(recipient.address, existingBalances);
            
            // Use map to deduplicate recipients by address
            const existing = recipientMap.get(recipient.address);
            if (!existing) {
              recipientMap.set(recipient.address, {address: recipient.address, isGenerated: recipient.isGenerated});
            }
          }
        }
        try {
          const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(rpcRequest),
          });
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          const data = await response.json();
        } catch (error) {
          console.error('Error in RPC request:', error);
        }
      }
    }
    
    // Convert map back to array
    const uniqueRecipients = Array.from(recipientMap.values());
    setProcessedRecipients(uniqueRecipients);
    setProcessedTokenBalances(tokenBalancesMap);
    setSuccessDialogOpen(true);
    resetToInitialState();
  };

  const handleAddFundingRequest = () => {
    setTokenFundingRequest([...tokenFundingRequests, defaultFundingRequest]);
    setInputValues([...inputValues, '']);
  };

  const handleAddAddress = () => {
    setReccipients([...reccipients, { address: undefined, isGenerated: false }]);
  };

  const generateKeypair = async (index: number) => {
    const keypair = await generateKeyPair();

    // Convert CryptoKey to base58 string
    const publicKeyBuffer = await crypto.subtle.exportKey('raw', keypair.publicKey);
    const publicKeyArray = new Uint8Array(publicKeyBuffer);

    // Convert to base58
    const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let num = BigInt(0);
    for (let i = 0; i < publicKeyArray.length; i++) {
      num = num * BigInt(256) + BigInt(publicKeyArray[i]);
    }

    let result = '';
    while (num > 0) {
      result = base58Chars[Number(num % BigInt(58))] + result;
      num = num / BigInt(58);
    }

    // Add leading zeros
    for (let i = 0; i < publicKeyArray.length && publicKeyArray[i] === 0; i++) {
      result = '1' + result;
    }

    const newRecipients = [...reccipients];
    newRecipients[index].address = result;
    newRecipients[index].isGenerated = true;
    setReccipients(newRecipients);
  };

  const handleTokenFundingRequestChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const value = e.target.value;

    // Update the input display value
    const newInputValues = [...inputValues];
    newInputValues[index] = value;
    setInputValues(newInputValues);

    // Update the actual amount if it's a valid number
    const newTokenFundingRequests = [...tokenFundingRequests];
    if (value === '') {
      newTokenFundingRequests[index].amount = 0;
    } else {
      const parsedValue = parseFloat(value);
      if (!isNaN(parsedValue)) {
        newTokenFundingRequests[index].amount = parsedValue;
      }
    }

    setTokenFundingRequest(newTokenFundingRequests);
  };

  // Check if the faucet can be activated (has amount and address)
  const canActivateFaucet = () => {
    // Check if any token has a valid amount
    const hasValidAmount = tokenFundingRequests.some((request) => request.amount > 0);

    // Check if any recipient has a valid address
    const hasValidAddress = reccipients.some((recipient) => recipient.address && recipient.address.trim() !== '');

    return hasValidAmount && hasValidAddress;
  };

  return (
    <div className="faucet relative z-10 mx-auto mt-3 flex min-h-[340px] w-full items-center justify-center rounded-xl bg-zinc-800 pb-5 shadow-lg md:mt-0">
      <div className="flex flex-col items-center space-y-2 pt-1">
        {/* Box 1: Tokens needed */}
        <Field className="w-full pl-4 uppercase">
          <Label className="text-sm sm:text-sm md:text-sm lg:text-sm">Faucet</Label>
        </Field>

        {tokenFundingRequests.map((tokenFundingRequest, index) => (
          <div key={index} className="flex flex-col items-center pr-1 pl-1">
            <Field className="rounded-xl bg-zinc-900 p-4">
              <Label className="text-lg sm:text-lg md:text-lg lg:text-lg">Amount</Label>
              <div className="flex items-center space-x-2">
                <input
                  id={`amount-${index}`}
                  type="text"
                  placeholder="0"
                  value={inputValues[index] || ''}
                  className="w-full border-none bg-transparent text-left !text-4xl focus:outline-none sm:text-4xl md:text-4xl lg:text-4xl"
                  onChange={(e) => handleTokenFundingRequestChange(e, index)}
                />
                <div
                  className="flex cursor-pointer items-center justify-between rounded-full border-2 border-dashed border-zinc-600 p-2 uppercase hover:bg-zinc-800 hover:border-zinc-500 sm:text-xl md:text-xl lg:text-xl"
                  onClick={() => setTokenDialogOpen(index + 1)}
                >
                  <img
                    src={tokenFundingRequest.token.imageUrl}
                    alt={tokenFundingRequest.token.ticker}
                    className="mr-2 h-8 w-8 rounded-full object-cover"
                  />
                  <span className="mr-5 flex-grow text-right">{tokenFundingRequest.token.ticker}</span>
                  <ChevronDownIcon className="h-4 w-4" />
                </div>
              </div>
            </Field>
          </div>
        ))}

        <div
          className="-mt-6 cursor-pointer gap-2 rounded-xl border-2 border-zinc-800 bg-zinc-950 p-2 uppercase"
          onClick={() => handleAddFundingRequest()}
        >
          <PlusIcon className="h-6 w-6" />
        </div>

        <Field className="w-full pt-4 pl-4 uppercase">
          <Label className="sm:text-sm md:text-sm lg:text-sm">Recipients</Label>
        </Field>

        <div className="mb-6 w-full">
          {reccipients.map((reccipient, index) => (
            <div key={index} className="relative flex w-full flex-col items-center pt-1 pr-1 pl-1">
              <Field className="w-full rounded-xl bg-zinc-900 p-4 pt-5 pb-5">
                <div className="flex w-full items-center space-x-2">
                  <input
                    type="text"
                    placeholder="ABAq2R9gSpDDGguQxBk4u13s4ZYW6zbwKVBx15mCMG8"
                    className="w-full border-none bg-transparent text-left focus:outline-none sm:text-[12px] md:text-[12px] lg:text-[12px]"
                    value={reccipient.address}
                    onChange={(e) => {
                      const newRecipients = [...reccipients];
                      newRecipients[index].address = e.target.value;
                      setReccipients(newRecipients);
                    }}
                  />
                </div>
              </Field>
              <button
                onClick={() => generateKeypair(index)}
                className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 transition-colors"
                title="Generate new keypair"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            </div>
          ))}

          <div
            className="absolute left-1/2 z-10 -mt-4 h-11 w-11 -translate-x-1/2 transform cursor-pointer rounded-xl border-2 border-zinc-800 bg-zinc-950 p-2 uppercase"
            onClick={() => handleAddAddress()}
          >
            <PlusIcon className="h-6 w-6" />
          </div>
        </div>

        <div className="absolute right-8 bottom-0 translate-y-1/2 transform">
          <div
            className={`flex gap-2 rounded-full p-4 text-center text-sm uppercase transition-colors ${
              canActivateFaucet() ? 'cursor-pointer bg-[#E034AE] hover:bg-[#C02A8F]' : 'cursor-not-allowed bg-zinc-600'
            }`}
            onClick={() => {
              if (canActivateFaucet()) {
                handleClaimTokens();
              }
            }}
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
                const newTokenFundingRequests = [...tokenFundingRequests];
                newTokenFundingRequests[tokenDialogOpen - 1].token = tokenShortcut;
                setTokenFundingRequest(newTokenFundingRequests);
                setTokenDialogOpen(0); // Close the dialog after selection
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
                const newTokenFundingRequests = [...tokenFundingRequests];
                newTokenFundingRequests[tokenDialogOpen - 1].token = tokenMatch;
                setTokenFundingRequest(newTokenFundingRequests);
                setTokenMatches([]);
                setTokenSearch('');
                setTokenDialogOpen(0);
              }}
            >
              <img
                src={tokenMatch.imageUrl}
                alt={tokenMatch.ticker}
                className="mb-2 h-12 w-12 rounded-full bg-transparent"
              />
              <div className="text-center text-lg font-bold">{tokenMatch.ticker}</div>
            </div>
          ))}
        </div>
      </Dialog>
      <Dialog open={successDialogOpen} onClose={() => setSuccessDialogOpen(false)} size="3xl">
        <DialogTitle>Token Accounts Updated</DialogTitle>
        <DialogDescription>{''}</DialogDescription>
        <div className="space-y-6">
          {processedRecipients.map((recipient, recipientIndex) => {
            // Get all tokens sent to this recipient
            const tokensForRecipient = processedTokens.map((fundingRequest, tokenIndex) => ({
              ...fundingRequest,
              tokenIndex,
              recipientIndex,
            })).filter((fundingRequest) => fundingRequest.amount > 0);

            // Check if this address was generated using our keypair generator
            const isGeneratedAddress = recipient.isGenerated;

            return (
              <div key={recipientIndex} className="rounded-lg bg-zinc-800/50 p-4">
                <div className="mb-4">
                  <div className="text-sm font-medium text-zinc-400 mb-2">Wallet Address:</div>
                  {recipient.address ? (
                    <AddressDisplay
                      address={recipient.address}
                      copiedStates={copiedStates}
                      copyToClipboard={copyToClipboard}
                      truncateAddress={truncateAddress}
                      copyId={`success-wallet-${recipientIndex}`}
                      showCopyButton={true}
                      aggressiveTruncate={false}
                    />
                  ) : (
                    <div className="text-zinc-500">No address</div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-medium text-zinc-400 mb-2">Updated Balances:</div>
                  {(() => {
                    const tokenBalances = processedTokenBalances.get(recipient.address || '') || [];
                    return tokenBalances.map((tokenBalance, index) => (
                      <div key={`${tokenBalance.token.ticker}-${index}`} className="flex items-center gap-3 rounded-lg bg-zinc-700/50 p-3">
                        <img
                          src={tokenBalance.token.imageUrl}
                          alt={tokenBalance.token.ticker}
                          className="h-6 w-6 rounded-full"
                        />
                        <div className="flex flex-1 flex-col">
                          <div className="font-medium text-sm">{tokenBalance.token.ticker}</div>
                          {/* Show ATA address first for SPL tokens if available */}
                          {tokenBalance.token.ticker !== 'SOL' && recipient.ataAddress && (
                            <div className="text-xs text-zinc-400">
                              <span className="text-zinc-500">Associated Token Address (ATA):</span>
                              <AddressDisplay
                                address={recipient.ataAddress}
                                copiedStates={copiedStates}
                                copyToClipboard={copyToClipboard}
                                truncateAddress={truncateAddress}
                                copyId={`ata-${index}-${recipientIndex}`}
                                showCopyButton={true}
                                aggressiveTruncate={false}
                              />
                            </div>
                          )}
                          {/* Show token mint address for SPL tokens */}
                          {tokenBalance.token.address && tokenBalance.token.address.trim() !== '' && (
                            <div className="text-xs text-zinc-400 mt-1">
                              <span className="text-zinc-500">Token Address:</span>
                              <AddressDisplay
                                address={tokenBalance.token.address}
                                copiedStates={copiedStates}
                                copyToClipboard={copyToClipboard}
                                truncateAddress={truncateAddress}
                                copyId={`token-${index}-${recipientIndex}`}
                                showCopyButton={true}
                                aggressiveTruncate={false}
                              />
                            </div>
                          )}
                        </div>
                        <div className="text-sm font-bold text-zinc-300">
                          <TokenAmountDisplay
                            amount={convertToRawAmount(tokenBalance.finalBalance, tokenBalance.token.decimals)}
                            decimals={tokenBalance.token.decimals}
                            symbol={tokenBalance.token.ticker}
                            variant="default"
                          />
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                {isGeneratedAddress && (
                  <div className="mt-4 pt-4 border-t border-zinc-700 flex justify-end">
                    <button
                      onClick={() => {
                        // Generate a random private key array for the generated address
                        const privateKeyArray = Array.from({ length: 64 }, () => Math.floor(Math.random() * 256));
                        const keypairData = privateKeyArray;
                        
                        // Create and download the JSON file
                        const blob = new Blob([JSON.stringify(keypairData, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${recipient.address}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="flex items-center gap-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download Keypair
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Dialog>
    </div>
  );
}
