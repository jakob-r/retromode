import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router'
// Contact details are rendered from env vars at build time as text-free SVG outlines, so they
// stay out of git and simple scrapers can't harvest them.
import { contactEmail, postalAddress } from 'virtual:legal-contact'
import { LegalLinks } from '../components/LegalLinks'
import { Logo } from '../components/Logo'

const linkClass =
  'font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-ink'

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · retromo.de`
    return () => {
      document.title = 'retromo.de'
    }
  }, [title])

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <Logo />
      <article className="mt-6 rounded-[1.75rem] bg-white/85 p-6 shadow-xl shadow-violet/10 ring-1 ring-line sm:p-10">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <div className="mt-6 space-y-3 leading-relaxed [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
          {children}
        </div>
      </article>
      <LegalLinks className="mt-8" />
    </main>
  )
}

function ContactImage({
  image,
  alt,
}: {
  image: { src: string; width: number; height: number }
  alt: string
}) {
  return (
    <img src={image.src} alt={alt} width={image.width} height={image.height} className="block" />
  )
}

function Contact() {
  if (!postalAddress || !contactEmail) return <p>Contact details are not configured.</p>
  return (
    <>
      <ContactImage image={postalAddress} alt="Postal address (image)" />
      <div className="flex items-center gap-2">
        <span>Email:</span>
        <ContactImage image={contactEmail} alt="Email address (image)" />
      </div>
    </>
  )
}

export function ImprintPage() {
  return (
    <LegalLayout title="Legal notice (Impressum)">
      <h2>Information pursuant to § 5 DDG</h2>
      <Contact />

      <h2>Responsible for content</h2>
      <p>The person named above.</p>

      <h2>Liability for content and links</h2>
      <p>
        The content of this website has been created with care. However, no guarantee is given for
        its accuracy, completeness, or timeliness. Users are responsible for the content they post
        on their boards. The operators of linked external websites are solely responsible for their
        content.
      </p>
    </LegalLayout>
  )
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy policy">
      <p>Last updated: October 2026</p>

      <h2>1. Controller</h2>
      <p>The controller responsible for data processing on retromo.de is:</p>
      <Contact />

      <h2>2. Principles</h2>
      <p>
        retromo.de has no user accounts, uses no analytics or tracking services, shows no
        advertising, sets no cookies, and does not load any content (such as fonts or scripts) from
        third-party servers. Personal data is only processed to the extent necessary to operate the
        application.
      </p>

      <h2>3. Hosting and server log files</h2>
      <p>
        The application runs on servers operated by netcup GmbH, Daimlerstraße 25, 76185 Karlsruhe,
        Germany. A data processing agreement pursuant to Art. 28 GDPR is in place with the host.
      </p>
      <p>
        When you visit the website, technically necessary data is processed: IP address, date and
        time, requested URL, HTTP status code, amount of data transferred, referrer, and browser
        identifier (user agent). This data is processed to deliver the website, to prevent abuse
        (for example by limiting how many boards can be created per minute), and to analyse errors.
        The legal basis is Art. 6(1)(f) GDPR. Log files are rotated automatically, overwritten after
        a short time, and not combined with other data.
      </p>

      <h2>4. Boards and their content</h2>
      <p>
        When you create or use a board, we store what you enter: the board title, items, groups,
        action items, and votes, each with the time it was created. If you set a nickname, it is
        shown next to the items you post, unless you post them anonymously. To recognise you again
        without an account, your browser creates a random identifier. We store it with your items
        and votes so you can edit your own items and take back your votes; it is never shown to
        other people.
      </p>
      <p>
        Everyone who has a board&apos;s link can see its content. Please do not post sensitive
        personal data about yourself or others. The legal basis is Art. 6(1)(b) GDPR (provision of
        the service).
      </p>
      <p>
        A board and everything on it is deleted automatically after 90 days without activity. The
        person who created a board can delete it with all its data at any time.
      </p>

      <h2>5. Local storage</h2>
      <p>
        We store the random identifier described above, your nickname, your anonymity preference,
        and the owner keys of boards you created in your browser&apos;s local storage. This data
        stays on your device until you clear your browser data. The legal basis is § 25(2) no. 2
        TDDDG; no consent is required for this.
      </p>

      <h2>6. Your rights</h2>
      <p>You have the right to</p>
      <ul>
        <li>access the data stored about you (Art. 15 GDPR),</li>
        <li>rectification (Art. 16 GDPR),</li>
        <li>erasure (Art. 17 GDPR),</li>
        <li>restriction of processing (Art. 18 GDPR),</li>
        <li>data portability (Art. 20 GDPR),</li>
        <li>object to processing based on Art. 6(1)(f) GDPR (Art. 21 GDPR).</li>
      </ul>
      <p>
        To exercise these rights, simply contact us by email at the address above. As there are no
        accounts, please include the link of the board concerned.
      </p>
      <p>
        You also have the right to lodge a complaint with a data protection supervisory authority,
        for example the Berlin Commissioner for Data Protection and Freedom of Information (Berliner
        Beauftragte für Datenschutz und Informationsfreiheit), Alt-Moabit 59–61, 10555 Berlin,
        Germany.
      </p>

      <h2>7. Obligation to provide data; automated decision-making</h2>
      <p>
        You are not required to provide any personal data; a nickname is optional. No automated
        decision-making within the meaning of Art. 22 GDPR takes place.
      </p>
    </LegalLayout>
  )
}

export function TermsPage() {
  return (
    <LegalLayout title="Terms of use">
      <p>Last updated: October 2026</p>

      <h2>1. Scope</h2>
      <p>
        These terms apply to the use of retromo.de (the &quot;service&quot;), operated by the
        provider named in the{' '}
        <Link to="/legal-notice" className={linkClass}>
          legal notice
        </Link>
        . By using the service you accept these terms. The service is provided free of charge. The
        source code is available under the MIT license; these terms only cover the service hosted at
        retromo.de, not self-hosted copies.
      </p>

      <h2>2. Boards and links</h2>
      <p>
        Anyone who has a board&apos;s link can read and contribute to it, so only share it with
        people you want on the board. The person who creates a board can moderate, lock, and delete
        it. These owner rights are tied to a key stored in the creator&apos;s browser; if it is
        lost, for example by clearing browser data, they cannot be restored.
      </p>

      <h2>3. Your content</h2>
      <p>
        You are responsible for what you post. Do not post unlawful content, content that violates
        other people&apos;s rights, or sensitive personal data about others, and do not use the
        service in a way that impairs its operation. We may delete content or boards that violate
        these terms.
      </p>

      <h2>4. Availability, deletion, and discontinuation</h2>
      <p>
        The service is provided &quot;as is&quot;. There is no guarantee of uninterrupted
        availability or that particular features will remain available. Boards are deleted
        automatically after 90 days without activity, and there are no backups you can restore from,
        so copy anything you want to keep, such as your action items. We may change or discontinue
        the service; as there are no accounts, we will announce a discontinuation on this website in
        advance where possible.
      </p>

      <h2>5. Liability</h2>
      <p>
        We are liable without limitation for intent and gross negligence, for injury to life, body,
        or health, and wherever liability is mandatory by law (e.g. under the German Product
        Liability Act). In all other cases, liability for slight negligence is excluded, as the
        service is provided free of charge.
      </p>

      <h2>6. Changes to these terms</h2>
      <p>
        We may update these terms, for example when features change. The current version is always
        available on this page.
      </p>

      <h2>7. Governing law</h2>
      <p>
        German law applies, excluding the UN Convention on Contracts for the International Sale of
        Goods. If you are a consumer, this does not deprive you of the protection of mandatory
        provisions of the law of the country in which you habitually reside. Should individual
        provisions be invalid, the remaining provisions remain unaffected.
      </p>
    </LegalLayout>
  )
}
