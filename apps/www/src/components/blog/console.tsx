'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

interface ConsoleProps {
  children: string;
}

export function Console({ children }: ConsoleProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    // Remove comment lines for clipboard
    const code = children
      .trim()
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n');
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = children.trim().split('\n');

  // Commands that should get a $ prefix
  const commandStarts = ['curl', 'surfpool', 'npm', 'pnpm', 'yarn', 'cargo', 'git', 'cd', 'ls', 'mkdir', 'rm', 'cp', 'mv', 'cat', 'echo', 'export', 'source', 'bash', 'sh', 'node', 'python', 'pip', 'brew', 'apt', 'yum', 'docker', 'kubectl'];

  const getLinePrefix = (line: string): 'prompt' | 'continuation' | 'comment' => {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) return 'comment';
    if (!trimmed) return 'continuation';

    // Check if line starts with a known command
    const firstWord = trimmed.split(/\s/)[0];
    if (commandStarts.includes(firstWord)) return 'prompt';

    return 'continuation';
  };

  return (
    <div className="group relative my-8 overflow-hidden rounded-xl border border-zinc-800/80 bg-[#0c0c0c]">
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-2">
        <span className="text-xs text-zinc-500">Terminal</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          aria-label="Copy to clipboard"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-[0.875rem] leading-relaxed">
        {lines.map((line, i) => {
          const prefix = getLinePrefix(line);
          return (
            <div key={i} className="flex">
              <span className="mr-3 w-3 select-none text-zinc-600">
                {prefix === 'prompt' ? '$' : ''}
              </span>
              <code className={prefix === 'comment' ? 'text-zinc-500' : 'text-zinc-300'}>{line}</code>
            </div>
          );
        })}
      </pre>
    </div>
  );
}
