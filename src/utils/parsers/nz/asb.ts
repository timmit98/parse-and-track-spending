import type { Transaction } from '../../../types/index.js'
import { NZ_REGION_CONFIG } from '../../../config/regions/nz.js'

/**
 * Parse ASB Bank PDF statement
 * Supports: ASB Streamline Account (checking/savings)
 * Date format: DD Mon (year extracted from header)
 *
 * @param pages - Array of text strings extracted from PDF pages
 * @returns Array of parsed transactions
 */
export function parseASBPDF(pages: string[]): Transaction[] {
  const transactions: Transaction[] = []
  const fullText = pages.join('\n')

  // Debug logging
  console.log('=== ASB Parser Debug ===')
  console.log('Number of pages:', pages.length)
  console.log('First 500 chars of page 1:', pages[0]?.substring(0, 500))

  // Extract year from statement header
  const year = extractStatementYear(fullText)
  console.log('Extracted year:', year)

  // Extract statement start month for year boundary handling
  const startMonth = extractStatementStartMonth(fullText)
  console.log('Start month index:', startMonth)

  // Parse each page
  for (let i = 0; i < pages.length; i++) {
    const pageText = pages[i]
    const pageTransactions = parseTransactionsFromPage(pageText, year, startMonth)
    console.log(`Page ${i + 1}: Found ${pageTransactions.length} transactions`)
    transactions.push(...pageTransactions)
  }

  console.log('Total transactions found:', transactions.length)
  console.log('======================')

  return transactions
}

/**
 * Extract year from statement header
 * Pattern: "Opening date   18 Nov 25" → 2025 (note: multiple spaces)
 */
function extractStatementYear(text: string): number {
  const yearMatch = text.match(/Opening date\s+\d{1,2}\s+\w+\s+(\d{2})/)
  if (yearMatch) {
    const twoDigitYear = parseInt(yearMatch[1])
    return 2000 + twoDigitYear
  }
  // Fallback to current year
  return new Date().getFullYear()
}

/**
 * Extract statement start month for year boundary handling
 * Pattern: "Opening date   18 Nov 25" → 10 (November is month 10, 0-indexed)
 */
function extractStatementStartMonth(text: string): number {
  const monthMatch = text.match(/Opening date\s+\d{1,2}\s+(\w+)\s+\d{2}/)
  if (monthMatch) {
    const monthStr = monthMatch[1]
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return months.indexOf(monthStr)
  }
  return 0
}

/**
 * Parse transactions from a single page
 * PDF text is continuous without line breaks, so we use regex to find all transactions
 */
function parseTransactionsFromPage(pageText: string, baseYear: number, startMonth: number): Transaction[] {
  const transactions: Transaction[] = []

  // Pattern: (date) followed by (description) followed by (amounts)
  // Date: "DD Mon" where Mon is Jan|Feb|Mar|etc
  // Description: any text until we hit the amounts
  // Amounts: 1-3 numbers in format X,XXX.XX or XXX.XX
  const transactionPattern = /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))\s+(.*?)\s+(\d{1,3}(?:,\d{3})*\.\d{2})(?:\s+(\d{1,3}(?:,\d{3})*\.\d{2}))?(?:\s+(\d{1,3}(?:,\d{3})*\.\d{2}))?/g

  let match
  while ((match = transactionPattern.exec(pageText)) !== null) {
    const [, dateStr, description, amount1, amount2, amount3] = match

    // Skip if description is empty or looks like a header
    if (!description || description.includes('Transaction') || description.includes('Debit/Withdrawal')) {
      continue
    }

    // Parse the matched transaction
    const transaction = parseTransactionFromMatch(dateStr, description, [amount1, amount2, amount3].filter(Boolean), baseYear, startMonth)
    if (transaction) {
      transactions.push(transaction)
    }
  }

  return transactions
}

/**
 * Parse a transaction from regex match
 * Format: Date  Transaction  Amount1  Amount2  Amount3
 */
function parseTransactionFromMatch(
  dateStr: string,
  description: string,
  amountStrs: string[],
  baseYear: number,
  startMonth: number
): Transaction | null {
  // Filter out transactions we don't want
  if (shouldFilterTransaction(description)) {
    return null
  }

  // Parse amounts
  const amounts = amountStrs.map(parseAmount)

  // Determine transaction type and amount
  const { amount, isDebit } = determineAmountAndType(amounts)

  if (amount === 0) {
    return null // Skip zero-amount transactions
  }

  // Parse date with year handling
  const timestamp = parseDate(dateStr, baseYear, startMonth)

  // Clean merchant name
  const merchantName = cleanMerchantName(description)

  // Generate unique ID
  const id = generateTransactionId(timestamp, merchantName, amount)

  return {
    id,
    timestamp,
    amount,
    title: merchantName,
    category: 'Other', // Will be categorized by AI later
    source: 'ASB Bank',
    region: 'NZ',
    currency: 'NZD'
  }
}

/**
 * Filter out transactions we don't want to track
 */
function shouldFilterTransaction(description: string): boolean {
  const filterPatterns = [
    /^SaveTheChange/i,           // Round-up savings
    /^TFR To/i,                  // Transfers out
    /^TFR From/i,                // Transfers in
    /^Opening Balance/i,         // Statement start
    /^Closing Balance/i,         // Statement end
    /^Carried Forward/i,         // Page break
    /^OffshoreServiceMargins/i,  // Bank fees
    /^Service Margins/i,         // Bank fees
    /^Account Fee/i              // Bank fees
  ]

  return filterPatterns.some(pattern => pattern.test(description))
}

