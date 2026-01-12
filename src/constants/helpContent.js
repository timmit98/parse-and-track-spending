// NZ-only bank support - US banks removed in Phase 1

export const HELP_CONTENT = {
  asb: {
    title: 'How to find your ASB Bank statement',
    steps: [
      {
        text: 'Log in to ASB FastNet Classic or ASB Mobile',
        image: null,
        altText: null
      },
      {
        text: 'Navigate to your account and select <strong>Statements</strong> or <strong>Documents</strong>',
        image: null,
        altText: null
      },
      {
        text: 'Choose the statement period you want to download',
        image: null,
        altText: null
      },
      {
        text: 'Download as PDF and save to your device',
        image: null,
        altText: null
      },
      {
        text: 'Use the upload button above to select and upload your PDF statement',
        image: null,
        altText: null
      }
    ]
  }
}

export const UPLOAD_LABELS = {
  uploadButton: {
    default: 'Upload Files (CSV/PDF)',
    processing: 'Processing...'
  },
  clearButton: 'Clear All Data',
  asbNote: 'PDF support: ASB Bank (New Zealand)',
  asbAriaLabel: 'How to find and download your ASB Bank statement'
}
