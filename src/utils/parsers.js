import Papa from 'papaparse'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import categoryConfig from './category-config.json'
import { parseASBPDF } from './parsers/nz/asb.js'

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

// Load category keywords and merchant mappings from config
// Note: category-config.json is git-ignored for privacy
// If you clone this repo, copy category-config.example.json to category-config.json
const CATEGORY_KEYWORDS = categoryConfig.categoryKeywords
const MERCHANT_MAPPINGS = categoryConfig.merchantMappings

export function categorizeTransaction(title) {
  const titleLower = title.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (titleLower.includes(keyword)) {
        return category
      }
    }
  }
  return 'Other'
}

export function cleanMerchantName(rawDescription) {
  let name = rawDescription.trim()

  // Decode HTML entities
  name = name.replace(/&#039;/g, "'")
  name = name.replace(/&amp;/g, "&")
  name = name.replace(/&quot;/g, '"')
  name = name.replace(/&lt;/g, '<')
  name = name.replace(/&gt;/g, '>')

  // Check for mapped merchant names from config
  for (const [pattern, friendlyName] of Object.entries(MERCHANT_MAPPINGS)) {
    if (new RegExp(pattern, 'i').test(name)) {
      return friendlyName
    }
  }

  // Remove leading date patterns (MM/DD/YY, MM/DD/YYYY, etc.)
  name = name.replace(/^\d{1,2}\/\d{1,2}\/\d{2,4}\s+/g, '')

  // Remove "AplPay " prefix
  name = name.replace(/^AplPay\s+/i, '')

  // Remove TST* prefix (Toast POS system)
  name = name.replace(/^TST\*\s*/i, '')

  // Remove BT* prefix (Bill.com/payment processor)
  name = name.replace(/^BT\*\s*/i, '')

  // Remove PY* prefix (payment processor)
  name = name.replace(/^PY\s*\*\s*/i, '')

  // Remove WIX* prefix (Wix payment processor)
  name = name.replace(/^WIX\*[^*]*\*/i, '')

  // Remove DD* prefix (DoorDash)
  name = name.replace(/^DD\s*\*/i, '')

  // Remove TM* prefix (Ticketmaster)
  name = name.replace(/^TM\s*\*/i, '')

  // Remove PT* prefix (payment processor)
  name = name.replace(/^PT\s*\*/i, '')

  // Remove SP prefix (Square POS)
  name = name.replace(/^SP\s+/i, '')

  // Remove common POS system patterns
  name = name.replace(/\s+squareup\.com\/receipts$/i, '')

  // Remove phone numbers (various formats)
  name = name.replace(/\s+\d{3}-\d{3}-\d{4}/g, '') // 123-456-7890
  name = name.replace(/\s+\(\d{3}\)\s*\d{3}-\d{4}/g, '') // (800) 555-1234
  name = name.replace(/\s+\+\d{11,}/g, '') // +18005551234

  // Remove email addresses
  name = name.replace(/\s+[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, '')

  // Remove URLs
  name = name.replace(/\s+https?:\/\/\S+/gi, '')
  name = name.replace(/\s+[a-z]+\.com\/\S*/gi, '')

  // Remove very long transaction IDs (alphanumeric strings 20+ chars)
  name = name.replace(/\s+[A-Z0-9_-]{20,}/gi, '')

  // Remove common category suffixes only if they're clearly metadata
  name = name.replace(/\s+(GOODS\/SERVICES|LOCAL TRANSPORTATION|CABLE & PAY TV)$/i, '')

  // Clean up extra whitespace
  name = name.replace(/\s+/g, ' ').trim()

  // Capitalize first letter of each word for consistency
  name = name.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')

  return name
}

function cleanAppleCardDescription(rawDescription) {
  // First apply standard cleaning (removes TST*, PAYPAL *, etc.)
  let desc = cleanMerchantName(rawDescription)

  // Remove full addresses (number + street + city + ZIP + state + country)
  desc = desc.replace(/\s+\d+[\s\S]*?\d{5}\s+[A-Z]{2}\s+(?:USA|US)/gi, '')

  // Remove remaining address artifacts
  desc = desc.replace(/\s+\d{5}(?:-\d{4})?\s*$/, '')  // Trailing ZIP
  desc = desc.replace(/\s+[A-Z]{2}\s*$/, '')           // Trailing state
  desc = desc.replace(/\s+(?:USA|US)\s*$/i, '')        // Trailing country

  // Clean up extra whitespace
  desc = desc.replace(/\s+/g, ' ').trim()

  return desc
}

export function isTransferOrPayment(description) {
  const lowerDesc = description.toLowerCase()

  // For checking accounts: Only filter actual transfers, not bill payments/subscriptions
  // Credit card payments (paying off credit cards - already counted on CC statements)
  const creditCardPayments = [
    'amex epayment',
    'amex payment',
    'american express ach',
    'american express pmt',
    'applecard gsbank',
    'apple card payment',
    'chase payment',
    'citi payment',
    'discover payment',
    'capital one payment',
    'credit card payment'
  ]

  // P2P and account transfers (money movement, not spending)
  const accountTransfers = [
    'zelle',
    'venmo',
    'paypal transfer',
    'account transfer',
    'transfer to',
    'transfer from',
    'robinhood',           // Investment transfers
    'debits xxxxx',        // Investment/brokerage transfers
    'internal transfer',
    'external transfer'
  ]

  // Check credit card payments
  if (creditCardPayments.some(keyword => lowerDesc.includes(keyword))) {
    return true
  }

  // Check account transfers
  if (accountTransfers.some(keyword => lowerDesc.includes(keyword))) {
    return true
  }

  return false
}

export function parseAmount(amountStr) {
  if (typeof amountStr === 'number') {
    return Math.abs(amountStr)
  }

  // Remove currency symbols and whitespace
  let cleaned = String(amountStr).replace(/[^\d.\-,]/g, '')

  // Handle comma as thousands separator
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/,/g, '')
  } else if (cleaned.includes(',')) {
    const parts = cleaned.split(',')
    if (parts[parts.length - 1].length === 2) {
      cleaned = cleaned.replace(',', '.')
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  }

  const num = parseFloat(cleaned)
  return (isNaN(num) || !isFinite(num)) ? 0 : Math.abs(num)
}

export function parseDate(dateStr) {
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      return new Date().toISOString()
    }
    return date.toISOString()
  } catch {
    return new Date().toISOString()
  }
}

