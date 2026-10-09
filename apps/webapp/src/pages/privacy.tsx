import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_OPERATOR,
  LEGAL_OPERATOR_URL,
  PRIVACY_PATH,
  TERMS_PATH
} from '@components/pages/legal/legalMetadata'
import { LegalPage, LegalSection } from '@components/pages/legal/LegalPage'
import { TextLink } from '@components/ui/TextLink'

const CONTACT_MAILTO = `mailto:${LEGAL_CONTACT_EMAIL}`

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      path={PRIVACY_PATH}
      description="How docs.plus uses account data, including Google email, name, and profile photo.">
      <LegalSection title="Who we are">
        <p>
          docs.plus is a free, open-source service for shared documents and chat.{' '}
          <TextLink href={LEGAL_OPERATOR_URL}>{LEGAL_OPERATOR}</TextLink> operates it.
        </p>
      </LegalSection>

      <LegalSection title="What we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>Google sign-in sends your email, name, and profile photo after you agree.</li>
          <li>
            Email sign-in stores the address you type. We send a sign-in link to that address.
          </li>
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

      <LegalSection title="Who we share with">
        <ul className="list-disc space-y-2 pl-5">
          <li>Supabase runs sign-in and stores accounts.</li>
          <li>A separate email provider sends sign-in links for Supabase.</li>
          <li>Google runs sign-in and, when configured, Analytics.</li>
          <li>Resend sends notification and digest mail.</li>
        </ul>
        <p>We do not sell personal data.</p>
      </LegalSection>

      <LegalSection title="Where mail data goes">
        <p>
          Resend sends notification and digest mail from Ireland. It stores your email address, each
          mail, and the mail logs in the United States.
        </p>
        <p>
          Notification and digest mail include short extracts of document and chat text. Resend
          stores those extracts with the mail.
        </p>
        <p>
          Resend's data processing agreement covers the transfer to the United States from the
          United Kingdom and the European Union. It uses Standard Contractual Clauses, with the UK
          Addendum for United Kingdom data. It also states that Resend complies with the EU-US Data
          Privacy Framework and its UK Extension.
        </p>
      </LegalSection>

      <LegalSection title="Connected AI apps">
        <p>
          You can connect an AI app to docs.plus. You approve each app on a docs.plus page first.
          Connect only apps you trust.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>The app acts as you through docs.plus tools.</li>
          <li>
            It can read the documents you can open. It can edit documents and post in chat only in
            documents you own.
          </li>
          <li>
            It receives your name, profile picture and email address through the sign-in. It never
            receives a phone number.
          </li>
          <li>
            Text the app reads goes to the company that runs the app. Their terms and privacy policy
            apply to that text.
          </li>
          <li>
            For each tool call, we record the tool name, your account id, the app, and the result.
            We also keep daily counts for about 35 days. We do not log document text.
          </li>
        </ul>
        <p>
          To stop an app, open Settings › Connected apps and choose Disconnect. The app may keep
          what it already read.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep data">
        <p>We keep account and document data while you use the service.</p>
        <p>A deleted document stays for 30 days. A purge then removes it.</p>
        <p>Resend keeps sent mail and the mail logs for 30 days.</p>
      </LegalSection>

      <LegalSection title="Your choices">
        <ul className="list-disc space-y-2 pl-5">
          <li>Sign out in Settings.</li>
          <li>
            Change notification mail in Settings. Notification and digest mail carry an unsubscribe
            link.
          </li>
          <li>
            Email <TextLink href={CONTACT_MAILTO}>{LEGAL_CONTACT_EMAIL}</TextLink> if you want us to
            delete your account.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Who is in charge of your data">
        <p>
          Our data protection lead is in charge of personal data at {LEGAL_OPERATOR}. Reach that
          role at <TextLink href={CONTACT_MAILTO}>{LEGAL_CONTACT_EMAIL}</TextLink>.
        </p>
      </LegalSection>

      <LegalSection title="How to complain">
        <p>
          Tell us first. Email <TextLink href={CONTACT_MAILTO}>{LEGAL_CONTACT_EMAIL}</TextLink> and
          say what went wrong.
        </p>
        <p>We answer you within 30 days. We tell you the outcome, and what we changed.</p>
        <p>
          Not happy with our answer? You may complain to a regulator. In the United Kingdom that is
          the Information Commissioner's Office, at{' '}
          <TextLink href="https://ico.org.uk/make-a-complaint/">
            ico.org.uk/make-a-complaint
          </TextLink>
          . In Quebec it is the Commission d'accès à l'information.
        </p>
        <p>
          To report content instead of a data problem, see Report a problem on the{' '}
          <TextLink href={TERMS_PATH}>terms of use</TextLink>.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Email <TextLink href={CONTACT_MAILTO}>{LEGAL_CONTACT_EMAIL}</TextLink>. See also the{' '}
          <TextLink href={TERMS_PATH}>terms of use</TextLink>.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
