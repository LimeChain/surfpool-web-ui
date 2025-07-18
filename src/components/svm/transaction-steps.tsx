'use client'

export default function TransactionSteps() {
  const transactionSteps = [
    { 
      id: 1, 
      title: 'Compute Budget Program: Set Compute Unit Price',
      status: 'completed'
    },
    { 
      id: 2, 
      title: 'Sage: Deposit Cargo To Fleet',
      status: 'in-progress'
    },
    { 
      id: 3, 
      title: 'Token Program: Transfer',
      status: 'pending'
    }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'in-progress': return 'bg-yellow-500'
      case 'pending': return 'bg-zinc-600'
      default: return 'bg-zinc-600'
    }
  }

  const getProgressWidth = (status: string) => {
    switch (status) {
      case 'completed': return '100%'
      case 'in-progress': return '60%'
      case 'pending': return '0%'
      default: return '0%'
    }
  }

  return (
    <div className="w-full rounded-2xl bg-zinc-900 p-6 mt-8">
      <div className="text-sm font-medium text-white uppercase mb-4">TRANSACTIONS</div>
      
      <div className="space-y-2">
        {transactionSteps.map((step) => (
          <div key={step.id} className="flex items-center justify-between rounded-lg bg-zinc-800 p-4">
            <div className="flex items-center space-x-3">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${getStatusColor(step.status)}`}>
                {step.id}
              </div>
              <span className="text-white text-sm">{step.title}</span>
            </div>
            <div className="h-2 w-32 overflow-hidden rounded-full bg-zinc-700">
              <div 
                className={`h-full transition-all duration-300 ${getStatusColor(step.status)}`}
                style={{ width: getProgressWidth(step.status) }}
              />
            </div>
          </div>
        ))}
        
        {/* Success transaction indicator */}
        <div className="flex items-center space-x-2 rounded-lg bg-zinc-800 p-3">
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500">
            <span className="text-xs text-white">✓</span>
          </div>
          <span className="text-xs text-green-400 font-medium">success</span>
          <span className="text-xs text-zinc-400">4MxmjFNpehGLn9bQXFsRhvq3TBuS3oatYJAe35...</span>
        </div>
      </div>
      
      {/* Compute Budget Section */}
      <div className="mt-6">
        <div className="text-sm font-medium text-white uppercase mb-3">COMPUTE BUDGET</div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-700">
          <div className="h-full w-3/4 bg-yellow-500" />
        </div>
      </div>
    </div>
  )
} 