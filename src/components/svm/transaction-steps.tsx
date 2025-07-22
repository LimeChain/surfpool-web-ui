"use client"

import { Badge } from '@/components/catalyst/badge';

type StepStatus = "success" | "Compute Budget" | "pending";

const txHash = "4MkrqjFNbgitGLh8oX2FsEDxAdUsFhw3Et9uS3oadYJAe3j5";

const steps = [
  {
    id: 1,
    title: "COMPUTE BUDGET PROGRAM: SET COMPUTE UNIT PRICE",
    status: "success" as StepStatus,
    progress: 1.0,
    showDiff: false,
    pre: undefined,
    post: undefined,
  },
  {
    id: 2,
    title: "SAGE: DEPOSIT CARGO TO FLEET",
    status: "Compute Budget" as StepStatus,
    progress: 0.65,
    showDiff: true,
    pre: `{
  "pubkey": "9xQeWvG816bUx9EPf4rRkD3yKk1i1i1i1i1i1i1i1i1",
  "owner": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "lamports": 2039280,
  "data": {
    "mint": "So11111111111111111111111111111111111111112",
    "owner": "Fh8k138qQ38qQ38qQ38qQ38qQ38qQ38qQ38qQ38qQ",
    "amount": 1000000
  }
}`,
    post: `{
  "pubkey": "9xQeWvG816bUx9EPf4rRkD3yKk1i1i1i1i1i1i1i1i1",
  "owner": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "lamports": 2039280,
  "data": {
    "mint": "So11111111111111111111111111111111111111112",
    "owner": "Fh8k138qQ38qQ38qQ38qQ38qQ38qQ38qQ38qQ38qQ",
    "amount": 900000
  }
}`
  },
  {
    id: 3,
    title: "TOKEN PROGRAM: TRANSFER",
    status: "pending" as StepStatus,
    progress: 0.1,
    showDiff: false,
    pre: undefined,
    post: undefined,
  },
];

const statusColors: Record<StepStatus, string> = {
  success: "border-l-[3px] border-[#60d695]",
  "Compute Budget": "border-l-[3px] border-[#fd991b]",
  pending: "border-l-[3px] border-[#606060]",
};

const badgeColors: Record<StepStatus, string> = {
  success: "px-2 py-1 bg-green-100 text-xs font-semibold text-white rounded-full",
  "Compute Budget": "bg-[#3C5F4F]/60 text-white", 
  pending: "bg-[#3C5F4F]/60 text-white",
};

const progressColors: Record<StepStatus, string> = {
  success: "bg-[#60d695]",
  "Compute Budget": "bg-[#fd991b]",
  pending: "bg-[#606060]",
};

const diffRemove = "bg-[#8c4649]/40";
const diffAdd = "bg-[#0d9916]/40";

function highlightJsonDiff(pre: string, post: string) {
  const preLines = pre.split("\n");
  const postLines = post.split("\n");
  
  return {
    pre: preLines.map((line, i) => {
      const postLine = postLines[i];
      if (postLine && line.includes('"amount"') && line !== postLine) {
        return (
          <div key={i} className={`${diffRemove} -mx-1 px-1`}>{line}</div>
        );
      }
      return <div key={i}>{line}</div>;
    }),
    post: postLines.map((line, i) => {
      const preLine = preLines[i];
      if (preLine && line.includes('"amount"') && line !== preLine) {
        return (
          <div key={i} className={`${diffAdd} -mx-1 px-1`}>{line}</div>
        );
      }
      return <div key={i}>{line}</div>;
    })
  };
}

export default function TransactionSteps() {
  return (
    <div className="w-full max-w-6xl mx-auto mt-8 space-y-6 flex flex-col gap-4">
      <div className="mb-0">
        <h2 className="text-sm font-medium text-white uppercase tracking-wide">TRANSACTIONS</h2>
      </div>
      <div className='bg-[#262629] rounded-lg p-4'>
      {/* Hash and badge card */}
      <div className="rounded-lg bg-[#232323] px-6 py-3 mb-6 flex items-center gap-4">
        <Badge color="green" className="font-bold">SUCCESS</Badge>
        <span className="text-sm text-gray-300 font-mono">{txHash}</span>
        <button className="ml-auto p-1.5 rounded hover:bg-[#333333] transition-colors" title="Copy hash">
          <svg width="16" height="16" fill="none" viewBox="0 0 16 16">
            <rect x="4" y="4" width="8" height="8" rx="2" fill="#808080"/>
            <rect x="2" y="2" width="8" height="8" rx="2" stroke="#808080" strokeWidth="1.5"/>
          </svg>
        </button>
      </div>

      {/* Steps */}
      <div className="space-y-6">
        {steps.map((step) => (
          <div key={step.id} className={`rounded-lg bg-[#232323] overflow-hidden ${statusColors[step.status]}`}> 
            {/* Step header */}
            <div className="flex items-center px-6 py-5">
              <Badge color={step.status === 'success' ? 'green' : step.status === 'Compute Budget' ? 'orange' : 'zinc'} className="w-9 h-9 flex items-center justify-center font-bold text-sm mr-5">#{step.id}</Badge>
              <span className="text-white font-semibold text-sm ml-0">{step.title}</span>
              <div className="flex-1" />
              <Badge
                color={step.status === 'success' ? 'green' : step.status === 'Compute Budget' ? 'orange' : 'zinc'}
                className="font-bold mr-6"
              >
                {step.status.toUpperCase()}
              </Badge> 
              <div className="w-56 h-1.5 bg-[#404040] rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${progressColors[step.status]}`} 
                  style={{ width: `${step.progress * 100}%` }} 
                /> 
              </div>
            </div>

            {/* Diff view */}
            {step.showDiff && step.pre && step.post && (
              <div className="bg-[#1e1e1e] px-6 py-5 border-t border-[#404040]">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <div className="text-xs text-gray-500 mb-3 font-medium uppercase">SELF</div>
                    <pre className="bg-[#141414] text-xs text-gray-300 font-mono rounded p-4 overflow-x-auto leading-relaxed">
                      {highlightJsonDiff(step.pre, step.post).pre}
                    </pre>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-gray-500 font-medium uppercase">SELF</span> 
                    </div>
                    <pre className="bg-[#141414] text-xs text-gray-300 font-mono rounded p-4 overflow-x-auto leading-relaxed">
                      {highlightJsonDiff(step.pre, step.post).post}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      </div>
    </div>
  );
} 