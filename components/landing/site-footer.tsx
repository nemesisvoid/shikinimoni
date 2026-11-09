import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { siteConfig } from "@/lib/site";

const COLUMNS = [
  {
    title: "Explore",
    links: [
      { href: "/?type=sale#listings", label: "Buy" },
      { href: "/?type=rent#listings", label: "Rent" },
      { href: "/?type=land#listings", label: "Land" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/#how-it-works", label: "How buying works" },
      { href: "/#sell", label: "Sell with us" },
      { href: "/contact", label: "Contact" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-ink-50">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr] lg:px-8">
        <div className="max-w-sm">
          <Logo className="h-10" />
          <p className="mt-4 text-sm text-muted-foreground">{siteConfig.description}</p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-sm font-semibold">{col.title}</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-muted-foreground transition-colors hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-7xl px-4 py-6 text-xs text-muted-foreground sm:px-6 lg:px-8">
          © ShikiniMoni. Listings and photos on this page are placeholders.
        </p>
      </div>
    </footer>
  );
}
