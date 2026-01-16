import React from 'react';
import type { Preview, ReactRenderer } from '@storybook/react-vite';
import type { PartialStoryFn } from 'storybook/internal/types';
import '../src/styles/globals.css';

// Decorator to wrap stories with consistent styling
const withProviders = (Story: PartialStoryFn<ReactRenderer>) => {
  return (
    <div
      style={{
        padding: '2rem',
        minHeight: '100vh',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <Story />
    </div>
  );
};

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#18181b' },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [withProviders],
};

export default preview;
