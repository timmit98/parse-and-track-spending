import type { BankConfig } from '../../types/index.js'

export const ASB_BANK_CONFIG: BankConfig = {
  id: 'asb',
  name: 'ASB Bank',
  displayName: 'ASB',
  region: 'NZ',

  detection: {
    contentPatterns: ['ASB Bank', 'asb.co.nz', 'ASB Credit Card'],
    filenamePatterns: [/asb/i, /asb[-_]statement/i]
  },

  parser: {
    type: 'pdf',
    parserFunction: 'parseASBPDF'
  },

  help: {
    hasInstructions: true,
    instructionKey: 'asb'
  }
}