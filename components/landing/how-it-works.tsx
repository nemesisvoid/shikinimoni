const STEPS = [
  {
    title: "Find a property",
    body: "Filter by area, budget and type. Each listing shows its size, price and title document up front.",
  },
  {
    title: "Book an inspection",
    body: "Pick a day that suits you and visit the property with one of our agents.",
  },
  {
    title: "Check the documents",
    body: "We share the survey plan and title so your lawyer can verify them before you pay anything.",
  },
  {
    title: "Pay and take ownership",
    body: "Pay outright or by instalment, then receive your receipt, deed and keys.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="text-h1">How buying works</h2>
          <p className="mt-4 text-lead text-muted-foreground">
            Four steps from first search to keys in hand. You see the papers before money changes hands.
          </p>
        </div>

        <ol className="mt-14 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative">
              {/* Step number sits in the brand's house silhouette. */}
              <span
                aria-hidden
                className="grid size-12 place-items-center bg-plum-800 pt-2.5 font-heading text-lg font-extrabold text-white [clip-path:var(--clip-house)]"
              >
                {i + 1}
              </span>
              <h3 className="mt-5 text-h3">
                <span className="sr-only">Step {i + 1}: </span>
                {step.title}
              </h3>
              <p className="mt-2 text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
