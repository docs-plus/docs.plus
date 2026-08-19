import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_OPERATOR,
  LEGAL_OPERATOR_URL,
  PRIVACY_PATH,
  TERMS_PATH
} from '@components/pages/legal/legalMetadata'
import { LegalPage, LegalSection } from '@components/pages/legal/LegalPage'
import Link from 'next/link'

const CONTACT_MAILTO = `mailto:${LEGAL_CONTACT_EMAIL}`
const LINK_CLASS = 'text-primary font-medium hover:underline'

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      path={TERMS_PATH}
      description="Rules for using docs.plus documents, chat, and accounts.">
      <LegalSection title="The service">
        <p>
          docs.plus lets people write documents together and chat beside a heading.{' '}
          <a href={LEGAL_OPERATOR_URL} className={LINK_CLASS}>
            {LEGAL_OPERATOR}
          </a>{' '}
          operates it. The source is open on GitHub.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <p>You may open a public document without an account.</p>
        <p>A Google sign-in, an email link, or a passkey creates an account.</p>
      </LegalSection>

      <LegalSection title="Your content">
        <p>You keep the rights to text and files you add.</p>
        <p>
          You grant us the right to store them and show them to people who can open that document.
        </p>
      </LegalSection>

      <LegalSection title="Public and private documents">
        <p>A public document is open to anyone with the link.</p>
        <p>A private document is open to the owner only.</p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <ul className="list-disc space-y-2 pl-5">
          <li>Do not use the service to break the law.</li>
          <li>Do not use it to harm people or to attack the service.</li>
          <li>We may remove content or close an account that does this.</li>
        </ul>
      </LegalSection>

      <LegalSection title="No warranty">
        <p>The service is free and provided as is.</p>
        <p>We do not promise it will always be up.</p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>We may change these terms. The date at the top is the current version.</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Email{' '}
          <a href={CONTACT_MAILTO} className={LINK_CLASS}>
            {LEGAL_CONTACT_EMAIL}
          </a>
          . See also the{' '}
          <Link href={PRIVACY_PATH} className={LINK_CLASS}>
            privacy page
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  )
}