/**
 * Parse amount string to number
 * Format: "1,234.56" → 1234.56
 */
function parseAmount(amountStr: string): number {
  const cleaned = amountStr.replace(/,/g, '')
  return parseFloat(cleaned)
}

/**
 * Determine if transaction is debit or deposit and extract amount
 * ASB format: [date] [description] [debit OR deposit OR empty] [deposit OR balance OR empty] [balance]
 *
 * If 2 amounts: first is debit or deposit, second is balance
 * If 3 amounts: first is debit, second is deposit (rare), third is balance
 */
function determineAmountAndType(amounts: number[]): { amount: number; isDebit: boolean } {
  if (amounts.length === 2) {
    // Most common: [amount, balance]
    // If amount < balance, it's likely a debit
    // If amount > balance, it's likely a deposit
    const amount = amounts[0]
    const balance = amounts[1]

    // Simple heuristic: transactions are usually debits (expenses)
    // We'll track all as positive amounts for now
    return { amount: Math.abs(amount), isDebit: true }
  } else if (amounts.length === 3) {
    // Rare: [debit, deposit, balance] - both columns have values
    // Use first non-zero amount
    const debit = amounts[0]
    const deposit = amounts[1]

    if (debit > 0 && deposit === 0) {
      return { amount: debit, isDebit: true }
    } else if (deposit > 0 && debit === 0) {
      return { amount: deposit, isDebit: false }
    } else {
      // Both have values - use debit
      return { amount: debit, isDebit: true }
    }
  }

  return { amount: 0, isDebit: true }
}

/**
 * Parse date with year handling
 * Format: "19 Nov" + year → ISO timestamp
 * Handles year boundary (Dec → Jan)
 */
function parseDate(dateStr: string, baseYear: number, startMonth: number): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const parts = dateStr.split(/\s+/)
  const day = parseInt(parts[0])
  const monthStr = parts[1]
  const monthIndex = months.indexOf(monthStr)

  // Handle year boundary
  let year = baseYear
  if (monthIndex < startMonth && startMonth > 6) {
    // If transaction month is early in year (Jan-Jun) and statement started late in year (Jul-Dec)
    // Then transaction is in the next year
    year = baseYear + 1
  }

  // Create date object
  const date = new Date(year, monthIndex, day)
  return date.toISOString()
}

/**
 * Clean merchant name by removing ASB-specific patterns
 */
function cleanMerchantName(description: string): string {
  let cleaned = description.trim()

  // Remove "Card XXXX" prefix
  cleaned = cleaned.replace(/^Card \d{4}\s+/, '')

  // Remove common NZ city prefixes (but not if part of merchant name)
  const cityPrefixes = [
    'Christchurch ',
    'Auckland ',
    'Wellington ',
    'Hamilton ',
    'Tauranga ',
    'Dunedin ',
    'Palmerston North ',
    'Napier ',
    'Porirua ',
    'Hibiscus Coast ',
    'Upper Hutt ',
    'Lower Hutt ',
    'Rotorua ',
    'New Plymouth ',
    'Whangarei ',
    'Invercargill ',
    'Nelson ',
    'Queenstown ',
    'Merivale ',
    'Riccarton ',
    'Hornby ',
    'Papanui '
  ]

  for (const prefix of cityPrefixes) {
    // Only remove if followed by another word (to keep "Auckland One NZ")
    if (cleaned.startsWith(prefix) && cleaned.length > prefix.length + 3) {
      const afterPrefix = cleaned.substring(prefix.length)
      // Don't remove if the city is part of the brand name
      if (!afterPrefix.match(/^(One|City|Central|Airport|South|North|East|West)/)) {
        cleaned = afterPrefix
      }
    }
  }

  // Remove "WO" bill payment reference
  cleaned = cleaned.replace(/^WO\d+\s+/, '')

  // Handle foreign currency transactions
  // Pattern: "USD 20.00 At 0.5709* Cursor, Ai Powered Ide"
  const foreignCurrencyMatch = cleaned.match(/^[A-Z]{3}\s+[\d,.]+\s+At\s+[\d.]+\*?\s+(.+)$/)
  if (foreignCurrencyMatch) {
    cleaned = foreignCurrencyMatch[1]
  }

  // Handle salary/wage deposits
  // Pattern: "Madecurious Lim 15-Nov-2025 Salary/Wagespay Ended"
  const salaryMatch = cleaned.match(/^(.+?)\s+\d{1,2}-\w+-\d{4}\s+Salary\/Wages.+$/)
  if (salaryMatch) {
    cleaned = salaryMatch[1] + ' (Salary)'
  }

  // Clean phone numbers using NZ patterns
  for (const phonePattern of NZ_REGION_CONFIG.cleaningPatterns.phone) {
    cleaned = cleaned.replace(phonePattern, '')
  }

  // Clean address patterns
  if (NZ_REGION_CONFIG.cleaningPatterns.address.postcodePattern) {
    cleaned = cleaned.replace(NZ_REGION_CONFIG.cleaningPatterns.address.postcodePattern, '')
  }
  cleaned = cleaned.replace(NZ_REGION_CONFIG.cleaningPatterns.address.countryPatterns, '')

  // Final cleanup
  cleaned = cleaned.trim()

  // Limit length
  if (cleaned.length > 100) {
    cleaned = cleaned.substring(0, 100)
  }

  return cleaned || 'Unknown Merchant'
}

/**
 * Generate unique transaction ID
 */
function generateTransactionId(timestamp: string, merchant: string, amount: number): string {
  const data = `${timestamp}-${merchant}-${amount}`
  // Simple hash function
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}
