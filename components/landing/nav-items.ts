/** Main navigation, shared by the desktop header and the mobile menu. */
export const MAIN_NAV = [
  { href: "/?type=sale#listings", label: "Buy" },
  { href: "/?type=rent#listings", label: "Rent" },
  { href: "/?type=land#listings", label: "Land" },
  { href: "/#how-it-works", label: "How buying works" },
] as const;
