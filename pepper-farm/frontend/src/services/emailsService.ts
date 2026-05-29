import { apiFetch } from './api';

// ── Basic send (quick newsletter without a saved template) ────────────────────

export type RecipientGroup = 'customers' | 'workers' | 'all';
export type EmailType = 'newsletter' | 'announcement';
export type ScheduledLabel = 'weekly' | 'monthly' | 'general';

export interface NewsletterPayload {
  subject: string;
  message: string;
  recipientGroups: RecipientGroup[];
  emailType: EmailType;
  scheduledLabel?: ScheduledLabel;
}

export interface NewsletterResult {
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  message: string;
}

export interface EmailLogEntry {
  EmailLogId: number;
  RecipientEmail: string;
  RecipientName: string | null;
  RecipientType: string;
  Subject: string;
  MessagePreview: string | null;
  EmailType: string;
  Status: 'sent' | 'failed' | 'pending' | 'skipped';
  ErrorMessage: string | null;
  RelatedProductId: number | null;
  RelatedDiscountPercentage: number | null;
  SentAtUtc: string | null;
  CreatedAtUtc: string;
  CreatedBy: number | null;
}

export async function sendNewsletter(payload: NewsletterPayload): Promise<NewsletterResult> {
  return apiFetch<NewsletterResult>('/api/emails/send-newsletter', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getEmailLogs(): Promise<EmailLogEntry[]> {
  return apiFetch<EmailLogEntry[]>('/api/emails/logs');
}

// ── Newsletter template types ─────────────────────────────────────────────────

export type BlockType = 'heading' | 'paragraph' | 'image' | 'button' | 'divider';

export interface HeadingBlock  { type: 'heading';   text: string }
export interface ParagraphBlock{ type: 'paragraph'; text: string }
export interface ImageBlock    { type: 'image';     url: string; alt: string }
export interface ButtonBlock   { type: 'button';    text: string; url: string }
export interface DividerBlock  { type: 'divider' }

export type ContentBlock =
  | HeadingBlock
  | ParagraphBlock
  | ImageBlock
  | ButtonBlock
  | DividerBlock;

export type TemplateStatus = 'draft' | 'ready' | 'archived';

export interface TemplatePayload {
  title: string;
  subject: string;
  preheader?: string | null;
  heroImageUrl?: string | null;
  blocks: ContentBlock[];
  bodyText?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
  footerText?: string | null;
  status: TemplateStatus;
}

export interface TemplateEntry {
  NewsletterTemplateId: number;
  title: string;
  subject: string;
  preheader: string | null;
  heroImageUrl: string | null;
  blocks: ContentBlock[];
  bodyText: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  footerText: string | null;
  status: TemplateStatus;
  createdAtUtc: string;
  updatedAtUtc: string;
  createdBy: number | null;
  updatedBy: number | null;
}

export interface SendTemplateResult {
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  message: string;
}

export interface PreviewResult {
  html: string;
  plainText: string;
}

// ── Newsletter image upload ────────────────────────────────────────────────────

export async function uploadNewsletterImage(file: File): Promise<{ imageUrl: string }> {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch<{ imageUrl: string }>('/api/newsletter-templates/upload-image', {
    method: 'POST',
    body: formData,
  });
}

// ── Newsletter template API calls ─────────────────────────────────────────────

export async function listTemplates(): Promise<TemplateEntry[]> {
  return apiFetch<TemplateEntry[]>('/api/newsletter-templates');
}

export async function getTemplate(id: number): Promise<TemplateEntry> {
  return apiFetch<TemplateEntry>(`/api/newsletter-templates/${id}`);
}

export async function createTemplate(payload: TemplatePayload): Promise<TemplateEntry> {
  return apiFetch<TemplateEntry>('/api/newsletter-templates', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTemplate(id: number, payload: TemplatePayload): Promise<TemplateEntry> {
  return apiFetch<TemplateEntry>(`/api/newsletter-templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function archiveTemplate(id: number): Promise<TemplateEntry> {
  return apiFetch<TemplateEntry>(`/api/newsletter-templates/${id}`, {
    method: 'DELETE',
  });
}

export async function previewTemplate(id: number): Promise<PreviewResult> {
  return apiFetch<PreviewResult>(`/api/newsletter-templates/${id}/preview`);
}

export async function sendTemplate(
  id: number,
  recipientGroups: RecipientGroup[],
): Promise<SendTemplateResult> {
  return apiFetch<SendTemplateResult>(`/api/newsletter-templates/${id}/send`, {
    method: 'POST',
    body: JSON.stringify({ recipientGroups }),
  });
}
