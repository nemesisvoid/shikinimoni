import * as z from 'zod';
import { emailAddress, requiredText, uuid } from './fields';

/** Admin → Agents → Invite. */
export const InviteAgentSchema = z.object({
  name: requiredText('their name', { max: 120 }),
  email: emailAddress(),
});

export const AgentIdSchema = uuid('agent');
export const InviteIdSchema = uuid('invite');

/** Admin review: the note sent back to the agent. Required when sending back or rejecting. */
export const ReviewNoteSchema = requiredText('a note for the agent', { max: 1000 });

/** Agent photo: one image, uploaded straight to storage. */
export const AGENT_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_AGENT_PHOTO_BYTES = 5 * 1024 * 1024;
export const AgentPhotoUploadSchema = z.object({
  contentType: z.enum(AGENT_PHOTO_TYPES, { error: 'Use a JPG, PNG or WebP image' }),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_AGENT_PHOTO_BYTES, { error: 'Use an image under 5 MB' }),
});
export const AgentPhotoKeySchema = z.string().max(512);
