import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { PrimaryButton } from '@/components/atoms/Button'
import { Alert } from '@/components/atoms/Alert'
import { submitFeedback } from '@/services/feedback'

// Support/feedback page (TODO.md D9) — a plain message box, no ticket history, no reply flow.
// Alex reads submissions from the Supabase dashboard. Server enforces a 5-minute per-player
// cooldown and a 1000-char cap (submit_feedback RPC); this page just mirrors the cap in the
// textarea's maxLength so a player sees the limit before hitting it, not after.

const MAX_LENGTH = 1000

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '160px',
  padding: '10px 12px',
  fontFamily: 'Georgia, serif',
  fontSize: '14px',
  borderRadius: '5px',
  border: '2px solid var(--color-gold-dark)',
  background: 'var(--color-bg-deep)',
  color: 'var(--color-text-primary)',
  boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.5)',
  resize: 'vertical',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  fontSize: 12,
  letterSpacing: '1px',
  textTransform: 'uppercase',
  color: 'var(--color-text-gold)',
}

export default function FeedbackPage() {
  const [message, setMessage] = useState('')
  const submit = useMutation({
    mutationFn: submitFeedback,
    onSuccess: () => setMessage(''),
  })

  return (
    <div style={{ maxWidth: '560px' }}>
      <h1 style={{ color: 'var(--color-gold-light)', fontSize: '22px', letterSpacing: '1px', textShadow: '0 0 12px rgba(240,208,96,0.35)' }}>
        Feedback &amp; Support
      </h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginTop: '4px', marginBottom: '18px' }}>
        Found a bug, or have something to say about the game? Send it here. This isn&apos;t a live
        chat — there&apos;s no reply inside the app, so only include contact details here if you
        want to be reached back some other way.
      </p>

      <label htmlFor="feedback-message" style={labelStyle}>Message</label>
      <textarea
        id="feedback-message"
        value={message}
        maxLength={MAX_LENGTH}
        onChange={(e) => setMessage(e.target.value)}
        style={textareaStyle}
      />
      <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginTop: '4px' }}>
        {message.length} / {MAX_LENGTH}
      </p>

      {submit.error && (
        <Alert variant="error">{submit.error instanceof Error ? submit.error.message : 'Could not submit feedback'}</Alert>
      )}
      {submit.isSuccess && !submit.error && <Alert variant="success">Sent. Thanks for the feedback.</Alert>}

      <div style={{ marginTop: '14px' }}>
        <PrimaryButton
          disabled={message.trim().length === 0 || submit.isPending}
          onClick={() => submit.mutate(message.trim())}
        >
          {submit.isPending ? 'Sending...' : 'Send'}
        </PrimaryButton>
      </div>
    </div>
  )
}
