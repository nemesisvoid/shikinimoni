import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import logo from "@/public/brand/shikinimoni-logo.png";

/** The full-colour logo links home. Height is set by className (width follows). */
export function Logo({ className, preload = false }: { className?: string; preload?: boolean }) {
  return (
    <Link href="/" className={cn("inline-flex shrink-0 rounded-md", className)} aria-label="ShikiniMoni home">
      <Image src={logo} alt="" preload={preload} className="h-full w-auto" sizes="200px" />
    </Link>
  );
}
