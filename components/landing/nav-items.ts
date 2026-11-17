/** Main navigation, shared by the desktop header and the mobile menu. */
export const MAIN_NAV = [
  { href: "/properties?type=sale", label: "Buy" },
  { href: "/properties?type=rent", label: "Rent" },
  { href: "/properties?type=land", label: "Land" },
  { href: "/#how-it-works", label: "How buying works" },
  { href: "/contact", label: "Contact" },
] as const;
