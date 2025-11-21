import { diff } from 'fast-myers-diff';

interface DiffRange {
  start: number;
  end: number;
}

interface Removal {
  beforeRange: DiffRange;
  afterIndex: number;
}

interface Addition {
  beforeIndex: number;
  afterRange: DiffRange;
}

interface Update {
  beforeRange: DiffRange;
  afterRange: DiffRange;
}

interface DiffAnalysis {
  removals: Removal[];
  additions: Addition[];
  updates: Update[];
}

/**
 * Analyzes hex data using fast-myers-diff and categorizes changes into removals, additions, and updates
 * @param beforeBytes Array of bytes from before
 * @param afterBytes Array of bytes from after
 * @returns Categorized changes
 */
export function analyzeHexDiff(beforeBytes: number[], afterBytes: number[]): DiffAnalysis {
  const removals: Removal[] = [];
  const additions: Addition[] = [];
  const updates: Update[] = [];

  // Use fast-myers-diff to get the diff result
  const diffResult = Array.from(diff(beforeBytes, afterBytes));

  if (diffResult.length === 0) {
    return { removals, additions, updates };
  }

  // Process each diff region
  for (const [sx, ex, sy, ey] of diffResult) {
    if (sx === ex && sy !== ey) {
      // Pure insertion: no bytes deleted, new bytes inserted
      additions.push({
        beforeIndex: sx,
        afterRange: { start: sy, end: ey - 1 }
      });
    } else if (sx !== ex && sy === ey) {
      // Pure deletion: bytes deleted, no new bytes inserted
      removals.push({
        beforeRange: { start: sx, end: ex - 1 },
        afterIndex: sx
      });
    } else if (sx !== ex && sy !== ey) {
      // Replacement: bytes deleted and new bytes inserted
      updates.push({
        beforeRange: { start: sx, end: ex - 1 },
        afterRange: { start: sy, end: ey - 1 }
      });
    }
  }

  return { removals, additions, updates };
}

/**
 * Creates test byte arrays for removal scenario
 */
export function createRemovalTestData(): { beforeBytes: number[], afterBytes: number[] } {
  // Simulate a case where "0.001" becomes "0"
  // "0.001" = [48, 46, 48, 48, 49] in ASCII
  // "0" = [48] in ASCII
  
  const beforeBytes = [48, 46, 48, 48, 49]; // "0.001"
  const afterBytes = [48]; // "0"
  
  return { beforeBytes, afterBytes };
}

/**
 * Creates test byte arrays for update scenario
 */
export function createUpdateTestData(): { beforeBytes: number[], afterBytes: number[] } {
  // Simulate "ABC" becoming "XYZ"
  // "ABC" = [65, 66, 67] in ASCII
  // "XYZ" = [88, 89, 90] in ASCII
  
  const beforeBytes = [65, 66, 67]; // "ABC"
  const afterBytes = [88, 89, 90]; // "XYZ"
  
  return { beforeBytes, afterBytes };
}

/**
 * Creates test byte arrays for addition scenario
 */
export function createAdditionTestData(): { beforeBytes: number[], afterBytes: number[] } {
  // Simulate "ABC" becoming "ABCD"
  // "ABC" = [65, 66, 67] in ASCII
  // "ABCD" = [65, 66, 67, 68] in ASCII
  
  const beforeBytes = [65, 66, 67]; // "ABC"
  const afterBytes = [65, 66, 67, 68]; // "ABCD"
  
  return { beforeBytes, afterBytes };
} 