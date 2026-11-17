/** Plain data the enquiry emails render; built by lib/email/enquiries.ts. Dates arrive pre-formatted. */
export type EnquiryEmailData = {
  kind: 'viewing' | 'question' | 'offer' | 'contact';
  name: string;
  email: string;
  phone: string | null;
  message: string;
  /** "Saturday, 22 November", only for inspection requests. */
  preferredDate: string | null;
  /** "17 Nov 2026, 2:15 pm" in Lagos time. */
  receivedAt: string;
  property: { name: string; ref: string; location: string; url: string } | null;
};
