import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DraftField from './draft-field';

const setup = (props: Partial<React.ComponentProps<typeof DraftField>> = {}) => {
  const onCommit = vi.fn();
  const onDone = vi.fn();
  render(<DraftField initialValue="Old name" onCommit={onCommit} onDone={onDone} {...props} />);
  const field = screen.getByDisplayValue(props.initialValue ?? 'Old name');
  return { field, onCommit, onDone };
};

describe('DraftField', () => {
  it('does not commit while typing', () => {
    const { field, onCommit } = setup();
    fireEvent.change(field, { target: { value: 'New name' } });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits once on blur', () => {
    const { field, onCommit, onDone } = setup();
    fireEvent.change(field, { target: { value: 'New name' } });
    fireEvent.blur(field);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('New name');
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('commits on Enter', () => {
    const { field, onCommit, onDone } = setup();
    fireEvent.change(field, { target: { value: 'New name' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('New name');
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('does not commit an unchanged value', () => {
    const { field, onCommit, onDone } = setup();
    fireEvent.blur(field);
    expect(onCommit).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('does not commit an empty value unless allowEmpty', () => {
    const { field, onCommit } = setup();
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.blur(field);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits an empty value with allowEmpty', () => {
    const { field, onCommit } = setup({ allowEmpty: true });
    fireEvent.change(field, { target: { value: '' } });
    fireEvent.blur(field);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('');
  });

  it('cancels on Escape without committing', () => {
    const { field, onCommit, onDone } = setup();
    fireEvent.change(field, { target: { value: 'New name' } });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(onCommit).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('stops Escape from reaching window-level listeners', () => {
    const windowListener = vi.fn();
    window.addEventListener('keydown', windowListener);
    try {
      const { field } = setup();
      fireEvent.keyDown(field, { key: 'Escape' });
      expect(windowListener).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', windowListener);
    }
  });

  it('renders a textarea in multiline mode and keeps Shift+Enter for newlines', () => {
    const { field, onCommit } = setup({ multiline: true, initialValue: 'Old text' });
    expect(field.tagName).toBe('TEXTAREA');
    fireEvent.change(field, { target: { value: 'New text' } });
    fireEvent.keyDown(field, { key: 'Enter', shiftKey: true });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('New text');
  });
});
