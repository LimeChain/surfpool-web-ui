# Surfnet App

A Twitter/X-style network profile page with integrated faucet functionality, built with Next.js and Tailwind CSS.

## Features

- **Dynamic Configuration**: Load network details from JSON file
- **Twitter-Style Profile**: Familiar profile layout with banner and avatar
- **Live Slot Widget**: Real-time animated epoch/slot tracker
- **Markdown Documentation**: Render network instructions as pinned post
- **Integrated Faucet**: Built-in token faucet with limits
- **Network Stats**: Live network statistics sidebar
- **Quick Links**: Easy access to documentation and community
- **Fully Responsive**: Works beautifully on all devices
- **Dark Theme**: Clean black background with purple accents

## Design

The design mimics Twitter/X's profile page layout:
- **Banner Header**: Gradient background (300px-400px height)
- **Profile Picture**: Overlapping circular avatar
- **Profile Info**: Name, handle (@username), and description
- **Content Width**: Twitter-standard 1265px max-width
- **Two-Column Layout**: Main content (2/3) + Sidebar (1/3)

## Configuration

Edit `/public/network-config.json` to customize:

```json
{
  "network_name": "Your Network Name",
  "network_description": "Network tagline/description",
  "network_instructions_md": "# Full markdown documentation",
  "network_url": "https://your-network.com",
  "network_banner_image_square_url": "Logo URL",
  "network_banner_favicon_url": "Favicon URL",
  "network_logo_image_url": "Logo URL",
  "primary_color": "#8B5CF6",
  "secondary_color": "#EC4899"
}
```

## Development

```bash
# Run development server (port 3001)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## Components

### Header
- Gradient banner with configurable colors
- CompactSlotWidget in top-right corner
- Profile picture overlapping banner

### Profile Section
- Network name and handle
- Description/bio text
- Action buttons (Visit Website, View Explorer)
- Edit Profile button (customizable)

### Main Content
- Pinned post style container
- Full markdown support with GitHub Flavored Markdown
- Syntax highlighting for code blocks
- Beautiful typography

### Sidebar
- **Faucet Widget**: Request test tokens
- **Network Stats**: Status, block time, TPS
- **Quick Links**: Documentation, Discord, Twitter, GitHub

## Customization

### Colors
Update `primary_color` and `secondary_color` in JSON to change:
- Banner gradient
- Primary buttons
- Link colors

### Faucet
Edit `/src/components/faucet.tsx`:
- Request amounts
- Daily limits
- Cooldown periods

### Content
Update `network_instructions_md` with your markdown:
- Headers, lists, tables
- Code blocks with syntax highlighting
- Links and images
- GitHub Flavored Markdown features

### Layout
Modify `/src/app/page.tsx`:
- Adjust max-width (currently 1265px)
- Change grid layout (currently 2:1 ratio)
- Add/remove sidebar widgets

## Deployment

Deploy to any Next.js-compatible platform:

```bash
# Vercel
vercel deploy

# Netlify
# Connect your repo via Netlify dashboard

# Docker
# Use the included Dockerfile (if added)

# Static Export
# Enable static export in next.config.mjs
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

## License

Same as parent monorepo.
