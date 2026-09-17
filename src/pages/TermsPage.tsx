import { LegalH1, LegalMeta, LegalH2, LegalP } from '@/components/templates/LegalLayout'

// Boilerplate starting point for an indie/hobby project's terms — not drafted or reviewed by a
// lawyer. Says so explicitly at the bottom rather than silently implying otherwise. Content is
// accurate to what this app actually does today (Supabase-backed auth + gameplay data, no
// payments, no third-party ads/tracking) — update it if any of that changes. See TODO.md's
// "Launch checklist — still open" item for the real contact address this still needs.
export default function TermsPage() {
  return (
    <article>
      <LegalH1>Terms of Service</LegalH1>
      <LegalMeta>Effective September 17, 2026</LegalMeta>

      <LegalP>
        These terms govern your use of The Idle Game (the "Game"), a browser-based idle RPG. By
        creating an account or playing, you agree to them. If you don't agree, please don't use
        the Game.
      </LegalP>

      <LegalH2>Accounts</LegalH2>
      <LegalP>
        You need an account (email + password) to play. You're responsible for keeping your
        login credentials secure and for anything that happens under your account. Give us
        accurate information when you sign up.
      </LegalP>

      <LegalH2>Acceptable use</LegalH2>
      <LegalP>
        Play fair. Don't exploit bugs or unintended behavior for advantage, automate play in ways
        that abuse the service (bots/scripts hitting our backend outside normal gameplay),
        attempt to access another player's account, or disrupt the Game for other players. We may
        suspend or terminate accounts that violate this.
      </LegalP>

      <LegalH2>Your account, your progress</LegalH2>
      <LegalP>
        Your character roster, inventory, and progress belong to your account and aren't
        transferable to another player or convertible to real-world value. The Game, its code,
        art, and content are owned by its developer(s) — this isn't a license to redistribute or
        resell any part of it.
      </LegalP>

      <LegalH2>No warranty</LegalH2>
      <LegalP>
        This is an independently developed, early-stage project provided "as is." We don't
        guarantee uptime, that the Game will be bug-free, or that your progress/data will never
        be lost (e.g., to a bug, a migration, or a reset feature you use yourself). Back up
        nothing you can't afford to lose — it's a game.
      </LegalP>

      <LegalH2>Limitation of liability</LegalH2>
      <LegalP>
        To the extent the law allows, we aren't liable for indirect, incidental, or consequential
        damages arising from your use of the Game, including loss of progress or data.
      </LegalP>

      <LegalH2>Changes</LegalH2>
      <LegalP>
        We may update these terms as the Game changes. Continuing to play after an update means
        you accept the new terms.
      </LegalP>

      <LegalH2>Contact</LegalH2>
      <LegalP>
        Questions about these terms: support@your-domain.example (placeholder — see the project's
        launch checklist for the real address).
      </LegalP>

      <LegalP>
        <em>
          This is a general-purpose starting template for a small/indie project, not legal advice
          and not reviewed by a lawyer. Have it reviewed before relying on it for a real launch
          with real users.
        </em>
      </LegalP>
    </article>
  )
}
