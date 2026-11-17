import { formatSize } from '@/lib/format';
import type { ListingCardData } from './types';

/** The size worth showing on a card: plot size for land, floor area for buildings. */
export function sizeLabel(p: Pick<ListingCardData, 'category' | 'landSize' | 'landSizeUnit' | 'floorAreaSqm'>) {
  if (p.category === 'LAND' && p.landSize && p.landSizeUnit) return formatSize(p.landSize, p.landSizeUnit);
  if (p.floorAreaSqm) return formatSize(p.floorAreaSqm, 'SQM');
  if (p.landSize && p.landSizeUnit) return formatSize(p.landSize, p.landSizeUnit);
  return null;
}

/** "Lekki Phase 1, Lekki, Lagos", skipping blanks and repeats. */
export const locationLine = (p: Pick<ListingCardData, 'neighborhood' | 'city' | 'state'>) =>
  [p.neighborhood, p.city, p.state].filter((part, i, all) => part && all.indexOf(part) === i).join(', ');