export function detectSource(filename = '', content = '') {
  const lowerFilename = (filename || '').toLowerCase()
  const lowerContent = content.toLowerCase()

  // Detect ASB Bank
  if (lowerFilename.includes('asb') || lowerContent.includes('asb bank') || lowerContent.includes('asb.co.nz')) {
    return 'ASB Bank'
  }

  // TODO: Add other NZ banks as needed (ANZ, BNZ, Westpac, Kiwibank)

  return 'Unknown'
}

export function parseCSVText(text, filename = '') {
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          reject(new Error('Empty CSV file'))
          return
        }

        const fields = results.meta.fields || []
        const normalizedFields = {}
        fields.forEach(f => {
          normalizedFields[f.toLowerCase().trim()] = f
        })

        // Find date column
        let dateCol = null
        for (const key of ['date', 'timestamp', 'time', 'transaction date', 'trans date']) {
          if (normalizedFields[key]) {
            dateCol = normalizedFields[key]
            break
          }
        }

        // Find amount column
        let amountCol = null
        for (const key of ['amount', 'value', 'total', 'price', 'cost', 'debit', 'transaction amount']) {
          if (normalizedFields[key]) {
            amountCol = normalizedFields[key]
            break
          }
        }

        // Find title/description column
        let titleCol = null
        for (const key of ['title', 'description', 'name', 'merchant', 'vendor', 'payee', 'transaction description']) {
          if (normalizedFields[key]) {
            titleCol = normalizedFields[key]
            break
          }
        }

        if (!dateCol || !amountCol || !titleCol) {
          reject(new Error(`Could not identify required columns. Found: ${fields.join(', ')}. Need date, amount, and title/description columns.`))
          return
        }

        const source = detectSource(filename, results.data.map(r => Object.values(r).join(' ')).join(' '))

        const transactions = results.data
          .map(row => {
            const timestamp = parseDate(row[dateCol])
            const amount = parseAmount(row[amountCol])
            const title = (row[titleCol] || '').trim()

            if (amount > 0 && title) {
              return {
                id: `${timestamp}-${amount}-${title}`.replace(/[^a-zA-Z0-9]/g, ''),
                timestamp,
                amount,
                title,
                category: categorizeTransaction(title),
                source
              }
            }
            return null
          })
          .filter(Boolean)

        resolve({ transactions, source })
      },
      error: (error) => {
        reject(error)
      }
    })
  })
}

export async function parseCSV(file) {
  const text = await file.text()
  return parseCSVText(text, file.name)
}

async function extractTextFromPDFBuffer(arrayBuffer, { disableWorker = false, maxPages = 60 } = {}) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, disableWorker }).promise
  if (Number.isFinite(maxPages) && pdf.numPages > maxPages) {
    throw new Error(`PDF has ${pdf.numPages} pages. Max allowed is ${maxPages}.`)
  }

  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const text = textContent.items.map(item => item.str).join(' ')
    pages.push(text)
  }

  return pages
}




export async function parsePDFBuffer(arrayBuffer, filename = '', { disableWorker = false, maxPages = 60 } = {}) {
  try {
    const pages = await extractTextFromPDFBuffer(arrayBuffer, { disableWorker, maxPages })
    const fullText = pages.join(' ')

    // Detect bank source
    const source = detectSource(filename, fullText)

    // Parse based on detected source
    if (source === 'ASB Bank') {
      const transactions = parseASBPDF(pages)
      return {
        transactions,
        source: 'ASB Bank',
        region: 'NZ',
        currency: 'NZD'
      }
    }

    // If no parser found, throw error
    throw new Error(`No parser available for: ${source}. Currently supported: ASB Bank (NZ)`)
  } catch (error) {
    throw new Error(`Failed to parse PDF: ${error.message}`)
  }
}

export async function parsePDF(file, { maxPages = 60 } = {}) {
  const arrayBuffer = await file.arrayBuffer()
  return parsePDFBuffer(arrayBuffer, file.name, { maxPages })
}
