import React, { useState, useCallback } from 'react'
import PropTypes from 'prop-types'
import InstructionModal from './InstructionModal'
import { HELP_CONTENT, UPLOAD_LABELS } from '../constants/helpContent'

function UploadSection({
  uploading,
  message,
  handleFileUpload,
  handleClearData
}) {
  const [showAsbHelp, setShowAsbHelp] = useState(false)

  const handleOpenAsbHelp = useCallback(() => setShowAsbHelp(true), [])
  const handleCloseAsbHelp = useCallback(() => setShowAsbHelp(false), [])

  return (
    <section className="upload-section">
      <div className="upload-controls">
        <label className="upload-btn" aria-busy={uploading}>
          {uploading ? UPLOAD_LABELS.uploadButton.processing : UPLOAD_LABELS.uploadButton.default}
          <input
            type="file"
            accept=".csv,.pdf"
            onChange={handleFileUpload}
            disabled={uploading}
            multiple
            hidden
            aria-label="Upload bank statement files in CSV or PDF format"
          />
        </label>
        <button
          className="clear-btn"
          onClick={handleClearData}
          aria-label={UPLOAD_LABELS.clearButton}
        >
          {UPLOAD_LABELS.clearButton}
        </button>
      </div>

      <div className="upload-note-row">
        <p className="upload-note">{UPLOAD_LABELS.asbNote}</p>
        <button
          type="button"
          className="info-btn"
          onClick={handleOpenAsbHelp}
          aria-label={UPLOAD_LABELS.asbAriaLabel}
          aria-haspopup="dialog"
        >
          <span aria-hidden="true">i</span>
        </button>
      </div>

      <InstructionModal
        isOpen={showAsbHelp}
        onClose={handleCloseAsbHelp}
        title={HELP_CONTENT.asb.title}
        steps={HELP_CONTENT.asb.steps}
      />

      {message.text && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={`message ${message.type}`}
        >
          {message.text}
        </div>
      )}
    </section>
  )
}

UploadSection.propTypes = {
  uploading: PropTypes.bool.isRequired,
  message: PropTypes.shape({
    text: PropTypes.string,
    type: PropTypes.oneOf(['success', 'error', null])
  }).isRequired,
  handleFileUpload: PropTypes.func.isRequired,
  handleClearData: PropTypes.func.isRequired
}

export default React.memo(UploadSection)
