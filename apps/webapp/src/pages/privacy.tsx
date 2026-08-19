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

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      path={PRIVACY_PATH}
      description="How docs.plus uses account data, including Google email, name, and profile photo.">
      <LegalSection title="Who we are">
        <p>
          docs.plus is a free, open-source service for shared documents and chat.{' '}
          <a href={LEGAL_OPERATOR_URL} className={LINK_CLASS}>
            {LEGAL_OPERATOR}
          </a>{' '}
          operates it.
        </p>
      </LegalSection>

      <LegalSection title="What we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>Google sign-in sends your email, name, and profile photo after you agree.</li>
          <li>
            Email sign-in stores the address you type. We send a sign-in link to that address.
          </li>
          <li>A passkey stores a public key and a device label, such as iCloud Keychain.</li>
          <li>Document and chat text you write, plus your name when you are signed in.</li>
          <li>Files you upload, and the account that uploaded them.</li>
          <li>Notification choices, if you turn email notices on.</li>
          <li>A session cookie so you stay signed in.</li>
          <li>Your theme choice in the browser, under docsplus-theme.</li>
          <li>Page views on the home page and on documents, if Google Analytics is set.</li>
        </ul>
      </LegalSection>

      <LegalSection title="How we use Google data">
        <p>
          When you choose Continue with Google or the One Tap prompt, Google sends us your email,
          name, and profile photo.
        </p>
        <p>
          We store those on your account. People who share a document or chat with you can see your
          name and photo.
        </p>
        <p>We do not sell this data. We do not use it for ads.</p>
      </LegalSection>

      <LegalSection title="Passkeys">
        <p>
          A passkey lets you sign in with your fingerprint, face, screen lock, or a security key.
        </p>
        <p>
          Your device keeps the private key. We receive only a public key and a device label, such
          as iCloud Keychain. Your fingerprint and face never leave your device, and we never see
          them.
        </p>
        <p>Remove a passkey at any time in Settings, under Security.</p>
      </LegalSection>

      <LegalSection title="Who we share with">
        <ul className="list-disc space-y-2 pl-5">
          <li>Supabase runs sign-in and stores accounts.</li>
          <li>Google runs sign-in and, when configured, Analytics.</li>
          <li>Our email provider sends sign-in links and notification mail.</li>
        </ul>
        <p>We do not sell personal data.</p>
      </LegalSection>

      <LegalSection title="How long we keep data">
        <p>We keep account and document data while you use the service.</p>
        <p>A deleted document stays for a short time. A later purge removes it.</p>
      </LegalSection>

      <LegalSection title="Your choices">
        <ul className="list-disc space-y-2 pl-5">
          <li>Sign out in Settings.</li>
          <li>Change notification mail in Settings, or use the unsubscribe link in each mail.</li>
          <li>
            Email{' '}
            <a href={CONTACT_MAILTO} className={LINK_CLASS}>
              {LEGAL_CONTACT_EMAIL}
            </a>{' '}
            if you want us to delete your account.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Email{' '}
          <a href={CONTACT_MAILTO} className={LINK_CLASS}>
            {LEGAL_CONTACT_EMAIL}
          </a>
          . See also the{' '}
          <Link href={TERMS_PATH} className={LINK_CLASS}>
            terms of use
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  )
}
