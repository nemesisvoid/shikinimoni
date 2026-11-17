'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Dialog } from '@base-ui/react/dialog';
import { ChevronLeft, ChevronRight, Images, XIcon } from 'lucide-react';
import { PhotoPlaceholder } from '@/components/listing/photo-placeholder';
import { Button } from '@/components/ui/button';
import type { ListingDetail } from '@/lib/listings/types';
import { cn } from '@/lib/utils';

type Photo = ListingDetail['photos'][number];

/** Cover plus up to four more beside it on large screens; every photo opens the full-screen viewer. */
export function PhotoGallery({ photos, name }: { photos: Photo[]; name: string }) {
  const [open, setOpen] = useState<number | null>(null);

  if (photos.length === 0) {
    return <PhotoPlaceholder className='aspect-video rounded-[2rem] lg:aspect-[2.6/1]' />;
  }

  const [cover, ...rest] = photos;
  const side = rest.slice(0, 4);

  return (
    <>
      <div
        className={cn(
          'relative grid gap-2 overflow-hidden rounded-[2rem]',
          side.length > 0 && 'lg:h-[30rem] lg:grid-cols-4 lg:grid-rows-2',
        )}>
        <Tile
          photo={cover}
          index={0}
          total={photos.length}
          onOpen={setOpen}
          preload
          sizes={side.length > 0 ? '(min-width: 1024px) 50vw, 100vw' : '100vw'}
          className={cn(
            'aspect-4/3 sm:aspect-video',
            side.length > 0 ? 'lg:col-span-2 lg:row-span-2 lg:aspect-auto' : 'lg:aspect-[2.6/1]',
          )}
        />
        {side.length > 0 && (
          <div className='hidden gap-2 lg:col-span-2 lg:row-span-2 lg:grid lg:grid-cols-2 lg:grid-rows-2'>
            {side.map((photo, i) => (
              <Tile
                key={photo.id}
                photo={photo}
                index={i + 1}
                total={photos.length}
                onOpen={setOpen}
                sizes='25vw'
                className={cn(
                  side.length === 1 && 'col-span-2 row-span-2',
                  side.length === 2 && 'col-span-2',
                  side.length === 3 && i === 0 && 'col-span-2',
                )}
              />
            ))}
          </div>
        )}

        {photos.length > 1 && (
          <Button
            type='button'
            variant='outline'
            onClick={() => setOpen(0)}
            className='absolute right-4 bottom-4 border-transparent bg-background/90 shadow-card backdrop-blur hover:bg-background'>
            <Images aria-hidden />
            Show all {photos.length} photos
          </Button>
        )}
      </div>

      <PhotoViewer
        photos={photos}
        name={name}
        index={open}
        onIndexChange={setOpen}
      />
    </>
  );
}

function Tile({
  photo,
  index,
  total,
  onOpen,
  sizes,
  preload = false,
  className,
}: {
  photo: Photo;
  index: number;
  total: number;
  onOpen: (index: number) => void;
  sizes: string;
  preload?: boolean;
  className?: string;
}) {
  return (
    <button
      type='button'
      onClick={() => onOpen(index)}
      aria-label={`Open photo ${index + 1} of ${total}: ${photo.alt}`}
      className={cn(
        'group relative cursor-zoom-in overflow-hidden bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:ring-inset',
        className,
      )}>
      <Image
        src={photo.url}
        alt=''
        fill
        preload={preload}
        sizes={sizes}
        className='object-cover transition-[transform,filter] duration-500 ease-out-soft group-hover:scale-[1.02] group-hover:brightness-95'
      />
    </button>
  );
}

function PhotoViewer({
  photos,
  name,
  index,
  onIndexChange,
}: {
  photos: Photo[];
  name: string;
  index: number | null;
  onIndexChange: (index: number | null) => void;
}) {
  const current = index ?? 0;
  const photo = photos[current];
  const go = (step: number) => onIndexChange((current + step + photos.length) % photos.length);
  const many = photos.length > 1;

  return (
    <Dialog.Root
      open={index !== null}
      onOpenChange={open => !open && onIndexChange(null)}>
      <Dialog.Portal>
        <Dialog.Backdrop className='fixed inset-0 z-50 bg-ink-950/95 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0' />
        <Dialog.Popup
          onKeyDown={e => {
            if (!many) return;
            if (e.key === 'ArrowRight') go(1);
            if (e.key === 'ArrowLeft') go(-1);
          }}
          className='fixed inset-0 z-50 flex flex-col text-white outline-none transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0'>
          <div className='flex items-center justify-between gap-4 px-4 py-3 sm:px-6'>
            <Dialog.Title className='min-w-0 truncate text-sm font-medium text-white/80'>
              <span className='sr-only'>Photos of {name}. </span>
              <span className='tabular-nums'>
                {current + 1} / {photos.length}
              </span>
            </Dialog.Title>
            <Dialog.Close
              aria-label='Close photos'
              className='grid size-11 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-3 focus-visible:ring-white/50 focus-visible:outline-none'>
              <XIcon className='size-6' />
            </Dialog.Close>
          </div>

          <div className='relative flex-1'>
            {photo && (
              <Image
                key={photo.id}
                src={photo.url}
                alt={photo.alt}
                fill
                sizes='100vw'
                className='object-contain px-2 sm:px-20'
              />
            )}
            {many && (
              <>
                <ViewerArrow
                  side='left'
                  onClick={() => go(-1)}
                />
                <ViewerArrow
                  side='right'
                  onClick={() => go(1)}
                />
              </>
            )}
          </div>

          <p className='px-4 pt-3 text-center text-sm text-white/70'>{photo?.alt}</p>

          {many && (
            <ul className='flex gap-2 overflow-x-auto px-4 py-4 sm:justify-center'>
              {photos.map((p, i) => (
                <li
                  key={p.id}
                  className='shrink-0'>
                  <button
                    type='button'
                    onClick={() => onIndexChange(i)}
                    aria-label={`Photo ${i + 1}`}
                    aria-current={i === current ? 'true' : undefined}
                    className={cn(
                      'relative block h-14 w-20 overflow-hidden rounded-lg opacity-50 ring-2 ring-transparent transition-[opacity,box-shadow] hover:opacity-90 focus-visible:ring-white/70 focus-visible:outline-none',
                      i === current && 'opacity-100 ring-highlight',
                    )}>
                    <Image
                      src={p.url}
                      alt=''
                      fill
                      sizes='80px'
                      className='object-cover'
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ViewerArrow({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type='button'
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous photo' : 'Next photo'}
      className={cn(
        'absolute top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 focus-visible:ring-3 focus-visible:ring-white/50 focus-visible:outline-none',
        side === 'left' ? 'left-3 sm:left-5' : 'right-3 sm:right-5',
      )}>
      <Icon className='size-6' />
    </button>
  );
}
