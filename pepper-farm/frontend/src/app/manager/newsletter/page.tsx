'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ContentBlock,
  EmailLogEntry,
  RecipientGroup,
  SendTemplateResult,
  TemplateEntry,
  TemplatePayload,
  TemplateStatus,
  archiveTemplate,
  createTemplate,
  getEmailLogs,
  listTemplates,
  previewTemplate,
  sendTemplate,
  updateTemplate,
  uploadNewsletterImage,
} from '@/services/emailsService';
import {
  AnnounceRole,
  publishAnnouncement,
} from '@/services/notificationsService';
import { useLanguage } from '@/context/LanguageContext';

/* ── Utility ─────────────────────────────────────────────────────────────────── */

const STATUS_COLOR: Record<TemplateStatus, string> = {
  draft:    'bg-yellow-100 text-yellow-700',
  ready:    'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-500',
};

const LOG_STATUS_COLOR: Record<string, string> = {
  sent:    'bg-green-100 text-green-700',
  failed:  'bg-red-100 text-red-600',
  pending: 'bg-yellow-100 text-yellow-700',
  skipped: 'bg-gray-100 text-gray-600',
};

function formatUtc(iso: string | null | undefined): string {
  if (!iso) return '—';
  const s = iso.endsWith('Z') ? iso : iso + 'Z';
  return new Date(s).toLocaleString();
}

function emptyPayload(): TemplatePayload {
  return {
    title: '', subject: '', preheader: '', heroImageUrl: '',
    blocks: [], ctaText: '', ctaUrl: '', footerText: '', status: 'draft',
  };
}

function isValidImageUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/uploads/');
}

/* ── ImageInputField — dual-mode upload/URL with preview ─────────────────────── */

type ImageInputFieldProps = {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  testIdPrefix?: string;
  t: {
    uploadImage: string;
    uploadImageBtn: string;
    uploading: string;
    uploadFailed: string;
    pasteImageUrl: string;
    invalidImageUrl: string;
    imagePreview: string;
  };
};

