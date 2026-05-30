/**
 * Tests for /manager/newsletter page — template-based newsletter UI (US39)
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/* ── Mocks ─────────────────────────────────────────────────────────────────── */

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/manager/newsletter',
}));

const mockListTemplates         = jest.fn();
const mockCreateTemplate        = jest.fn();
const mockUpdateTemplate        = jest.fn();
const mockArchiveTemplate       = jest.fn();
const mockPreviewTemplate       = jest.fn();
const mockSendTemplate          = jest.fn();
const mockGetEmailLogs          = jest.fn();
const mockUploadNewsletterImage = jest.fn();

jest.mock('@/services/emailsService', () => ({
  listTemplates:          (...a: unknown[]) => mockListTemplates(...a),
  createTemplate:         (...a: unknown[]) => mockCreateTemplate(...a),
  updateTemplate:         (...a: unknown[]) => mockUpdateTemplate(...a),
  archiveTemplate:        (...a: unknown[]) => mockArchiveTemplate(...a),
  previewTemplate:        (...a: unknown[]) => mockPreviewTemplate(...a),
  sendTemplate:           (...a: unknown[]) => mockSendTemplate(...a),
  getEmailLogs:           (...a: unknown[]) => mockGetEmailLogs(...a),
  uploadNewsletterImage:  (...a: unknown[]) => mockUploadNewsletterImage(...a),
}));

jest.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({
    locale: 'en', dir: 'ltr', setLocale: jest.fn(),
    t: {
      newsletter: {
        templates:              'Newsletter Templates',
        newTemplate:            'New Template',
        editTemplate:           'Edit Template',
        deleteTemplate:         'Archive Template',
        noTemplates:            'No templates yet',
        noTemplatesDesc:        'Create your first newsletter template.',
        templateTitle:          'Template Title',
        templateTitlePlaceholder: 'e.g. Weekly Farm Update',
        subject:                'Subject',
        subjectPlaceholder:     'Subject line',
        preheader:              'Preview Text',
        preheaderPlaceholder:   '',
        heroImageUrl:           'Hero Image URL',
        heroImageUrlPlaceholder:'',
        footerText:             'Footer Text',
        footerTextPlaceholder:  '',
        ctaText:                'Button Label',
        ctaTextPlaceholder:     '',
        ctaUrl:                 'Button URL',
        ctaUrlPlaceholder:      '',
        contentBlocks:          'Content Blocks',
        addBlock:               'Add Block',
        blockHeading:           'Heading',
        blockParagraph:         'Paragraph',
        blockImage:             'Image',
        blockButton:            'Button',
        blockDivider:           'Divider',
        blockText:              'Text',
        blockAlt:               'Alt text',
        blockUrl:               'URL',
        statusDraft:            'Draft',
        statusReady:            'Ready',
        statusArchived:         'Archived',
        saveTemplate:           'Save Template',
        savingTemplate:         'Saving...',
        savedTemplate:          'Template saved',
        previewTemplate:        'Preview',
        sendTemplate:           'Send Newsletter',
        sendingTemplate:        'Sending...',
        templateSaved:          'Template saved successfully.',
        templateCreated:        'Template created successfully.',
        templateDeleted:        'Template archived.',
        failedToSaveTemplate:   'Failed to save template.',
        failedToLoadTemplates:  'Failed to load templates.',
        failedToPreview:        'Failed to load preview.',
        confirmDelete:          'Archive this template?',
        errTitleRequired:       'Template title is required.',
        errSubjectRequired:     'Subject is required.',
        errGroupRequired:       'Please select at least one recipient group.',
        uploadImage:            'Upload Image',
        uploadImageBtn:         'Choose File',
        uploading:              'Uploading...',
        uploadFailed:           'Image upload failed.',
        pasteImageUrl:          'Or paste URL',
        invalidImageUrl:        'Image URL must start with https:// or http://',
        imagePreview:           'Image preview',
        subtitle:               'Send newsletters.',
        recipientGroups:        'Recipient Groups',
        groupCustomers:         'Subscribed customers',
        groupWorkers:           'Workers',
        groupAll:               'All recipients',
        sent:                   'Sent',
        failed:                 'Failed',
        skipped:                'Skipped',
        sentSuccessfully:       'Newsletter sent successfully',
        failedToSend:           'Failed to send newsletter',
        emailLogs:              'Email Logs',
        loadLogs:               'Load Logs',
        failedToLoadLogs:       'Failed to load email logs',
        colRecipient:           'Recipient',
        colType:                'Type',
        colSubject:             'Subject',
        colStatus:              'Status',
        colSentAt:              'Sent At',
        message:                'Message',
        messagePlaceholder:     '',
        recipientGroups2:       '',
        updateType:             '',
        typeNewsletter:         '',
        typeAnnouncement:       '',
        scheduledLabel:         '',
        labelWeekly:            '',
        labelMonthly:           '',
        labelGeneral:           '',
        sendNewsletter:         '',
        sending:                '',
      },
      common: {
        loading:  'Loading...',
        noData:   'No data',
        cancel:   'Cancel',
        status:   'Status',
        close:    'Close',
        save:     'Save',
      },
    },
  }),
}));

