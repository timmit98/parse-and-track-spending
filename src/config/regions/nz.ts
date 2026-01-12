import type { RegionConfig } from '../../types/index.js'

export const NZ_REGION_CONFIG: RegionConfig = {
  code: 'NZ',
  name: 'New Zealand',
  currency: {
    code: 'NZD',
    symbol: '$',
    locale: 'en-NZ'
  },
  dateFormat: {
    locale: 'en-NZ',
    inputPattern: /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/,  // DD/MM/YYYY
    parseOrder: 'DMY'  // Day-Month-Year
  },
  cleaningPatterns: {
    phone: [
      /\s+\+64\d{8,10}/g,                    // +64XXXXXXXXX
      /\s+\d{2,3}[-\s]\d{3}[-\s]\d{4}/g,    // 09-123-4567
      /\s+\d{3}[-\s]\d{3}[-\s]\d{4}/g       // 021-123-4567
    ],
    address: {
      postcodePattern: /\s+\d{4}\s*$/,        // 4-digit postcode
      statePattern: null,                      // No states in NZ
      countryPatterns: /\s+(?:NZ|NEW ZEALAND)\s*$/i
    }
  },
  paymentNetworks: ['eftpos', 'poli', 'internet banking', 'direct debit']
}