function ImageInputField({ value, onChange, placeholder, testIdPrefix = 'img', t }: ImageInputFieldProps) {
  const [mode, setMode]         = useState<'url' | 'upload'>('url');
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const [urlErr, setUrlErr]       = useState('');
  const fileRef                   = useRef<HTMLInputElement>(null);

  const handleUrlChange = (v: string) => {
    setUrlErr('');
    onChange(v);
    if (v && !isValidImageUrl(v)) setUrlErr(t.invalidImageUrl);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadErr('');
    setUploading(true);
    try {
      const res = await uploadNewsletterImage(file);
      onChange(res.imageUrl);
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : t.uploadFailed);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const showPreview = value && isValidImageUrl(value);

  return (
    <div className="space-y-2" data-testid={`${testIdPrefix}-image-input`}>
      {/* Mode tabs */}
      <div className="flex gap-1">
        <button type="button"
          onClick={() => setMode('upload')}
          className={`px-2.5 py-1 text-xs rounded border transition ${mode === 'upload' ? 'bg-[var(--color-primary)] text-white border-transparent' : 'border-[var(--color-border)] hover:bg-[var(--color-muted)]'}`}
          data-testid={`${testIdPrefix}-upload-tab`}>
          {t.uploadImage}
        </button>
        <button type="button"
          onClick={() => setMode('url')}
          className={`px-2.5 py-1 text-xs rounded border transition ${mode === 'url' ? 'bg-[var(--color-primary)] text-white border-transparent' : 'border-[var(--color-border)] hover:bg-[var(--color-muted)]'}`}
          data-testid={`${testIdPrefix}-url-tab`}>
          {t.pasteImageUrl}
        </button>
      </div>

      {/* Upload mode */}
      {mode === 'upload' && (
        <div className="flex items-center gap-2">
          <button type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 text-xs rounded border border-[var(--color-border)] hover:bg-[var(--color-muted)] disabled:opacity-50 transition"
            data-testid={`${testIdPrefix}-file-btn`}>
            {uploading ? t.uploading : t.uploadImageBtn}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
            data-testid={`${testIdPrefix}-file-input`}
          />
          {value && (
            <span className="text-xs text-[var(--color-muted-foreground)] truncate max-w-[240px]" title={value}>
              {value.split('/').pop()}
            </span>
          )}
        </div>
      )}

      {/* URL mode */}
      {mode === 'url' && (
        <div>
          <input type="text"
            value={value}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder={placeholder ?? 'https://...'}
            className={`w-full border rounded px-2 py-1 text-sm ${urlErr ? 'border-[var(--color-error)]' : 'border-[var(--color-border)]'}`}
            data-testid={`${testIdPrefix}-url-input`}
          />
          {urlErr && <p className="text-xs text-[var(--color-error)] mt-0.5">{urlErr}</p>}
        </div>
      )}

      {/* Error from upload */}
      {uploadErr && (
        <p className="text-xs text-[var(--color-error)]" data-testid={`${testIdPrefix}-upload-error`}>{uploadErr}</p>
      )}

      {/* Preview */}
      {showPreview && (
        <div className="mt-1" data-testid={`${testIdPrefix}-preview`}>
          <p className="text-[10px] text-[var(--color-muted-foreground)] mb-0.5">{t.imagePreview}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="preview"
            style={{ maxWidth: '100%', maxHeight: 160, height: 'auto', display: 'block', borderRadius: 4, objectFit: 'contain', background: '#f5f5f5' }}
          />
        </div>
      )}
    </div>
  );
}

/* ── Block editor ─────────────────────────────────────────────────────────────── */

type BlockEditorProps = {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  t: Record<string, string>;
};

function BlockEditor({ blocks, onChange, t }: BlockEditorProps) {
  function addBlock(type: ContentBlock['type']) {
    const defaults: Record<string, ContentBlock> = {
      heading:   { type: 'heading',   text: '' },
      paragraph: { type: 'paragraph', text: '' },
      image:     { type: 'image',     url: '',  alt: '' },
      button:    { type: 'button',    text: '', url: '' },
      divider:   { type: 'divider' },
    };
    onChange([...blocks, defaults[type]]);
  }

  function removeBlock(i: number) {
    onChange(blocks.filter((_, idx) => idx !== i));
  }

  function moveBlock(i: number, dir: -1 | 1) {
    const next = [...blocks];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  function updateBlock(i: number, patch: Partial<ContentBlock>) {
    const next = blocks.map((b, idx) => (idx === i ? { ...b, ...patch } : b));
    onChange(next as ContentBlock[]);
  }

  const imgT = {
    uploadImage:   t.uploadImage   ?? 'Upload Image',
    uploadImageBtn:t.uploadImageBtn?? 'Choose File',
    uploading:     t.uploading     ?? 'Uploading...',
    uploadFailed:  t.uploadFailed  ?? 'Upload failed.',
    pasteImageUrl: t.pasteImageUrl ?? 'Or paste URL',
    invalidImageUrl:t.invalidImageUrl?? 'Invalid URL',
    imagePreview:  t.imagePreview  ?? 'Preview',
  };

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => (
        <div key={i} className="border border-[var(--color-border)] rounded-lg p-3 bg-[var(--color-muted)]/20" data-testid={`block-${i}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase text-[var(--color-muted-foreground)] tracking-wide capitalize">
              {t[`block${block.type.charAt(0).toUpperCase()}${block.type.slice(1)}`] ?? block.type}
            </span>
            <div className="flex gap-1">
              <button type="button" onClick={() => moveBlock(i, -1)} disabled={i === 0}
                className="px-1.5 py-0.5 text-xs rounded border border-[var(--color-border)] disabled:opacity-30 hover:bg-[var(--color-muted)]">↑</button>
              <button type="button" onClick={() => moveBlock(i, 1)} disabled={i === blocks.length - 1}
                className="px-1.5 py-0.5 text-xs rounded border border-[var(--color-border)] disabled:opacity-30 hover:bg-[var(--color-muted)]">↓</button>
              <button type="button" onClick={() => removeBlock(i)}
                className="px-1.5 py-0.5 text-xs rounded border border-red-200 text-red-500 hover:bg-red-50">✕</button>
            </div>
          </div>

          {(block.type === 'heading' || block.type === 'paragraph') && (
            block.type === 'heading'
              ? <input type="text" value={block.text} placeholder={t.blockText}
                  onChange={(e) => updateBlock(i, { text: e.target.value })}
                  className="w-full border border-[var(--color-border)] rounded px-2 py-1 text-sm" />
              : <textarea rows={3} value={block.text} placeholder={t.blockText}
                  onChange={(e) => updateBlock(i, { text: e.target.value })}
                  className="w-full border border-[var(--color-border)] rounded px-2 py-1 text-sm" />
          )}

          {block.type === 'image' && (
            <div className="space-y-2">
              <ImageInputField
                value={block.url}
                onChange={(url) => updateBlock(i, { url })}
                testIdPrefix={`block-img-${i}`}
                t={imgT}
              />
              <input type="text" value={block.alt} placeholder={t.blockAlt}
                onChange={(e) => updateBlock(i, { alt: e.target.value })}
                className="w-full border border-[var(--color-border)] rounded px-2 py-1 text-sm" />
            </div>
          )}

          {block.type === 'button' && (
            <div className="space-y-1.5">
              <input type="text" value={block.text} placeholder={t.blockText} onChange={(e) => updateBlock(i, { text: e.target.value })}
                className="w-full border border-[var(--color-border)] rounded px-2 py-1 text-sm" />
              <input type="text" value={block.url} placeholder="https://..." onChange={(e) => updateBlock(i, { url: e.target.value })}
                className="w-full border border-[var(--color-border)] rounded px-2 py-1 text-sm" />
            </div>
          )}

          {block.type === 'divider' && (
            <hr className="border-[var(--color-border)] my-1" />
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2 pt-1">
        {(['heading', 'paragraph', 'image', 'button', 'divider'] as ContentBlock['type'][]).map((bt) => (
          <button key={bt} type="button" onClick={() => addBlock(bt)}
            className="px-2.5 py-1 text-xs rounded border border-[var(--color-border)] hover:bg-[var(--color-muted)] transition capitalize"
            data-testid={`add-block-${bt}`}>
            + {t[`block${bt.charAt(0).toUpperCase()}${bt.slice(1)}`] ?? bt}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────────────────── */

type View = 'list' | 'editor' | 'preview' | 'logs' | 'announce';

export default function NewsletterPage() {
  const { t } = useLanguage();
  const tn = t.newsletter;

  const [view,       setView]       = useState<View>('list');
  const [templates,  setTemplates]  = useState<TemplateEntry[]>([]);
  const [listLoading,setListLoading]= useState(true);
  const [listError,  setListError]  = useState('');

  const [editing,    setEditing]    = useState<TemplateEntry | null>(null);
  const [form,       setForm]       = useState<TemplatePayload>(emptyPayload());
  const [saving,     setSaving]     = useState(false);
  const [saveMsg,    setSaveMsg]    = useState('');
  const [saveErr,    setSaveErr]    = useState('');
  const [validErr,   setValidErr]   = useState('');

  const [previewHtml,     setPreviewHtml]     = useState('');
  const [previewLoading,  setPreviewLoading]  = useState(false);
  const [previewErr,      setPreviewErr]      = useState('');

  const [sendingId,  setSendingId]  = useState<number | null>(null);
  const [sendGroups, setSendGroups] = useState<Set<RecipientGroup>>(new Set(['customers']));
  const [sendResult, setSendResult] = useState<SendTemplateResult | null>(null);
  const [sendErr,    setSendErr]    = useState('');

  const [logs,       setLogs]       = useState<EmailLogEntry[]>([]);

  // In-app announcement state (separate from newsletter email)
  const [announceTitle,   setAnnounceTitle]   = useState('');
  const [announceMsg,     setAnnounceMsg]     = useState('');
  const [announceRoles,   setAnnounceRoles]   = useState<Set<AnnounceRole>>(new Set(['workers']));
  const [announcing,      setAnnouncing]      = useState(false);
  const [announceResult,  setAnnounceResult]  = useState('');
  const [announceErr,     setAnnounceErr]     = useState('');
  const [logsLoading,setLogsLoading]= useState(false);
  const [logsError,  setLogsError]  = useState('');

  const imgT = {
    uploadImage:    tn.uploadImage,
    uploadImageBtn: tn.uploadImageBtn,
    uploading:      tn.uploading,
    uploadFailed:   tn.uploadFailed,
    pasteImageUrl:  tn.pasteImageUrl,
    invalidImageUrl:tn.invalidImageUrl,
    imagePreview:   tn.imagePreview,
  };

  const loadTemplates = useCallback(async () => {
    setListLoading(true); setListError('');
    try { setTemplates(await listTemplates()); }
    catch (err) { setListError(err instanceof Error ? err.message : tn.failedToLoadTemplates); }
    finally { setListLoading(false); }
  }, [tn.failedToLoadTemplates]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  function openCreate() {
    setEditing(null); setForm(emptyPayload());
    setSaveMsg(''); setSaveErr(''); setValidErr('');
    setView('editor');
  }

  function openEdit(tpl: TemplateEntry) {
    setEditing(tpl);
    setForm({
      title:       tpl.title,
      subject:     tpl.subject,
      preheader:   tpl.preheader    ?? '',
      heroImageUrl:tpl.heroImageUrl ?? '',
      blocks:      tpl.blocks,
      bodyText:    tpl.bodyText     ?? '',
      ctaText:     tpl.ctaText      ?? '',
      ctaUrl:      tpl.ctaUrl       ?? '',
      footerText:  tpl.footerText   ?? '',
      status:      tpl.status,
    });
    setSaveMsg(''); setSaveErr(''); setValidErr('');
    setView('editor');
  }

  async function openPreview(tpl: TemplateEntry) {
    setPreviewHtml(''); setPreviewErr(''); setPreviewLoading(true);
    setView('preview');
    try { setPreviewHtml((await previewTemplate(tpl.NewsletterTemplateId)).html); }
    catch (err) { setPreviewErr(err instanceof Error ? err.message : tn.failedToPreview); }
    finally { setPreviewLoading(false); }
  }

  async function handleSave() {
    setSaveMsg(''); setSaveErr(''); setValidErr('');
    if (!form.title.trim())   { setValidErr(tn.errTitleRequired);   return; }
    if (!form.subject.trim()) { setValidErr(tn.errSubjectRequired); return; }
    setSaving(true);
    try {
      const payload: TemplatePayload = {
        ...form,
        preheader:    form.preheader    || null,
        heroImageUrl: form.heroImageUrl || null,
        bodyText:     form.bodyText     || null,
        ctaText:      form.ctaText      || null,
        ctaUrl:       form.ctaUrl       || null,
        footerText:   form.footerText   || null,
      };
      if (editing) {
        await updateTemplate(editing.NewsletterTemplateId, payload);
        setSaveMsg(tn.templateSaved);
      } else {
        await createTemplate(payload);
        setSaveMsg(tn.templateCreated);
        setEditing(null); setForm(emptyPayload());
      }
      await loadTemplates();
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : tn.failedToSaveTemplate);
    } finally { setSaving(false); }
  }

  async function handleArchive(id: number) {
    if (!confirm(tn.confirmDelete)) return;
    try { await archiveTemplate(id); await loadTemplates(); }
    catch (err) { setListError(err instanceof Error ? err.message : tn.failedToSaveTemplate); }
  }

  function openSend(tpl: TemplateEntry) {
    setSendingId(tpl.NewsletterTemplateId);
    setSendGroups(new Set(['customers']));
    setSendResult(null); setSendErr('');
  }

  async function handleSend() {
    if (!sendingId) return;
    if (sendGroups.size === 0) { setSendErr(tn.errGroupRequired); return; }
    setSendErr('');
    try { setSendResult(await sendTemplate(sendingId, Array.from(sendGroups))); }
    catch (err) { setSendErr(err instanceof Error ? err.message : tn.failedToSend); }
  }

  async function handleAnnounce() {
    if (!announceTitle.trim()) { setAnnounceErr(tn.errTitleRequired); return; }
    if (announceRoles.size === 0) { setAnnounceErr('Select at least one recipient group.'); return; }
    setAnnouncing(true); setAnnounceResult(''); setAnnounceErr('');
    try {
      const r = await publishAnnouncement(announceTitle.trim(), announceMsg.trim() || null, Array.from(announceRoles));
      setAnnounceResult(`${tn.announceSent} ${r.notificationsCreated} user(s).`);
      setAnnounceTitle(''); setAnnounceMsg('');
    } catch (err) {
      setAnnounceErr(err instanceof Error ? err.message : tn.announcementFailed);
    } finally {
      setAnnouncing(false);
    }
  }

  async function loadLogs() {
    setLogsLoading(true); setLogsError('');
    setView('logs');
    try { setLogs(await getEmailLogs()); }
    catch (err) { setLogsError(err instanceof Error ? err.message : tn.failedToLoadLogs); }
    finally { setLogsLoading(false); }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">{tn.templates}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{tn.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setView('list'); loadTemplates(); }}
            className={`px-3 py-1.5 text-sm rounded-lg border transition ${view === 'list' ? 'bg-[var(--color-primary)] text-white border-transparent' : 'border-[var(--color-border)] hover:bg-[var(--color-muted)]'}`}>
            {tn.templates}
          </button>
          <button onClick={loadLogs} disabled={logsLoading}
            className={`px-3 py-1.5 text-sm rounded-lg border transition ${view === 'logs' ? 'bg-[var(--color-primary)] text-white border-transparent' : 'border-[var(--color-border)] hover:bg-[var(--color-muted)]'}`}
            data-testid="logs-tab-btn">
            {logsLoading ? t.common.loading : tn.emailLogs}
          </button>
          {/* In-app announcement — email is NOT sent, only app notification */}
          <button onClick={() => { setAnnounceResult(''); setAnnounceErr(''); setView('announce'); }}
            className={`px-3 py-1.5 text-sm rounded-lg border transition ${view === 'announce' ? 'bg-amber-500 text-white border-transparent' : 'border-[var(--color-border)] hover:bg-amber-50 text-amber-600'}`}
            data-testid="announce-tab-btn">
            📢 {tn.announceTitle}
          </button>
          <button onClick={openCreate}
            className="px-3 py-1.5 text-sm rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 transition"
            data-testid="new-template-btn">
            + {tn.newTemplate}
          </button>
        </div>
      </div>

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <section>
          {listLoading && <p className="text-sm text-[var(--color-muted-foreground)]">{t.common.loading}</p>}
          {listError   && <p className="text-sm text-[var(--color-error)]" data-testid="list-error">{listError}</p>}
          {!listLoading && !listError && templates.length === 0 && (
            <div className="rounded-lg border border-[var(--color-border)] p-8 text-center">
              <p className="font-medium">{tn.noTemplates}</p>
              <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{tn.noTemplatesDesc}</p>
            </div>
          )}
          {templates.length > 0 && (
            <div className="space-y-3" data-testid="template-list">
              {templates.map((tpl) => (
                <div key={tpl.NewsletterTemplateId}
                  className="rounded-lg border border-[var(--color-border)] bg-white p-4 flex items-start justify-between gap-4"
                  data-testid={`template-row-${tpl.NewsletterTemplateId}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{tpl.title}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLOR[tpl.status] ?? ''}`}>
                        {tn[`status${tpl.status.charAt(0).toUpperCase()}${tpl.status.slice(1)}` as keyof typeof tn] ?? tpl.status}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-muted-foreground)] mt-0.5 truncate">{tpl.subject}</p>
                    <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">{formatUtc(tpl.updatedAtUtc)}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => openPreview(tpl)}
                      className="px-2.5 py-1 text-xs rounded border border-[var(--color-border)] hover:bg-[var(--color-muted)] transition"
                      data-testid={`preview-btn-${tpl.NewsletterTemplateId}`}>
                      {tn.previewTemplate}
                    </button>
                    <button onClick={() => openEdit(tpl)}
                      className="px-2.5 py-1 text-xs rounded border border-[var(--color-border)] hover:bg-[var(--color-muted)] transition"
                      data-testid={`edit-btn-${tpl.NewsletterTemplateId}`}>
                      {tn.editTemplate}
                    </button>
                    <button onClick={() => openSend(tpl)}
                      className="px-2.5 py-1 text-xs rounded bg-[var(--color-primary)] text-white hover:opacity-90 transition"
                      data-testid={`send-btn-${tpl.NewsletterTemplateId}`}>
                      {tn.sendTemplate}
                    </button>
                    <button onClick={() => handleArchive(tpl.NewsletterTemplateId)}
                      className="px-2.5 py-1 text-xs rounded border border-red-200 text-red-500 hover:bg-red-50 transition"
                      data-testid={`archive-btn-${tpl.NewsletterTemplateId}`}>
                      {tn.deleteTemplate}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Send modal */}
          {sendingId !== null && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="send-modal">
              <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                <h2 className="text-lg font-semibold mb-4">{tn.sendTemplate}</h2>
                <p className="text-sm text-[var(--color-muted-foreground)] mb-3">{tn.recipientGroups}</p>
                <div className="flex flex-col gap-2 mb-4">
                  {(['customers', 'workers', 'all'] as RecipientGroup[]).map((g) => (
                    <label key={g} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={sendGroups.has(g)}
                        onChange={() => setSendGroups(prev => {
                          const next = new Set(prev);
                          next.has(g) ? next.delete(g) : next.add(g);
                          return next;
                        })}
                        data-testid={`send-group-${g}`} />
                      <span className="text-sm">
                        {g === 'customers' ? tn.groupCustomers : g === 'workers' ? tn.groupWorkers : tn.groupAll}
                      </span>
                    </label>
                  ))}
                </div>
                {sendErr && <p className="text-sm text-[var(--color-error)] mb-3" data-testid="send-modal-error">{sendErr}</p>}
                {sendResult && (
                  <div className="rounded-md bg-[var(--color-secondary-light)] px-3 py-2 mb-3 text-sm" data-testid="send-result">
                    <p className="font-medium text-[var(--color-primary)]">
                      {sendResult.queued ? tn.sendTemplate : tn.sentSuccessfully}
                    </p>
                    {sendResult.queued ? (
                      /* Queued: show totalRecipients as the meaningful number */
                      <p className="mt-0.5">{sendResult.message}</p>
                    ) : (
                      /* Synchronous (legacy) path: show individual counts */
                      <p className="mt-0.5">{tn.sent}: {sendResult.sentCount} · {tn.failed}: {sendResult.failedCount} · {tn.skipped}: {sendResult.skippedCount}</p>
                    )}
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setSendingId(null); setSendResult(null); setSendErr(''); }}
                    className="px-4 py-2 text-sm rounded border border-[var(--color-border)] hover:bg-[var(--color-muted)]">
                    {t.common.close}
                  </button>
                  <button onClick={handleSend} disabled={!!sendResult}
                    className="px-4 py-2 text-sm rounded bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50"
                    data-testid="send-modal-submit">
                    {tn.sendTemplate}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── EDITOR VIEW ── */}
      {view === 'editor' && (
        <section data-testid="template-editor">
          <div className="mb-4 flex items-center gap-3">
            <button onClick={() => setView('list')}
              className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
              ← {tn.templates}
            </button>
            <h2 className="text-xl font-semibold">{editing ? tn.editTemplate : tn.newTemplate}</h2>
          </div>

          {validErr && <p className="text-sm text-[var(--color-error)] mb-3" data-testid="editor-validation-error">{validErr}</p>}
          {saveErr  && <p className="text-sm text-[var(--color-error)] mb-3" data-testid="editor-save-error">{saveErr}</p>}
          {saveMsg  && <p className="text-sm text-green-600 mb-3" data-testid="editor-save-success">{saveMsg}</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: meta fields */}
            <div className="space-y-4 rounded-lg border border-[var(--color-border)] bg-white p-5">
              <div>
                <label className="mb-1 block text-sm font-medium">{tn.templateTitle} *</label>
                <input type="text" value={form.title} maxLength={200}
                  onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder={tn.templateTitlePlaceholder}
                  className="w-full rounded border border-[var(--color-border)] px-3 py-2 text-sm"
                  data-testid="field-title" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{tn.subject} *</label>
                <input type="text" value={form.subject} maxLength={500}
                  onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder={tn.subjectPlaceholder}
                  className="w-full rounded border border-[var(--color-border)] px-3 py-2 text-sm"
                  data-testid="field-subject" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{tn.preheader}</label>
                <input type="text" value={form.preheader ?? ''} maxLength={300}
                  onChange={(e) => setForm(f => ({ ...f, preheader: e.target.value }))}
                  placeholder={tn.preheaderPlaceholder}
                  className="w-full rounded border border-[var(--color-border)] px-3 py-2 text-sm" />
              </div>

              {/* Hero image — dual-mode */}
              <div>
                <label className="mb-1 block text-sm font-medium">{tn.heroImageUrl}</label>
                <ImageInputField
                  value={form.heroImageUrl ?? ''}
                  onChange={(url) => setForm(f => ({ ...f, heroImageUrl: url }))}
                  placeholder={tn.heroImageUrlPlaceholder}
                  testIdPrefix="hero"
                  t={imgT}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">{tn.ctaText}</label>
                  <input type="text" value={form.ctaText ?? ''} maxLength={200}
                    onChange={(e) => setForm(f => ({ ...f, ctaText: e.target.value }))}
                    placeholder={tn.ctaTextPlaceholder}
                    className="w-full rounded border border-[var(--color-border)] px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">{tn.ctaUrl}</label>
                  <input type="text" value={form.ctaUrl ?? ''} maxLength={500}
                    onChange={(e) => setForm(f => ({ ...f, ctaUrl: e.target.value }))}
                    placeholder="https://"
                    className="w-full rounded border border-[var(--color-border)] px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{tn.footerText}</label>
                <input type="text" value={form.footerText ?? ''} maxLength={500}
                  onChange={(e) => setForm(f => ({ ...f, footerText: e.target.value }))}
                  placeholder={tn.footerTextPlaceholder}
                  className="w-full rounded border border-[var(--color-border)] px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t.common.status ?? 'Status'}</label>
                <select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value as TemplateStatus }))}
                  className="w-full rounded border border-[var(--color-border)] px-3 py-2 text-sm">
                  <option value="draft">{tn.statusDraft}</option>
                  <option value="ready">{tn.statusReady}</option>
                  <option value="archived">{tn.statusArchived}</option>
                </select>
              </div>
            </div>

            {/* Right: block editor */}
            <div className="rounded-lg border border-[var(--color-border)] bg-white p-5">
              <p className="mb-3 text-sm font-medium">{tn.contentBlocks}</p>
              <BlockEditor blocks={form.blocks} onChange={(blocks) => setForm(f => ({ ...f, blocks }))} t={tn as unknown as Record<string, string>} />
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button onClick={handleSave} disabled={saving}
              className="rounded-md bg-[var(--color-primary)] px-5 py-2 text-white hover:opacity-90 disabled:opacity-60 transition"
              data-testid="save-template-btn">
              {saving ? tn.savingTemplate : tn.saveTemplate}
            </button>
            <button onClick={() => setView('list')}
              className="rounded-md border border-[var(--color-border)] px-5 py-2 text-sm hover:bg-[var(--color-muted)] transition">
              {t.common.cancel}
            </button>
          </div>
        </section>
      )}

      {/* ── PREVIEW VIEW ── */}
      {view === 'preview' && (
        <section data-testid="template-preview">
          <div className="mb-4 flex items-center gap-3">
            <button onClick={() => setView('list')} className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
              ← {tn.templates}
            </button>
            <h2 className="text-xl font-semibold">{tn.previewTemplate}</h2>
          </div>
          {previewLoading && <p className="text-sm text-[var(--color-muted-foreground)]">{t.common.loading}</p>}
          {previewErr    && <p className="text-sm text-[var(--color-error)]" data-testid="preview-error">{previewErr}</p>}
          {!previewLoading && previewHtml && (
            <div className="rounded-lg border border-[var(--color-border)] overflow-hidden" data-testid="preview-iframe-wrapper">
              <iframe srcDoc={previewHtml} title="Newsletter preview"
                className="w-full min-h-[600px] border-0" sandbox="allow-same-origin" />
            </div>
          )}
        </section>
      )}

      {/* ── EMAIL LOGS VIEW ── */}
      {view === 'logs' && (
        <section data-testid="logs-section">
          <div className="mb-4 flex items-center gap-3">
            <button onClick={() => setView('list')} className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
              ← {tn.templates}
            </button>
            <h2 className="text-xl font-semibold">{tn.emailLogs}</h2>
          </div>
          {logsError && <p className="text-sm text-[var(--color-error)]" data-testid="logs-error">{logsError}</p>}
          {logs.length === 0 && !logsLoading && <p className="text-sm text-[var(--color-muted-foreground)]">{t.common.noData}</p>}
          {logs.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
              <table className="w-full text-sm" data-testid="logs-table">
                <thead className="bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">{tn.colRecipient}</th>
                    <th className="px-3 py-2 text-left font-medium">{tn.colType}</th>
                    <th className="px-3 py-2 text-left font-medium">{tn.colSubject}</th>
                    <th className="px-3 py-2 text-left font-medium">{tn.colStatus}</th>
                    <th className="px-3 py-2 text-left font-medium">{tn.colSentAt}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.EmailLogId} className="border-t border-[var(--color-border)] hover:bg-[var(--color-muted)]/40">
                      <td className="px-3 py-2">
                        <span className="block font-medium truncate max-w-[160px]">{log.RecipientEmail}</span>
                        <span className="block text-xs text-[var(--color-muted-foreground)]">{log.RecipientType}</span>
                      </td>
                      <td className="px-3 py-2 capitalize">{log.EmailType.replace('_', ' ')}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate" title={log.Subject}>{log.Subject}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${LOG_STATUS_COLOR[log.Status] ?? ''}`}>
                          {log.Status}
                        </span>
                        {log.ErrorMessage && (
                          <span className="block text-xs text-[var(--color-error)] mt-0.5 truncate max-w-[200px]" title={log.ErrorMessage}>{log.ErrorMessage}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--color-muted-foreground)]">{formatUtc(log.SentAtUtc ?? log.CreatedAtUtc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── ANNOUNCE VIEW — in-app only, no email ── */}
      {view === 'announce' && (
        <section data-testid="announce-section">
          <div className="mb-4 flex items-center gap-3">
            <button onClick={() => setView('list')} className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
              ← {tn.templates}
            </button>
            <h2 className="text-xl font-semibold text-amber-600">{tn.announceTitle}</h2>
          </div>
          <p className="text-sm text-[var(--color-muted-foreground)] mb-4">{tn.announceSubtitle}</p>

          <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-5 space-y-4 max-w-lg">
            <div>
              <label className="mb-1 block text-sm font-medium">{t.newsletter.templateTitle} *</label>
              <input type="text" value={announceTitle} maxLength={200}
                onChange={(e) => setAnnounceTitle(e.target.value)}
                placeholder="e.g. System maintenance tonight at 22:00"
                className="w-full rounded border border-[var(--color-border)] px-3 py-2 text-sm"
                data-testid="announce-title" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.newsletter.message}</label>
              <textarea rows={3} value={announceMsg}
                onChange={(e) => setAnnounceMsg(e.target.value)}
                placeholder="Optional additional details..."
                className="w-full rounded border border-[var(--color-border)] px-3 py-2 text-sm"
                data-testid="announce-message" />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">{t.newsletter.recipientGroups}</p>
              <div className="flex flex-wrap gap-3">
                {(['workers', 'visitors', 'all'] as AnnounceRole[]).map((r) => (
                  <label key={r} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={announceRoles.has(r)}
                      onChange={() => setAnnounceRoles(prev => {
                        const next = new Set(prev);
                        next.has(r) ? next.delete(r) : next.add(r);
                        return next;
                      })}
                      data-testid={`announce-role-${r}`} />
                    <span className="text-sm">
                      {r === 'workers' ? tn.announceToWorkers
                        : r === 'visitors' ? tn.announceToVisitors
                        : tn.announceToAll}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {announceErr    && <p className="text-sm text-[var(--color-error)]" data-testid="announce-error">{announceErr}</p>}
            {announceResult && <p className="text-sm text-green-700" data-testid="announce-result">{announceResult}</p>}

            <button onClick={handleAnnounce} disabled={announcing}
              className="rounded-md bg-amber-500 px-5 py-2 text-white hover:bg-amber-600 disabled:opacity-60 transition"
              data-testid="announce-submit">
              {announcing ? tn.publishing : tn.publishAnnouncement}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