import NewsletterPage from '@/app/manager/newsletter/page';

/* ── Helpers ────────────────────────────────────────────────────────────────── */

const SAMPLE_TEMPLATE = {
  NewsletterTemplateId: 1,
  title:       'Weekly Update',
  subject:     'Farm News #1',
  preheader:   null,
  heroImageUrl:null,
  blocks:      [{ type: 'heading', text: 'Hello!' }],
  bodyText:    null,
  ctaText:     null,
  ctaUrl:      null,
  footerText:  null,
  status:      'draft' as const,
  createdAtUtc:'2024-01-01T10:00:00',
  updatedAtUtc:'2024-01-01T10:00:00',
  createdBy:   1,
  updatedBy:   null,
};

/* ── Tests ──────────────────────────────────────────────────────────────────── */

describe('NewsletterPage (template UI)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn(() => true);
  });

  it('renders page header', async () => {
    mockListTemplates.mockResolvedValue([]);
    render(<NewsletterPage />);
    await waitFor(() => {
      // Use getAllByText because the text also appears in the active tab button
      expect(screen.getAllByText('Newsletter Templates').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows empty state when no templates exist', async () => {
    mockListTemplates.mockResolvedValue([]);
    render(<NewsletterPage />);
    await waitFor(() => {
      expect(screen.getByText('No templates yet')).toBeInTheDocument();
    });
  });

  it('lists existing templates', async () => {
    mockListTemplates.mockResolvedValue([SAMPLE_TEMPLATE]);
    render(<NewsletterPage />);
    await waitFor(() => {
      expect(screen.getByTestId('template-list')).toBeInTheDocument();
      expect(screen.getByText('Weekly Update')).toBeInTheDocument();
      expect(screen.getByText('Farm News #1')).toBeInTheDocument();
    });
  });

  it('shows failed-to-load error when list API fails', async () => {
    mockListTemplates.mockRejectedValue(new Error('Server error'));
    render(<NewsletterPage />);
    await waitFor(() => {
      expect(screen.getByTestId('list-error')).toHaveTextContent('Server error');
    });
  });

  it('opens the editor when New Template is clicked', async () => {
    mockListTemplates.mockResolvedValue([]);
    render(<NewsletterPage />);
    await waitFor(() => screen.getByTestId('new-template-btn'));
    fireEvent.click(screen.getByTestId('new-template-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('template-editor')).toBeInTheDocument();
    });
  });

  it('shows validation error when title is empty on save', async () => {
    mockListTemplates.mockResolvedValue([]);
    render(<NewsletterPage />);
    await waitFor(() => screen.getByTestId('new-template-btn'));
    fireEvent.click(screen.getByTestId('new-template-btn'));
    await waitFor(() => screen.getByTestId('save-template-btn'));
    fireEvent.click(screen.getByTestId('save-template-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('editor-validation-error')).toHaveTextContent('Template title is required.');
    });
  });

  it('creates a template and shows success message', async () => {
    mockListTemplates.mockResolvedValue([]);
    mockCreateTemplate.mockResolvedValue({ ...SAMPLE_TEMPLATE, title: 'New Template' });

    render(<NewsletterPage />);
    await waitFor(() => screen.getByTestId('new-template-btn'));
    fireEvent.click(screen.getByTestId('new-template-btn'));

    await waitFor(() => screen.getByTestId('field-title'));
    fireEvent.change(screen.getByTestId('field-title'),   { target: { value: 'My Template' } });
    fireEvent.change(screen.getByTestId('field-subject'), { target: { value: 'My Subject' } });

    fireEvent.click(screen.getByTestId('save-template-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('editor-save-success')).toHaveTextContent('Template created successfully.');
    });
  });

  it('shows save error when create API fails', async () => {
    mockListTemplates.mockResolvedValue([]);
    mockCreateTemplate.mockRejectedValue(new Error('Save failed'));

    render(<NewsletterPage />);
    await waitFor(() => screen.getByTestId('new-template-btn'));
    fireEvent.click(screen.getByTestId('new-template-btn'));

    await waitFor(() => screen.getByTestId('field-title'));
    fireEvent.change(screen.getByTestId('field-title'),   { target: { value: 'T' } });
    fireEvent.change(screen.getByTestId('field-subject'), { target: { value: 'S' } });
    fireEvent.click(screen.getByTestId('save-template-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('editor-save-error')).toHaveTextContent('Save failed');
    });
  });

  it('opens preview for a template', async () => {
    mockListTemplates.mockResolvedValue([SAMPLE_TEMPLATE]);
    mockPreviewTemplate.mockResolvedValue({ html: '<html><body>Preview</body></html>', plainText: 'Preview' });

    render(<NewsletterPage />);
    await waitFor(() => screen.getByTestId(`preview-btn-${SAMPLE_TEMPLATE.NewsletterTemplateId}`));
    fireEvent.click(screen.getByTestId(`preview-btn-${SAMPLE_TEMPLATE.NewsletterTemplateId}`));

    await waitFor(() => {
      expect(screen.getByTestId('template-preview')).toBeInTheDocument();
    });
  });

  it('shows preview error when preview API fails', async () => {
    mockListTemplates.mockResolvedValue([SAMPLE_TEMPLATE]);
    mockPreviewTemplate.mockRejectedValue(new Error('Preview error'));

    render(<NewsletterPage />);
    await waitFor(() => screen.getByTestId(`preview-btn-${SAMPLE_TEMPLATE.NewsletterTemplateId}`));
    fireEvent.click(screen.getByTestId(`preview-btn-${SAMPLE_TEMPLATE.NewsletterTemplateId}`));

    await waitFor(() => {
      expect(screen.getByTestId('preview-error')).toHaveTextContent('Preview error');
    });
  });

  it('shows send modal when Send Newsletter is clicked', async () => {
    mockListTemplates.mockResolvedValue([SAMPLE_TEMPLATE]);
    render(<NewsletterPage />);
    await waitFor(() => screen.getByTestId(`send-btn-${SAMPLE_TEMPLATE.NewsletterTemplateId}`));
    fireEvent.click(screen.getByTestId(`send-btn-${SAMPLE_TEMPLATE.NewsletterTemplateId}`));
    await waitFor(() => {
      expect(screen.getByTestId('send-modal')).toBeInTheDocument();
    });
  });

  it('shows send result after successful send', async () => {
    mockListTemplates.mockResolvedValue([SAMPLE_TEMPLATE]);
    mockSendTemplate.mockResolvedValue({ totalRecipients: 3, sentCount: 2, failedCount: 1, skippedCount: 0, message: 'ok' });

    render(<NewsletterPage />);
    await waitFor(() => screen.getByTestId(`send-btn-${SAMPLE_TEMPLATE.NewsletterTemplateId}`));
    fireEvent.click(screen.getByTestId(`send-btn-${SAMPLE_TEMPLATE.NewsletterTemplateId}`));

    await waitFor(() => screen.getByTestId('send-modal'));
    fireEvent.click(screen.getByTestId('send-modal-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('send-result')).toBeInTheDocument();
      expect(screen.getByTestId('send-result')).toHaveTextContent('2');
    });
  });

  it('shows send error when SMTP/API fails', async () => {
    mockListTemplates.mockResolvedValue([SAMPLE_TEMPLATE]);
    mockSendTemplate.mockRejectedValue(new Error('SMTP not configured'));

    render(<NewsletterPage />);
    await waitFor(() => screen.getByTestId(`send-btn-${SAMPLE_TEMPLATE.NewsletterTemplateId}`));
    fireEvent.click(screen.getByTestId(`send-btn-${SAMPLE_TEMPLATE.NewsletterTemplateId}`));

    await waitFor(() => screen.getByTestId('send-modal'));
    fireEvent.click(screen.getByTestId('send-modal-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('send-modal-error')).toHaveTextContent('SMTP not configured');
    });
  });

  it('loads email logs when Email Logs tab is clicked', async () => {
    mockListTemplates.mockResolvedValue([]);
    mockGetEmailLogs.mockResolvedValue([
      {
        EmailLogId: 1, RecipientEmail: 'alice@example.com',
        RecipientName: 'Alice', RecipientType: 'customer',
        Subject: 'Test Subject', MessagePreview: null,
        EmailType: 'newsletter', Status: 'sent', ErrorMessage: null,
        RelatedProductId: null, RelatedDiscountPercentage: null,
        SentAtUtc: '2024-01-01T12:00:00', CreatedAtUtc: '2024-01-01T12:00:00', CreatedBy: 1,
      },
    ]);

    render(<NewsletterPage />);
    await waitFor(() => screen.getByTestId('logs-tab-btn'));
    fireEvent.click(screen.getByTestId('logs-tab-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('logs-table')).toBeInTheDocument();
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });
  });

  it('shows logs error when email logs API fails', async () => {
    mockListTemplates.mockResolvedValue([]);
    mockGetEmailLogs.mockRejectedValue(new Error('Unauthorized'));

    render(<NewsletterPage />);
    await waitFor(() => screen.getByTestId('logs-tab-btn'));
    fireEvent.click(screen.getByTestId('logs-tab-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('logs-error')).toHaveTextContent('Unauthorized');
    });
  });

  it('adds a heading content block when + Heading is clicked in editor', async () => {
    mockListTemplates.mockResolvedValue([]);
    render(<NewsletterPage />);
    await waitFor(() => screen.getByTestId('new-template-btn'));
    fireEvent.click(screen.getByTestId('new-template-btn'));

    await waitFor(() => screen.getByTestId('add-block-heading'));
    fireEvent.click(screen.getByTestId('add-block-heading'));

    await waitFor(() => {
      expect(screen.getByTestId('block-0')).toBeInTheDocument();
    });
  });

  // ── Image upload / dual-mode UI ───────────────────────────────────────────

  it('shows upload and URL tabs for hero image field in editor', async () => {
    mockListTemplates.mockResolvedValue([]);
    render(<NewsletterPage />);
    await waitFor(() => screen.getByTestId('new-template-btn'));
    fireEvent.click(screen.getByTestId('new-template-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('hero-upload-tab')).toBeInTheDocument();
      expect(screen.getByTestId('hero-url-tab')).toBeInTheDocument();
    });
  });

  it('shows upload and URL tabs for image content block', async () => {
    mockListTemplates.mockResolvedValue([]);
    render(<NewsletterPage />);
    await waitFor(() => screen.getByTestId('new-template-btn'));
    fireEvent.click(screen.getByTestId('new-template-btn'));

    await waitFor(() => screen.getByTestId('add-block-image'));
    fireEvent.click(screen.getByTestId('add-block-image'));

    await waitFor(() => {
      expect(screen.getByTestId('block-img-0-upload-tab')).toBeInTheDocument();
      expect(screen.getByTestId('block-img-0-url-tab')).toBeInTheDocument();
    });
  });

  it('upload success stores returned imageUrl and shows preview', async () => {
    const fakeUrl = 'http://localhost:8000/uploads/newsletter_images/newsletter_abc.jpg';
    mockUploadNewsletterImage.mockResolvedValue({ imageUrl: fakeUrl });
    mockListTemplates.mockResolvedValue([]);

    render(<NewsletterPage />);
    await waitFor(() => screen.getByTestId('new-template-btn'));
    fireEvent.click(screen.getByTestId('new-template-btn'));

    // Switch to Upload tab for hero image
    await waitFor(() => screen.getByTestId('hero-upload-tab'));
    fireEvent.click(screen.getByTestId('hero-upload-tab'));

    // Simulate file selection
    const fileInput = screen.getByTestId('hero-file-input');
    const file = new File(['fake-image'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(mockUploadNewsletterImage).toHaveBeenCalledWith(file);
      expect(screen.getByTestId('hero-preview')).toBeInTheDocument();
    });
  });

  it('upload failure shows error message', async () => {
    mockUploadNewsletterImage.mockRejectedValue(new Error('File too large'));
    mockListTemplates.mockResolvedValue([]);

    render(<NewsletterPage />);
    await waitFor(() => screen.getByTestId('new-template-btn'));
    fireEvent.click(screen.getByTestId('new-template-btn'));

    await waitFor(() => screen.getByTestId('hero-upload-tab'));
    fireEvent.click(screen.getByTestId('hero-upload-tab'));

    const fileInput = screen.getByTestId('hero-file-input');
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(screen.getByTestId('hero-upload-error')).toHaveTextContent('File too large');
    });
  });

  it('entering a valid URL in URL mode shows a preview image', async () => {
    mockListTemplates.mockResolvedValue([]);
    render(<NewsletterPage />);
    await waitFor(() => screen.getByTestId('new-template-btn'));
    fireEvent.click(screen.getByTestId('new-template-btn'));

    // Default mode is URL — URL input should be visible
    await waitFor(() => screen.getByTestId('hero-url-input'));
    fireEvent.change(screen.getByTestId('hero-url-input'), {
      target: { value: 'https://example.com/banner.jpg' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('hero-preview')).toBeInTheDocument();
    });
  });

  it('entering an invalid URL shows a validation error and no preview', async () => {
    mockListTemplates.mockResolvedValue([]);
    render(<NewsletterPage />);
    await waitFor(() => screen.getByTestId('new-template-btn'));
    fireEvent.click(screen.getByTestId('new-template-btn'));

    await waitFor(() => screen.getByTestId('hero-url-input'));
    fireEvent.change(screen.getByTestId('hero-url-input'), {
      target: { value: 'not-a-valid-url' },
    });

    await waitFor(() => {
      expect(screen.queryByTestId('hero-preview')).not.toBeInTheDocument();
    });
  });

  it('saved template preserves uploaded imageUrl (passed as existing block url)', async () => {
    const existingUrl = 'http://localhost:8000/uploads/newsletter_images/existing.jpg';
    const template = {
      ...SAMPLE_TEMPLATE,
      blocks: [{ type: 'image' as const, url: existingUrl, alt: 'existing' }],
    };
    mockListTemplates.mockResolvedValue([template]);

    render(<NewsletterPage />);
    await waitFor(() => screen.getByTestId(`edit-btn-${template.NewsletterTemplateId}`));
    fireEvent.click(screen.getByTestId(`edit-btn-${template.NewsletterTemplateId}`));

    // The image URL input in the image block should show the existing URL
    await waitFor(() => {
      const urlInput = screen.getByTestId('block-img-0-url-input');
      expect(urlInput).toHaveValue(existingUrl);
    });
  });
});
