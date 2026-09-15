import { useNavigate } from 'react-router-dom'
import { PrimaryButton } from '@/components/atoms/Button'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <h1 style={{
        color: 'var(--color-gold-light)',
        fontSize: '28px',
        letterSpacing: '2px',
        textTransform: 'uppercase',
        textShadow: '0 0 14px rgba(240,208,96,0.45)',
      }}>Page Not Found</h1>
      <p style={{ color: 'var(--color-text-muted)', marginTop: '10px', fontStyle: 'italic' }}>
        That path doesn't exist.
      </p>
      <div style={{ marginTop: '24px' }}>
        <PrimaryButton onClick={() => navigate('/missions')}>Back to Missions</PrimaryButton>
      </div>
    </div>
  )
}
