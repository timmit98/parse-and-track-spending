export interface RegionConfig
{
    code: string
    name: string
    currency: {
        code: string
        symbol: string
        locale: string
    }
    dateFormat: {
        locale: string
        inputPattern: RegExp
        parseOrder: 'DMY' | 'MDY' | 'YMD'
    }
    cleaningPatterns: {
    phone: RegExp[]
    address: {
      postcodePattern: RegExp | null
      statePattern: RegExp | null
      countryPatterns: RegExp
    }
  }
  paymentNetworks: string[]
}

export interface BankConfig {
  id: string
  name: string
  displayName: string
  region: 'US' | 'NZ' | 'AU' | 'UK'  // Extensible
  detection: {
    contentPatterns: string[]
    filenamePatterns: RegExp[]
  }
  parser: {
    type: 'pdf' | 'csv'
    parserFunction: string
  }
  help?: {
    hasInstructions: boolean
    instructionKey: string
  }
}

export interface Transaction {
  id: string
  timestamp: string  // ISO 8601
  amount: number
  title: string
  category: string
  source: string
  region: 'US' | 'NZ' | 'AU' | 'UK'
  currency: 'USD' | 'NZD' | 'AUD' | 'GBP'
}

export interface ParseResult {
  transactions: Transaction[]
  source: string
  region: string
  currency: string
}