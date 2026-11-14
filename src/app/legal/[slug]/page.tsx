import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Alert, PageHeader } from "@/components/ui";

/**
 * Placeholder policy text for the recommendation product. These are structural
 * drafts that describe what the app actually does — they are not legal advice
 * and must be reviewed by a US attorney before launch.
 */
const DOCS: Record<
  string,
  { title: string; intro: string; sections: { heading: string; body: string[] }[] }
> = {
  terms: {
    title: "Terms of use",
    intro: "The agreement between you and Trusted By.",
    sections: [
      {
        heading: "What Trusted By is",
        body: [
          "Trusted By is a place to keep and share recommendations — the businesses and people you would send a friend to. It is not a marketplace, a booking system, or a payment processor.",
          "We are not a party to anything you arrange with someone you found here. We do not vet the people on it, do not perform the work, and do not set prices.",
        ],
      },
      {
        heading: "Your account",
        body: [
          "You must be 18 or older. You are responsible for what happens under your account and for keeping your password secure.",
          "Your list is private by default. Recommendations become visible to others only through the audience you pick on each one.",
        ],
      },
      {
        heading: "What you may add",
        body: [
          "Add a recommendation only for someone you would genuinely refer. Recommendations here are positive by design: there is no rating and no way to leave a negative review.",
          "Do not add someone as a way to publish their contact details against their wishes. Anyone listed can have their profile removed at any time — see the content policy.",
          "Categories listed as not accepted in the content policy may not be used.",
        ],
      },
      {
        heading: "Accuracy and liability",
        body: [
          "Recommendations are written by the people named on them. We do not verify skill, licensing, insurance, or work quality.",
          "Check licences and insurance yourself before hiring anyone, particularly for regulated trades.",
          "To the extent the law allows, the service is provided as is, and our liability is limited to the amounts you paid us in the twelve months before a claim.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy & your data",
    intro: "What we hold, why, and what you can ask us to do about it.",
    sections: [
      {
        heading: "If someone added you",
        body: [
          "You may be in this system because a person who knows you wanted to recommend you. You did not sign up, and you do not have to.",
          "You can have the profile removed, or claim it and control it, from the link at the bottom of that profile. No account is needed. A removal request hides the profile immediately, and confirming it deletes every recommendation attached to it.",
          "A private individual's phone number is never shown publicly. It is visible only to the person who added them and to anyone who has independently recommended them. Everyone else sees a masked form.",
        ],
      },
      {
        heading: "What we collect from members",
        body: [
          "Account data: name, email, password hash, optional phone number.",
          "Your recommendations: who you recommend, how you know them, how strongly, your note, and the audience you chose.",
          "Your network: connections you have accepted and groups you have joined.",
          "Technical data: a session cookie, IP address, and server logs. IP addresses are also used for rate limiting.",
        ],
      },
      {
        heading: "Who sees what",
        body: [
          "Private: only you. This is the default for everything, including imported contacts.",
          "Connections: people who have accepted a mutual connection with you.",
          "Groups: members of the specific groups you selected.",
          "Anyone with the link: genuinely public. Only these entries appear on a shared list, and only these can be handed out as a URL.",
          "We do not sell personal information, and we do not show your list to anyone you have not chosen.",
        ],
      },
      {
        heading: "Your rights",
        body: [
          "Depending on your state — including under the CCPA/CPRA in California and equivalent laws elsewhere — you may request a copy of your data, correction, or deletion.",
          "Contact us from the email on your account, or through the claim link if you do not have one.",
        ],
      },
      {
        heading: "Students and the help board",
        body: [
          "To use the help board you verify a college email address. We store that address and when you verified it, only to prove you belong to that college and to stop one student address backing several accounts. The code we email you is stored only as a hash and expires in 15 minutes.",
          "Contact details on a help post (your account email, and a phone number if you add one) are shown only to the single person whose response you accept, and only after you accept.",
        ],
      },
      {
        heading: "Contacts in other countries",
        body: [
          "You can recommend someone in another country. Their phone number is stored in international format, and the same rules apply to them as to anyone listed here, including the right to ask for removal.",
        ],
      },
      {
        heading: "Email and texts",
        body: [
          "We email you about connection requests, asks sent to your network, and answers to your own asks.",
          "We do not send marketing texts. Any SMS would require an explicit opt-in recorded against your account.",
        ],
      },
    ],
  },
  "content-policy": {
    title: "Content policy",
    intro: "What belongs here, what does not, and how removal works.",
    sections: [
      {
        heading: "Positive recommendations only",
        body: [
          "There is no star rating and no negative review anywhere in this product. You either vouch for someone or you say nothing.",
          "That is a deliberate design choice, not an oversight. It matches how people actually pass on a contact, and it keeps the product from becoming a place where someone's livelihood can be damaged anonymously.",
        ],
      },
      {
        heading: "Listing a private individual",
        body: [
          "Adding a person — a babysitter, a tutor, a cleaner — is allowed, because that is often exactly who a friend needs. But that person did not choose to be here.",
          "So: their number is never public, they can remove themselves without an account, and a confirmed removal deletes every recommendation attached to them and blocks the number from being re-added.",
          "Do not add someone who has asked you not to.",
        ],
      },
      {
        heading: "Not accepted",
        body: [
          "Adult services and personals. These sit inside the FOSTA/SESTA carve-out to Section 230, which would remove the protection that lets this site host user content at all.",
          "Investment or financial advice — regulator rules on referrals make recommendation-passing in that field a licensing problem.",
          "Immigration consulting by anyone who is not a licensed attorney or DOJ-accredited representative, firearms and ammunition, cannabis and CBD.",
        ],
      },
      {
        heading: "Doctors and lawyers",
        body: [
          "Where healthcare and legal contacts are enabled, they are contact details only. We link to the practitioner's own website or portal; we do not take bookings, hold client or patient information, or accept money for placement.",
          "A recommendation of a doctor or lawyer is kept short and must not include health or legal details — yours or anyone else's.",
          "Licences are checked by an administrator against the public registry or state bar, and the profile says whether that has happened. This is not medical or legal advice, and it is not for emergencies.",
        ],
      },
      {
        heading: "Help from other students",
        body: [
          "The help board (airport pickups, a first-week stay, a room or sublet, belongings) is open only to students who have verified an address at their college.",
          "No money changes hands through the site, and nobody may ask for a deposit or fee. Posts about a place to stay may not state a preference based on race, colour, religion or national origin.",
          "Anything that feels unsafe can be reported from the post, and reported posts are reviewed.",
        ],
      },
      {
        heading: "Reporting and enforcement",
        body: [
          "Any profile can be reported. Every report gets a decision, and an administrator reviews removal requests.",
          "We may remove content and suspend accounts that break these rules.",
        ],
      },
    ],
  },
  accessibility: {
    title: "Accessibility",
    intro: "Our commitment and the standard we build against.",
    sections: [
      {
        heading: "Standard",
        body: [
          "We build against WCAG 2.1 Level AA: keyboard access, visible focus, colour contrast, labelled form fields and error messages, and support for reduced-motion and screen-reader use.",
          "Colour is never the only way information is conveyed — category colours are always paired with the category name, and recommendation strength is always spelled out in words.",
        ],
      },
      {
        heading: "Work in progress",
        body: [
          "This is a young product. If something blocks you, tell us and we will treat it as a defect, not a feature request.",
        ],
      },
    ],
  },
  "provider-terms": {
    title: "If you have been recommended",
    intro: "What it means to appear here, and how to control it.",
    sections: [
      {
        heading: "How you got here",
        body: [
          "Someone who knows you added you because they wanted to pass your details to people they trust. Nobody paid for it and we did not scrape it.",
        ],
      },
      {
        heading: "What is shown",
        body: [
          "Your name, category, rough location, and whatever the person who recommended you wrote about you.",
          "If you are listed as a private individual rather than a business, your phone number is masked to anyone who does not already know you.",
        ],
      },
      {
        heading: "Your control",
        body: [
          "Claim the profile and manage it, or have it removed entirely. Neither requires an account.",
          "A removal request hides the profile straight away, before a human has looked at it. Once confirmed, the recommendations attached to it are deleted too.",
        ],
      },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = DOCS[slug];
  return doc ? { title: doc.title, description: doc.intro } : { title: "Not found" };
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = DOCS[slug];
  if (!doc) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={doc.title} description={doc.intro} />

      <Alert tone="info">
        Draft policy text. It describes what this product actually does, but it has not
        been reviewed by an attorney and is not legal advice. Get it reviewed before you
        take real users.
      </Alert>

      <div className="space-y-8">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-semibold text-ink">{section.heading}</h2>
            <div className="mt-2 space-y-3 text-sm leading-relaxed text-ink-muted">
              {section.body.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
