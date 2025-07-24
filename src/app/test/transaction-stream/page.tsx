"use client"

import TransactionStream from '@/components/svm/transaction-stream';

export default function TransactionStreamPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Transaction Stream Demo</h1>
      
      <div className="grid gap-6">
        {/* All transactions */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">All Transactions</h2>
          <TransactionStream 
            maxTransactions={20}
            autoStart={true}
          />
        </div>

        {/* Filtered by specific program (e.g., SPL Token Program) */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">SPL Token Transactions</h2>
          <TransactionStream 
            maxTransactions={15}
            autoStart={false}
            filterByProgram="TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
          />
        </div>

        {/* Filtered by specific account */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Specific Account Transactions</h2>
          <TransactionStream 
            maxTransactions={10}
            autoStart={false}
            filterByAccount="9xQeWvG816bUx9EPf4rRkD3yKk1i1i1i1i1i1i1i1"
          />
        </div>
      </div>
    </div>
  );
} 