import satori from 'satori'
import sharp from 'sharp'
import { readFile, writeFile, readdir, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')
const ogDir = join(publicDir, 'og')

async function generateOGImage(networkId, config) {
  console.log(`Generating OG image for ${config.network_name}...`)

  try {
    // Read banner and logo
    const bannerPath = join(publicDir, config.network_banner_image_url)
    const logoPath = join(publicDir, config.network_logo_image_url)

    const banner = await readFile(bannerPath)
    const logo = await readFile(logoPath)

    // Load font
    const fontPath = join(__dirname, 'font.ttf')
    const fontData = await readFile(fontPath)

    // Create SVG with satori
    const svg = await satori(
      {
        type: 'div',
        props: {
          style: {
            width: '100%',
            height: '100%',
            display: 'flex',
            position: 'relative',
            alignItems: 'center',
            justifyContent: 'center',
          },
          children: [
            // Background banner (full bleed)
            {
              type: 'div',
              props: {
                style: {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                },
                children: [
                  {
                    type: 'img',
                    props: {
                      src: `data:image/jpeg;base64,${banner.toString('base64')}`,
                      style: {
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }
                    }
                  }
                ]
              }
            },
            // Dark overlay
            {
              type: 'div',
              props: {
                style: {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.6))',
                }
              }
            },
            // Content (logo + title + RPC)
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10,
                  gap: 32,
                  padding: '0 120px',
                  width: '100%',
                },
                children: [
                  // Logo (rounded square)
                  {
                    type: 'img',
                    props: {
                      src: `data:image/jpeg;base64,${logo.toString('base64')}`,
                      style: {
                        width: 180,
                        height: 180,
                        borderRadius: 24,
                        border: '8px solid white',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                      }
                    }
                  },
                  // Title
                  {
                    type: 'div',
                    props: {
                      style: {
                        fontSize: 72,
                        fontWeight: 700,
                        fontFamily: 'Montserrat',
                        color: 'white',
                        textAlign: 'center',
                        textShadow: '0 4px 12px rgba(0,0,0,0.8)',
                        letterSpacing: '-0.02em',
                      },
                      children: config.network_name
                    }
                  },
                  // RPC URL
                  {
                    type: 'div',
                    props: {
                      style: {
                        fontSize: 36,
                        fontWeight: 700,
                        fontFamily: 'Montserrat',
                        color: 'rgba(255,255,255,0.8)',
                        textAlign: 'center',
                        textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                        backgroundColor: 'rgba(0,0,0,0.4)',
                        padding: '16px 32px',
                        borderRadius: 12,
                      },
                      children: config.rpc_url
                    }
                  }
                ]
              }
            }
          ]
        }
      },
      {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: 'Montserrat',
            data: fontData,
            weight: 700,
            style: 'normal',
          }
        ]
      }
    )

    // Convert SVG to PNG
    const png = await sharp(Buffer.from(svg))
      .png()
      .toBuffer()

    // Ensure og directory exists
    await mkdir(ogDir, { recursive: true })

    // Write PNG file
    const outputPath = join(ogDir, `${networkId}.png`)
    await writeFile(outputPath, png)

    console.log(`✓ Generated ${outputPath}`)
  } catch (error) {
    console.error(`✗ Failed to generate OG image for ${networkId}:`, error.message)
  }
}

async function main() {
  console.log('🎨 Generating OG images for all networks...\n')

  // Find all network directories (exclude og directory)
  const entries = await readdir(publicDir, { withFileTypes: true })
  const networkDirs = entries
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'og')
    .map(entry => entry.name)

  // Generate OG images for each network
  for (const networkId of networkDirs) {
    const configPath = join(publicDir, networkId, 'config.json')

    try {
      const configData = await readFile(configPath, 'utf-8')
      const config = JSON.parse(configData)
      await generateOGImage(networkId, config)
    } catch (error) {
      console.error(`✗ Skipping ${networkId}: ${error.message}`)
    }
  }

  console.log('\n✨ Done!')
}

main().catch(console.error)
