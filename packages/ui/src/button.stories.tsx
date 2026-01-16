import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './button';
import { StarIcon, ArrowRightIcon } from '@heroicons/react/24/solid';

const meta = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'white', 'yellow'],
      description: 'The visual style of the button',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl', '2xl', '3xl'],
      description: 'The size of the button',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the button is disabled',
    },
    children: {
      control: 'text',
      description: 'Button content',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    children: 'Get Started',
    variant: 'primary',
    size: 'md',
  },
};

export const Secondary: Story = {
  args: {
    children: 'Documentation',
    variant: 'secondary',
    size: 'md',
  },
};

export const Ghost: Story = {
  args: {
    children: 'Learn More',
    variant: 'ghost',
    size: 'md',
  },
};

export const White: Story = {
  args: {
    children: 'Sign Up',
    variant: 'white',
    size: 'md',
  },
};

export const Yellow: Story = {
  args: {
    children: 'Star',
    variant: 'yellow',
    size: 'sm',
  },
};

export const WithIcon: Story = {
  args: {
    variant: 'primary',
    size: 'md',
    children: (
      <>
        <StarIcon data-slot="icon" />
        Star on GitHub
      </>
    ),
  },
};

export const WithTrailingIcon: Story = {
  args: {
    variant: 'primary',
    size: 'md',
    children: (
      <>
        Continue
        <ArrowRightIcon data-slot="icon" />
      </>
    ),
  },
};

export const AsLink: Story = {
  args: {
    children: 'View Documentation',
    variant: 'primary',
    size: 'md',
    href: 'https://docs.surfpool.run',
  },
};

export const Disabled: Story = {
  args: {
    children: 'Disabled Button',
    variant: 'primary',
    size: 'md',
    disabled: true,
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-4">
      <Button variant="primary" size="sm">Small</Button>
      <Button variant="primary" size="md">Medium</Button>
      <Button variant="primary" size="lg">Large</Button>
      <Button variant="primary" size="xl">Extra Large</Button>
      <Button variant="primary" size="2xl">2XL</Button>
      <Button variant="primary" size="3xl">3XL</Button>
    </div>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="white">White</Button>
      <Button variant="yellow">Yellow</Button>
    </div>
  ),
  parameters: {
    backgrounds: { default: 'dark' },
  },
};

export const DarkBackground: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4 p-8 bg-zinc-900 rounded-lg">
      <Button variant="primary">Get Started</Button>
      <Button variant="secondary">Documentation</Button>
      <Button variant="yellow">
        <StarIcon data-slot="icon" />
        123
      </Button>
    </div>
  ),
};
