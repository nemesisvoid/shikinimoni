'use client';

import { useState } from 'react';
import { ExternalLink, FileText, Loader2 } from 'lucide-react';
import { getDocumentLink } from '@/actions/document.action';
import { DOCUMENT_TYPE_LABEL } from '@/lib/admin/property-options';
import type { ListingDetail } from '@/lib/listings/types';

/**
 * Documents the seller agreed to show. Files stay in the private bucket; each
 * click asks the server for a five-minute link and opens it in a new tab.
 */
export function DocumentLinks({ documents }: { documents: ListingDetail['documents'] }) {
  return (
    <ul className='divide-y divide-azure-200/70 border-t border-azure-200/70'>
      {documents.map(doc => (
        <DocumentRow
          key={doc.id}
          doc={doc}
        />
      ))}
    </ul>
  );
}

function DocumentRow({ doc }: { doc: ListingDetail['documents'][number] }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setError(null);
    setOpening(true);
    // Open the tab during the click so pop-up blockers allow it, then point it at the file.
    const tab = window.open('about:blank', '_blank');
    try {
      const result = await getDocumentLink({ id: doc.id });
      if (result.ok && tab) tab.location.href = result.data.url;
      else {
        tab?.close();
        setError(result.ok ? 'Allow pop-ups for this site to open documents.' : result.error);
      }
    } catch {
      tab?.close();
      setError("The document didn't open. Check your connection and try again.");
    } finally {
      setOpening(false);
    }
  }

  return (
    <li className='py-3'>
      <button
        type='button'
        onClick={open}
        disabled={opening}
        className='group flex w-full items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-wait'>
        <span className='grid size-10 shrink-0 place-items-center rounded-xl bg-background text-azure-700 shadow-sm'>
          {opening ? (
            <Loader2
              aria-hidden
              className='size-5 animate-spin'
            />
          ) : (
            <FileText
              aria-hidden
              className='size-5'
            />
          )}
        </span>
        <span className='min-w-0 flex-1'>
          <span className='block truncate font-semibold group-hover:text-primary'>{doc.name}</span>
          <span className='block text-sm text-muted-foreground'>{DOCUMENT_TYPE_LABEL[doc.type].replace(/ \(.*\)$/, '')}</span>
        </span>
        <span className='flex shrink-0 items-center gap-1 text-sm font-medium text-azure-700'>
          View
          <ExternalLink
            aria-hidden
            className='size-4'
          />
        </span>
      </button>
      {error && (
        <p
          role='alert'
          className='mt-2 text-sm text-destructive'>
          {error}
        </p>
      )}
    </li>
  );
}
