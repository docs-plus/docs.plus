import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_OPERATOR,
  LEGAL_OPERATOR_URL,
  LEGAL_UPDATED,
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
      updated={LEGAL_UPDATED}
      description="How docs.plus uses account data, including the email address, name and profile photo from Google sign-in.">
      <LegalSection title="Who we are">
        <p>
          docs.plus is a free, open-source service for shared documents and chat.{' '}
          <TextLink href={LEGAL_OPERATOR_URL}>{LEGAL_OPERATOR}</TextLink> operates it.
        </p>
      </LegalSection>

      <LegalSection title="What we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Google sign-in sends your email address, name, profile photo and Google account ID after
            you agree.
          </li>
          <li>
            Email sign-in stores the email address you type. We send a sign-in link to that address.
          </li>
          <li>Document and chat text you write, plus your name when you are signed in.</li>
          <li>Files you upload, and the account that uploaded them.</li>
          <li>Notification choices, if you turn on notification mail.</li>
          <li>A session cookie so you stay signed in.</li>
          <li>Your theme choice, saved in your browser as docsplus-theme.</li>
          <li>
            Your first name, email address and profile photo, saved in your browser as
            docsplus:last-signed-in-account. The sign-in form uses it to suggest your last account.
          </li>
          <li>
            Page views on the home page and on documents, through Google Analytics. Google Analytics
            sets its own _ga cookies to count visits.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="How we use Google data">
        <p>
          When you choose Continue with Google or the One Tap prompt, Google sends us your email
          address, name, profile photo and Google account ID. We ask Google for nothing else. We
          cannot read your Gmail, Drive, Calendar or contacts.
        </p>
        <p>
          We use this data to create your account and sign you in. Your name and profile photo are
          public: anyone on docs.plus can see them, signed in or not.
        </p>
        <p>
          We use your email address to send sign-in links and the mail you turn on. When you create
          a document, we email our team its link with your name, email address and profile photo.
        </p>
        <p>
          Supabase stores this data. Our document database at DigitalOcean also keeps the email
          address of each document owner. Both encrypt stored data, and we send it over HTTPS.
        </p>
        <p>
          Resend receives your email address to send our mail. An AI app that you connect receives
          your name, profile photo and email address, as Connected AI apps explains.
        </p>
        <p>We do not sell any personal data. We do not use this data for ads.</p>
        <p>
          We keep this data until you close your account. To close it, email{' '}
          <TextLink href={CONTACT_MAILTO}>{LEGAL_CONTACT_EMAIL}</TextLink>. We then remove your name
          and profile photo and stop all mail. We keep your email address and Google account ID to
          block the account. You can also remove docs.plus from your Google account at{' '}
          <TextLink href="https://myaccount.google.com/permissions">
            myaccount.google.com/permissions
          </TextLink>
          .
        </p>
        <p>
          docs.plus's use and transfer of information received from Google APIs adheres to the{' '}
          <TextLink href="https://developers.google.com/terms/api-services-user-data-policy">
            Google API Services User Data Policy
          </TextLink>
          , including the Limited Use requirements.
        </p>
      </LegalSection>

      <LegalSection title="Who we share with">
        <ul className="list-disc space-y-2 pl-5">
          <li>Supabase runs sign-in and stores accounts.</li>
          <li>DigitalOcean hosts our servers and the document database.</li>
          <li>Google runs sign-in and Analytics.</li>
          <li>Resend sends sign-in, notification and digest mail.</li>
          <li>AI apps that you connect, as Connected AI apps explains.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Link icons and previews">
        <p>
          When you open a document or its chat, your browser asks our server for the icon of each
          linked website. It does the same for profile links, link previews and the hovercard. The
          request carries the site address only, not the full link. Our server fetches the icon from
          the site's main domain, so the site sees our server, not you.
        </p>
        <p>
          A link preview, the hovercard and an embed thumbnail in chat or in Insert media work
          another way. Adding a web link to your profile, or pasting one into a document, works this
          way too. Your browser sends the full link to our server. Our server fetches the page. For
          the hovercard and embed thumbnails, it also fetches the page's picture. So the site sees
          our server, not you. For a GitHub repository or a Stack Overflow question, our server also
          asks api.github.com or api.stackexchange.com, and sends only the repository or question
          named in the link. Our server may pass on your browser's first language, such as en, so
          the page can answer in it. Our server keeps the preview for up to a day, and the stored
          preview can hold the link. A web link on your profile keeps its title and description with
          your profile until you remove it.
        </p>
        <p>
          When the hovercard has no preview, it can offer View archived copy. Only when you click
          it, our server sends the link to archive.org, the Internet Archive, to find a saved copy.
          Our server never sends a docs.plus document link there. It keeps the answer for up to an
          hour.
        </p>
        <p>
          When you share a link to a public document in another app, such as Slack or X, that app
          asks our server for the link&apos;s preview. The preview can show the document&apos;s
          title and first lines. That app keeps its own copy, and we cannot delete it, so a preview
          can stay after an edit or after the document turns Private.
        </p>
        <p>
          Our logs keep your IP address, your browser's user agent and the request path. For a
          preview, our server also logs the host of the linked site, never the full link. Our error
          reports follow the same rule: they keep only the host of a linked site.
        </p>
        <p>Some things load straight from other sites, so those sites see you:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Embedded players, such as YouTube, Vimeo, SoundCloud, Spotify, Loom and X.</li>
          <li>Pictures, videos and audio from other sites, in a document or in chat.</li>
          <li>
            The GIF picker in chat, when it is on: your searches, the results and the GIF you choose
            load from GIPHY. Readers see our copy.
          </li>
          <li>YouTube thumbnails.</li>
          <li>An archived copy you open from the hovercard, which loads from web.archive.org.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Where mail data goes">
        <p>
          Resend sends our mail from Ireland. It stores your email address, each mail, and the mail
          logs in the United States.
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
          <li>It receives your name, profile photo and email address through the sign-in.</li>
          <li>
            Text the app reads goes to the company that runs the app. Their terms and privacy policy
            apply to that text.
          </li>
          <li>
            For each tool call, we record the tool name, your account ID, the app, and whether the
            call succeeded. We keep daily counts of tool calls for 35 days. We do not log document
            text.
          </li>
        </ul>
        <p>
          To stop an app, open Settings › Connected apps and choose Disconnect. Disconnect does not
          delete what the app already read.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep data">
        <p>We keep account data until you close your account.</p>
        <p>A deleted document stays for 30 days. We then delete it permanently.</p>
        <p>Resend keeps sent mail and the mail logs for 30 days.</p>
        <p>
          If mail to your address bounces, or you mark it as spam, Resend keeps your address on its
          suppression list until we remove it. Email{' '}
          <TextLink href={CONTACT_MAILTO}>{LEGAL_CONTACT_EMAIL}</TextLink> to ask us to remove it.
        </p>
      </LegalSection>

      <LegalSection title="Your choices">
        <ul className="list-disc space-y-2 pl-5">
          <li>Sign out in Settings.</li>
          <li>
            Change notification mail in Settings. Notification and digest mail carry an unsubscribe
            link.
          </li>
          <li>
            Email <TextLink href={CONTACT_MAILTO}>{LEGAL_CONTACT_EMAIL}</TextLink> to close your
            account.
          </li>
          <li>
            Download a document you can open from Document settings › Import &amp; export, as Word,
            Markdown or OpenDocument.
          </li>
          <li>
            Email <TextLink href={CONTACT_MAILTO}>{LEGAL_CONTACT_EMAIL}</TextLink> to ask for a copy
            of your personal data in a common file format, or to ask us to send it to another
            service. This is your right to data portability. You can also ask us to correct or
            delete your data, or to limit or stop how we use it. We answer within one month.
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
