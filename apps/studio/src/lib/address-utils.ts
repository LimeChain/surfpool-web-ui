// Utility functions for address handling

export const truncateAddress = (address: string) => {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}⋯${address.slice(-8)}`;
};

export const aggressiveTruncateAddress = (address: string) => {
  if (address.length <= 8) return address;
  return `${address.slice(0, 4)}⋯${address.slice(-4)}`;
};

export const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};

// Utility functions for token amount handling

export const convertTokenAmount = (rawAmount: number, decimals: number) => {
  return rawAmount / Math.pow(10, decimals);
};

export const convertToRawAmount = (humanAmount: number, decimals: number) => {
  return humanAmount * Math.pow(10, decimals);
};

export const formatTokenAmount = (
  amount: number, 
  decimals: number, 
  symbol: string,
  options: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    useGrouping?: boolean;
  } = {}
) => {
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 9,
    useGrouping = true
  } = options;

  const convertedAmount = convertTokenAmount(amount, decimals);
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping
  }).format(convertedAmount) + ` ${symbol}`;
}; 