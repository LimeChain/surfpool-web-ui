import { useEffect, useState, useRef, useCallback } from 'react';

// Types for transaction data
export interface TransactionInfo {
  signatures: string[];
  slot: number;
  err: any;
  memo: string | null;
  blockTime: number | null;
  meta: {
    err: any;
    fee: number;
    preBalances: number[];
    postBalances: number[];
    innerInstructions: any[];
    logMessages: string[];
    preTokenBalances: any[];
    postTokenBalances: any[];
    rewards: any[];
    loadedAddresses: any;
    returnData: any;
    computeUnitsConsumed: number;
  } | null;
  transaction: {
    message: {
      accountKeys: string[];
      recentBlockhash: string;
      instructions: any[];
      header: {
        numRequiredSignatures: number;
        numReadonlySignedAccounts: number;
        numReadonlyUnsignedAccounts: number;
      };
    };
    signatures: string[];
  };
}

export interface TransactionStreamOptions {
  rpcUrl?: string;
  wsUrl?: string;
  maxTransactions?: number;
  autoStart?: boolean;
  filterByProgram?: string; // Program ID to filter transactions
  filterByAccount?: string; // Account to filter transactions
}

export interface TransactionStreamStats {
  totalReceived: number;
  successful: number;
  failed: number;
  lastUpdate: Date;
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
}

