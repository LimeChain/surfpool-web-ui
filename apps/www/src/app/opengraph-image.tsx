import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';
export const alt = 'Surfpool - From Localnet to Mainnet';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000',
          backgroundImage:
            'radial-gradient(circle at 25% 25%, #0a2f3d 0%, transparent 50%), radial-gradient(circle at 75% 75%, #1a0a2f 0%, transparent 50%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 40,
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                backgroundColor: '#00D4FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 20,
                fontSize: 50,
                fontWeight: 'bold',
                color: '#000',
              }}
            >
              🏄
            </div>
            <span
              style={{
                fontSize: 72,
                fontWeight: 700,
                color: '#fff',
              }}
            >
              Surfpool
            </span>
          </div>

          <div
            style={{
              fontSize: 36,
              color: '#a1a1aa',
              textAlign: 'center',
              maxWidth: 900,
              lineHeight: 1.4,
            }}
          >
            From Localnet to Mainnet
          </div>

          <div
            style={{
              display: 'flex',
              marginTop: 50,
              gap: 40,
            }}
          >
            {['Mainnet Forking', 'Cheatcodes', 'IaC Deploy'].map((feature) => (
              <div
                key={feature}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 24px',
                  backgroundColor: 'rgba(0, 212, 255, 0.1)',
                  borderRadius: 8,
                  border: '1px solid rgba(0, 212, 255, 0.3)',
                }}
              >
                <span
                  style={{
                    fontSize: 24,
                    color: '#00D4FF',
                  }}
                >
                  {feature}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 40,
            fontSize: 24,
            color: '#71717a',
          }}
        >
          surfpool.run
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
