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
const SECURITY_EMAIL = 'security@docs.plus'
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
        <p>
          Write to us at{' '}
          <a href={CONTACT_MAILTO} className={LINK_CLASS}>
            {LEGAL_CONTACT_EMAIL}
          </a>
          . An authority may use the same address to reach us.
        </p>
      </LegalSection>

      <LegalSection title="Who may use docs.plus">
        <p>You must be 13 or older to open an account.</p>
        <p>
          In the European Union, a person under 16 needs a parent or guardian to agree first. Some
          member states set a lower age, and never below 13.
        </p>
        <p>
          A school may use docs.plus with its students. The school decides that, and the school
          supervises it. We do not check the age of anyone who opens a document.
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
          <li>Do not post content that is harmful to children.</li>
          <li>We may remove content or close an account that does this. See How we moderate.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Report a problem">
        <p>
          Tell us if you find content that breaks these rules or the law. Email{' '}
          <a href={CONTACT_MAILTO} className={LINK_CLASS}>
            {LEGAL_CONTACT_EMAIL}
          </a>
          . Give the document or message link, and say what is wrong.
        </p>
        <p>We read every report. We treat these as urgent, in this order:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Child sexual abuse material.</li>
          <li>A threat to someone's life or safety.</li>
          <li>Content that is illegal for another reason.</li>
          <li>A report that a user is under 13.</li>
          <li>A copyright or defamation notice.</li>
        </ul>
        <p>
          Report a security weakness to{' '}
          <a href={`mailto:${SECURITY_EMAIL}`} className={LINK_CLASS}>
            {SECURITY_EMAIL}
          </a>{' '}
          instead, and not in a public place.
        </p>
      </LegalSection>

      <LegalSection title="How we moderate">
        <p>
          We may remove content, close a document, or close an account. We do that when content
          breaks these rules, breaks the law, or when the law tells us to.
        </p>
        <p>
          {LEGAL_OPERATOR} decides. We tell the document owner the reason, unless the law stops us.
        </p>
        <p>
          Disagree with a decision? Reply to that email, or write to{' '}
          <a href={CONTACT_MAILTO} className={LINK_CLASS}>
            {LEGAL_CONTACT_EMAIL}
          </a>
          . A person reads it, and we answer.
        </p>
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
