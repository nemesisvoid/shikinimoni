import 'server-only';
import { prisma } from '@/lib/db';

/** A few messages per address in this window is plenty; more is usually a bot or a double-click. */
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 3;

/** True when this email has already sent the most enquiries allowed in the window (any form). */
export async function tooManyRecentInquiries(email: string) {
  const recent = await prisma.inquiry.count({
    where: { email, createdAt: { gte: new Date(Date.now() - RATE_WINDOW_MS) } },
  });
  return recent >= RATE_LIMIT;
}

export const RATE_LIMITED_MESSAGE =
  "We've already got your recent messages and will reply soon. If it's urgent, call or WhatsApp us.";
