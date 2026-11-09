import { Roofline } from "@/components/landing/roofline";
import Link from "next/link";

export function SellerCta() {
  return (
    <section id="sell" aria-labelledby="sell-heading" className="scroll-mt-20 px-4 pb-20 sm:px-6 lg:px-8 lg:pb-28">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-inverse px-6 py-14 text-inverse-foreground sm:px-12 lg:px-16 lg:py-20">
        <Roofline className="pointer-events-none absolute -right-16 -bottom-24 w-[28rem] opacity-30 sm:w-[34rem] lg:right-8 lg:-bottom-40 lg:w-[40rem] lg:opacity-40" />
        <div className="relative max-w-xl">
          <h2 id="sell-heading" className="text-h1">
            Selling land or a house?
          </h2>
          <p className="mt-4 text-lead text-plum-100">
            List it with ShikiniMoni. We photograph it, check the papers, and arrange inspections with serious
            buyers.
          </p>
          <Link
            href="/contact?topic=selling"
            className="mt-8 inline-flex h-12 items-center rounded-full bg-highlight px-6 font-semibold text-highlight-foreground transition-[filter] duration-200 hover:brightness-105 focus-visible:ring-3 focus-visible:ring-white/60 focus-visible:outline-none"
          >
            Talk to our team
          </Link>
        </div>
      </div>
    </section>
  );
}
