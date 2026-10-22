// All error texts in one place. `{name}` is a placeholder, filled in with formatMessage.
// User facing texts use plain language, not technical terms (see CLAUDE.md).

export const ERROR_MESSAGE = {
  // Import file check
  FILE_TYPE_NOT_SUPPORTED:
    '".{extension}" files are not supported. Please choose a {formats} file.',
  FILE_TYPE_UNKNOWN: 'This file type is not supported. Please choose a {formats} file.',
  FILE_EMPTY: 'This file is empty. Please choose a file with data.',
  FILE_TOO_LARGE: 'This file is larger than {maxMb} MB. Please split it into smaller files.',

  // Import
  FILE_NO_HEADER: 'The file appears to be empty or has no header row.',
  FILE_READ_FAILED: 'Could not read the file.',

  // Internal, not shown as user guidance
  LOAD_CANCELLED: 'Load cancelled',
  WORKER_CRASHED: 'Worker crashed',
  WORKER_TERMINATED: 'Worker terminated',
  ROOT_NOT_FOUND: 'Root element #{id} not found',
} as const

// Texts for data issues found by the column rules (src/domain/rules).
// title: short label for lists; explanation: what is wrong and what a good value looks like.
export const ISSUE_TEXT = {
  'customer_id.missing': {
    title: 'Customer ID is missing',
    explanation: 'Every customer needs an ID, for example C10023.',
  },
  'customer_id.whitespace': {
    title: 'Extra spaces in customer ID',
    explanation: 'Remove the spaces around the ID, for example C10023.',
  },
  'customer_id.duplicate': {
    title: 'Customer ID is used more than once',
    explanation: 'Each customer ID must be unique. Check which row is correct.',
  },
  'first_name.missing': {
    title: 'First name is missing',
    explanation: "Enter the customer's first name, for example Anna.",
  },
  'first_name.whitespace': {
    title: 'Extra spaces in first name',
    explanation: 'Remove the spaces before and after the name, for example Anna.',
  },
  'last_name.missing': {
    title: 'Last name is missing',
    explanation: "Enter the customer's last name, for example Müller.",
  },
  'last_name.whitespace': {
    title: 'Extra spaces in last name',
    explanation: 'Remove the spaces before and after the name, for example Müller.',
  },
  'email.missing': {
    title: 'Email is missing',
    explanation: 'Enter an email address like anna@example.com.',
  },
  'email.whitespace': {
    title: 'Extra spaces in email',
    explanation: 'Remove the spaces before and after the address, for example anna@example.com.',
  },
  'email.invalid': {
    title: 'Email does not look valid',
    explanation: 'An email needs a name, an @ and a domain, like anna@example.com.',
  },
  'email.duplicate': {
    title: 'Email is used more than once',
    explanation: 'Rows with the same email are probably the same customer. Keep one of them.',
  },
  'signup_date.missing': {
    title: 'Signup date is missing',
    explanation: 'Enter the date as year-month-day, for example 2024-03-15.',
  },
  'signup_date.format': {
    title: 'Date in a different format',
    explanation: 'Dates should be written as year-month-day, like 2024-03-15.',
  },
  'signup_date.ambiguous': {
    title: 'Date can be read two ways',
    explanation:
      'Day and month are both 12 or less, so we read it as day/month. Check that this is right.',
  },
  'signup_date.impossible': {
    title: 'Date does not exist',
    explanation: 'This day is not in the calendar, like February 30. Enter a real date.',
  },
  'signup_date.unrecognized': {
    title: 'Date not recognized',
    explanation: 'Enter the date as year-month-day, for example 2024-03-15.',
  },
  'country.missing': {
    title: 'Country is missing',
    explanation: 'Enter a 2-letter country code like DE.',
  },
  'country.format': {
    title: 'Country code not in capitals',
    explanation: 'Country codes are 2 capital letters, like DE.',
  },
  'country.name': {
    title: 'Country name instead of code',
    explanation: 'Country should be a 2-letter code, like DE for Germany.',
  },
  'country.unknown': {
    title: 'Country not recognized',
    explanation: 'We could not match this to a country. Enter a 2-letter code like DE.',
  },
  'plan.missing': {
    title: 'Plan is missing',
    explanation: 'Choose one of free, pro or enterprise.',
  },
  'plan.format': {
    title: 'Plan not in lowercase',
    explanation: 'Plans are written in lowercase: free, pro or enterprise.',
  },
  'plan.unknown': {
    title: 'Unknown plan',
    explanation: 'The plan must be one of free, pro or enterprise.',
  },
  'monthly_spend.missing': {
    title: 'Monthly spend is missing',
    explanation: 'Enter an amount like 49.90. Use 0 if the customer pays nothing.',
  },
  'monthly_spend.format': {
    title: 'Currency or spaces in amount',
    explanation: 'Enter only the number, without a currency sign, like 49.90.',
  },
  'monthly_spend.separator': {
    title: 'Comma in amount',
    explanation: 'Use a dot for decimals and no thousands separator, like 1234.50.',
  },
  'monthly_spend.negative': {
    title: 'Negative amount',
    explanation: 'Monthly spend cannot be below 0.',
  },
  'monthly_spend.invalid': {
    title: 'Amount is not a number',
    explanation: 'Enter a number like 49.90.',
  },
} as const