export function useTransactionStream(options: TransactionStreamOptions = {}) {
  const {
    rpcUrl,
    wsUrl,
    maxTransactions = 50,
    autoStart = true,
    filterByProgram,
    filterByAccount
  } = options;

  // Validate that required URLs are provided
  if (!rpcUrl || !wsUrl) {
    throw new Error('rpcUrl and wsUrl are required for useTransactionStream');
  }

  const [transactions, setTransactions] = useState<TransactionInfo[]>([]);
  const [isStreaming, setIsStreaming] = useState(autoStart);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<TransactionStreamStats>({
    totalReceived: 0,
    successful: 0,
    failed: 0,
    lastUpdate: new Date(),
    connectionStatus: 'disconnected'
  });
  
  const wsRef = useRef<WebSocket | null>(null);
  const subscriptionIdRef = useRef<number | null>(null);

  const startStreaming = useCallback(async () => {
    try {
      setError(null);
      setStats(prev => ({ ...prev, connectionStatus: 'connecting' }));
      
      // Convert HTTP RPC URL to WebSocket URL
      console.log('🔗 WebSocket URL:', wsUrl);
      // Create WebSocket connection
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setStats(prev => ({ ...prev, connectionStatus: 'connected' }));
        
        // Subscribe to all transaction logs (this will give us all transactions)
        const subscribeMessage = {
          jsonrpc: '2.0',
          id: 1,
          method: 'logsSubscribe',
          params: [
          ]
        };

        ws.send(JSON.stringify(subscribeMessage));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('🔌 WebSocket message received:', data);
          
          if (data.method === 'logsNotification') {
            // Handle log notifications
            const logData = data.params;
            console.log('🎯 LOG NOTIFICATION RECEIVED:', logData);
            
            if (logData?.result?.value?.signature) {
              const signature = logData.result.value.signature;
              console.log('✅ SIGNATURE FOUND:', signature);
              console.log('📊 Log data:', logData.result.value);
              
              // Fetch full transaction details
              console.log('🔄 Fetching transaction details for signature:', signature);
              fetchTransactionDetails(signature);
            } else {
              console.log('⚠️ No signature found in log notification');
              console.log('🔍 Full log data:', logData);
            }
          } else if (data.result !== undefined && data.id === 1) {
            // Subscription confirmation
            subscriptionIdRef.current = data.result;
            console.log('✅ SUBSCRIPTION CONFIRMED with ID:', data.result);
          } else {
            console.log('📨 Other message type:', data.method || 'unknown');
          }
        } catch (err) {
          console.error('❌ Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('WebSocket connection error');
        setStats(prev => ({ ...prev, connectionStatus: 'error' }));
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsStreaming(false);
        setStats(prev => ({ ...prev, connectionStatus: 'disconnected' }));
      };

    } catch (err) {
      console.error('Error starting transaction stream:', err);
      setError('Failed to start transaction stream');
      setStats(prev => ({ ...prev, connectionStatus: 'error' }));
    }
  }, [rpcUrl, filterByAccount]);

  const fetchTransactionDetails = useCallback(async (signature: string) => {
    try {
      console.log('🌐 Fetching transaction details from:', rpcUrl);
      console.log('📋 Signature:', signature);
      
      const requestBody = {
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [
          signature,
          {
            encoding: 'jsonParsed',
            maxSupportedTransactionVersion: 0
          }
        ]
      };
      
      console.log('📤 Request body:', requestBody);
      
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response ok:', response.ok);

      const data = await response.json();
      console.log('📥 Transaction fetch response:', data);
      
      if (data.result) {
        const txInfo: TransactionInfo = data.result;
        console.log('✅ Transaction details received:', {
          signature: txInfo.transaction.signatures[0],
          slot: txInfo.slot,
          blockTime: txInfo.blockTime,
          hasError: !!txInfo.meta?.err,
          fee: txInfo.meta?.fee,
          computeUnits: txInfo.meta?.computeUnitsConsumed
        });
        
        // Filter by program if specified
        if (filterByProgram) {
          const hasProgram = txInfo.transaction.message.instructions.some(
            (instruction: any) => instruction.programId === filterByProgram
          );
          if (!hasProgram) {
            console.log('🚫 Transaction filtered out (program mismatch)');
            return;
          }
        }
        
        console.log('📊 Adding transaction to state...');
        setTransactions(prev => {
          const newTransactions = [txInfo, ...prev].slice(0, maxTransactions);
          console.log('📈 Transaction added! Total transactions now:', newTransactions.length);
          return newTransactions;
        });

        setStats(prev => {
          const newStats = {
            ...prev,
            totalReceived: prev.totalReceived + 1,
            successful: prev.successful + (txInfo.meta?.err ? 0 : 1),
            failed: prev.failed + (txInfo.meta?.err ? 1 : 0),
            lastUpdate: new Date()
          };
          console.log('📊 Stats updated:', newStats);
          return newStats;
        });
      } else {
        console.log('❌ No transaction result in response');
      }
    } catch (err) {
      console.error('Error fetching transaction details:', err);
    }
  }, [rpcUrl, filterByProgram, maxTransactions]);

  const stopStreaming = useCallback(() => {
    if (wsRef.current && subscriptionIdRef.current) {
      // Unsubscribe from logs
      const unsubscribeMessage = {
        jsonrpc: '2.0',
        id: 2,
        method: 'logsUnsubscribe',
        params: [subscriptionIdRef.current]
      };
      
      wsRef.current.send(JSON.stringify(unsubscribeMessage));
      wsRef.current.close();
    }
    setIsStreaming(false);
  }, []);

  const toggleStreaming = useCallback(() => {
    if (isStreaming) {
      stopStreaming();
    } else {
      startStreaming();
    }
  }, [isStreaming, startStreaming, stopStreaming]);

  const clearTransactions = useCallback(() => {
    setTransactions([]);
    setStats(prev => ({
      ...prev,
      totalReceived: 0,
      successful: 0,
      failed: 0,
      lastUpdate: new Date()
    }));
  }, []);

  // Auto-start streaming
  useEffect(() => {
    if (autoStart) {
      startStreaming();
    }

    return () => {
      stopStreaming();
    };
  }, [autoStart, startStreaming, stopStreaming]);

  return {
    transactions,
    isStreaming,
    error,
    stats,
    startStreaming,
    stopStreaming,
    toggleStreaming,
    clearTransactions
  };
}

// Utility functions
export const formatSignature = (signature: string) => {
  return `${signature.slice(0, 8)}...${signature.slice(-8)}`;
};

export const formatTime = (timestamp: number | null) => {
  if (!timestamp) return 'N/A';
  return new Date(timestamp * 1000).toLocaleTimeString();
};

export const getTransactionStatus = (tx: TransactionInfo) => {
  if (tx.meta?.err) return 'failed';
  if (tx.meta) return 'success';
  return 'pending';
};

export const getTransactionPrograms = (tx: TransactionInfo): string[] => {
  if (!tx.transaction?.message?.instructions) return [];
  
  return tx.transaction.message.instructions
    .map((instruction: any) => instruction.programId)
    .filter((programId: string, index: number, arr: string[]) => 
      arr.indexOf(programId) === index
    );
}; 