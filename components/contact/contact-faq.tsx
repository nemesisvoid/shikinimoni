import { Plus } from 'lucide-react';

/**
 * Answers drawn from what the site already promises (How buying works, Sell
 * with us), so this page doesn't introduce new commitments.
 */
const QUESTIONS = [
  {
    q: 'Can I see the papers before I pay anything?',
    a: 'Yes. Every listing shows its title document, and we share the survey plan and title so your lawyer can check them before any money changes hands.',
  },
  {
    q: 'How do I book an inspection?',
    a: 'Send us the listing’s name or its PRP reference and the days that suit you. One of our agents will confirm a time and go with you.',
  },
  {
    q: 'I want to sell. What do you need from me?',
    a: 'Where the property is, what it is, and the title documents you hold, such as a C of O, Governor’s Consent or survey plan. We photograph it, check the papers and arrange inspections with serious buyers.',
  },
  {
    q: 'Can I pay by instalment?',
    a: 'Where the seller allows it, yes. Ask us about the listing you’re interested in and we’ll tell you the terms.',
  },
];

export function ContactFaq() {
  return (
    <section
      aria-labelledby='faq-heading'
      className='mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:px-8 lg:py-28'>
      <div>
        <h2
          id='faq-heading'
          className='text-h2'>
          Before you write
        </h2>
        <p className='mt-3 max-w-sm text-muted-foreground'>The questions we answer most. If yours isn’t here, send it above.</p>
      </div>
      <div className='divide-y border-y'>
        {QUESTIONS.map(item => (
          <details
            key={item.q}
            className='group py-1'>
            <summary className='flex cursor-pointer list-none items-center justify-between gap-6 rounded-lg py-4 text-left font-heading text-lg font-bold tracking-tight focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none [&::-webkit-details-marker]:hidden'>
              {item.q}
              <span
                aria-hidden
                className='grid size-8 shrink-0 place-items-center rounded-full bg-plum-50 text-plum-800 transition-transform duration-200 group-open:rotate-45'>
                <Plus className='size-4' />
              </span>
            </summary>
            <p className='max-w-prose pb-5 text-muted-foreground'>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
