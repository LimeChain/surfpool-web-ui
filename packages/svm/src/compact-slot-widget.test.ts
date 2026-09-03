import { describe, expect, it } from 'vitest';
import {
  absoluteSlotPosition,
  isStaleSlotNotification,
  slotNotificationPosition,
} from './compact-slot-widget';

describe('absoluteSlotPosition', () => {
  it('maps an absolute slot to the displayed epoch position', () => {
    expect(absoluteSlotPosition(439000871, 432000)).toEqual({
      epoch: 1016,
      slotIndex: 88871,
    });
  });

  it('rejects invalid slot inputs', () => {
    expect(absoluteSlotPosition(-1, 432000)).toBeNull();
    expect(absoluteSlotPosition(1, 0)).toBeNull();
  });
});

describe('slotNotificationPosition', () => {
  it('uses the current slot instead of the parent slot', () => {
    expect(slotNotificationPosition({ slot: 439001309, parent: 439001308 }, 432000)).toEqual({
      epoch: 1016,
      slotIndex: 89309,
    });
  });
});

describe('isStaleSlotNotification', () => {
  it('rejects an earlier WebSocket slot after an absolute clock update', () => {
    expect(isStaleSlotNotification(439001328, 439001777)).toBe(true);
    expect(isStaleSlotNotification(439001777, 439001777)).toBe(false);
    expect(isStaleSlotNotification(439001778, 439001777)).toBe(false);
  });
});
