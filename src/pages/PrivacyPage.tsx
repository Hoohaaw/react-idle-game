import { LegalH1, LegalMeta, LegalH2, LegalP } from '@/components/templates/LegalLayout'

// Boilerplate starting point — see TermsPage.tsx's doc comment for the same caveats (not legal
// advice, not lawyer-reviewed, but accurate to this app's actual data practices as of writing).
export default function PrivacyPage() {
  return (
    <article>
      <LegalH1>Privacy Policy</LegalH1>
      <LegalMeta>Effective September 17, 2026</LegalMeta>

      <LegalP>
        This explains what data The Idle Game (the "Game") collects and how it's used.
      </LegalP>

      <LegalH2>What we collect</LegalH2>
      <LegalP>
        <strong>Account data:</strong> the email address and password you sign up with (your
        password is handled by our authentication provider, Supabase — we never see or store it
        in plain text) and the username you choose.
      </LegalP>
      <LegalP>
        <strong>Gameplay data:</strong> everything about your progress — your roster of
        characters, inventory, currencies, mission/gathering history, and lifetime statistics —
        stored against your account so your game persists between sessions.
      </LegalP>
      <LegalP>
        We don't collect payment information (the Game has no real-money purchases today) and we
        don't run third-party analytics, advertising, or tracking scripts.
      </LegalP>

      <LegalH2>Cookies &amp; local storage</LegalH2>
      <LegalP>
        The Game keeps your login session and a couple of small preferences (like whether you've
        dismissed the cookie notice) in your browser's local storage. This is strictly functional
        — there's no advertising or cross-site tracking use of it.
      </LegalP>

      <LegalH2>Where your data lives</LegalH2>
      <LegalP>
        Account and gameplay data is stored with Supabase, our backend/database provider. Game
        content (item and mission text, art references) is served from Sanity — that side holds
        no data about you personally.
      </LegalP>

      <LegalH2>Sharing</LegalH2>
      <LegalP>
        We don't sell your data or share it with third parties beyond the infrastructure
        providers above, which host the data on our behalf and don't use it for their own
        purposes.
      </LegalP>

      <LegalH2>Your data, your choices</LegalH2>
      <LegalP>
        We don't yet have a self-service "delete my account" button in the Game. Until we do,
        contact us (below) to request access to or deletion of your data and we'll handle it
        manually. If you're in the EU/UK, you may have additional rights under GDPR/UK GDPR —
        the same contact covers those requests.
      </LegalP>

      <LegalH2>Children</LegalH2>
      <LegalP>
        The Game isn't directed at children under 13, and we don't knowingly collect data from
        them.
      </LegalP>

      <LegalH2>Changes</LegalH2>
      <LegalP>
        We may update this policy as the Game changes (e.g., if we add analytics or payments —
        we'd update this page to say so before we did).
      </LegalP>

      <LegalH2>Contact</LegalH2>
      <LegalP>
        Questions or data requests: support@your-domain.example (placeholder — see the project's
        launch checklist for the real address).
      </LegalP>

      <LegalP>
        <em>
          This is a general-purpose starting template for a small/indie project, not legal advice
          and not reviewed by a lawyer. Have it reviewed before relying on it for a real launch
          with real users, especially if you'll have users in the EU/UK/California.
        </em>
      </LegalP>
    </article>
  )
}
