// ============================================================
// BudgetCore — categories.js
// Shared transaction-category metadata (used by app.js and index.js)
// ============================================================

export const EXPENSE_CATEGORIES = [
  'housing', 'mortgage', 'utilities',
  'groceries', 'dining', 'fooddelivery',
  'transport', 'gascharging', 'carpayment', 'carinsurance',
  'healthins', 'medical',
  'phone', 'internet', 'subscriptions',
  'childcare', 'education', 'creditcards',
  'personalcare', 'clothing',
  'shopping', 'onlineshopping',
  'entertainment', 'other',
];
export const INCOME_CATEGORIES = ['paycheck', 'salary', 'freelance', 'bonuses', 'stocks', 'gift', 'benefits', 'retirement', 'other'];

export const CATEGORY_LABELS = {
  // Income
  paycheck:      'Paycheck',
  salary:        'Salary',
  freelance:     'Freelance',
  bonuses:       'Bonuses',
  stocks:        'Stocks',
  gift:          'Gift',
  benefits:      'Gov. Benefits',
  retirement:    'Retirement',
  // Expense
  housing:       'Housing / Rent',
  mortgage:      'Mortgage',
  utilities:     'Utilities',
  groceries:     'Groceries',
  dining:        'Dining Out',
  fooddelivery:  'Food Delivery',
  transport:     'Transportation',
  gas:           'Gas / Fuel',       // legacy
  gascharging:   'Gas / Charging',
  carpayment:    'Car Payment',
  carinsurance:  'Car Insurance',
  healthins:     'Health Insurance',
  medical:       'Medical',
  phone:         'Phone Bill',
  internet:      'Internet',
  subscriptions: 'Subscriptions',
  childcare:     'Childcare',
  education:     'Education',
  creditcards:   'Credit Cards',
  personalcare:  'Personal Care',
  clothing:      'Clothing',
  shopping:      'Shopping',
  onlineshopping: 'Online Shopping',
  entertainment: 'Entertainment',
  // Legacy (existing saved transactions)
  bills:         'Bills',
  health:        'Health',
  other:         'Other',
};

export const CATEGORY_STYLES = {
  // Income
  paycheck:      { bg: '#d4eccc', color: '#1a5010' },
  salary:        { bg: '#d8e8f0', color: '#1e4868' },
  freelance:     { bg: '#d8d8f0', color: '#30288a' },
  bonuses:       { bg: '#f0e4c4', color: '#6c4810' },
  stocks:        { bg: '#c8edd8', color: '#1a5034' },
  gift:          { bg: '#f0d4e8', color: '#6c1848' },
  benefits:      { bg: '#e0d4f0', color: '#3c2070' },
  retirement:    { bg: '#f0dcd4', color: '#6c2c18' },
  // Expense — Housing
  housing:       { bg: '#f0e4cc', color: '#7a4820' },
  mortgage:      { bg: '#eddcc8', color: '#6c3c18' },
  utilities:     { bg: '#e8e4c8', color: '#5c5020' },
  // Expense — Food
  groceries:     { bg: '#f5e6cf', color: '#7c5020' },
  dining:        { bg: '#f5eac4', color: '#7a6010' },
  fooddelivery:  { bg: '#fce8d4', color: '#8c4810' },
  // Expense — Transport
  transport:     { bg: '#e8dece', color: '#5c3d18' },
  gas:           { bg: '#f5e0c4', color: '#7c4010' },   // legacy
  gascharging:   { bg: '#f5e0c4', color: '#7c4010' },
  carpayment:    { bg: '#d8e4f0', color: '#24446c' },
  carinsurance:  { bg: '#d4ddf0', color: '#1e3c6c' },
  // Expense — Health
  healthins:     { bg: '#c8e8d0', color: '#1a5c2a' },
  medical:       { bg: '#deecd8', color: '#2e6030' },
  // Expense — Bills / Tech
  phone:         { bg: '#dcd8f0', color: '#342880' },
  internet:      { bg: '#d0e4f8', color: '#1a4470' },
  subscriptions: { bg: '#e4d4f0', color: '#5c2470' },
  // Expense — Personal / Family
  childcare:     { bg: '#f8d8e8', color: '#7c2050' },
  education:     { bg: '#e4e8cc', color: '#4c5420' },
  creditcards:   { bg: '#f5d8cc', color: '#8c2c1c' },
  personalcare:  { bg: '#f0d8e4', color: '#782448' },
  clothing:      { bg: '#d4e8e4', color: '#1c5850' },
  shopping:      { bg: '#e8d8f0', color: '#5c2478' },
  onlineshopping: { bg: '#dcd4f0', color: '#4c2478' },
  // Shared
  entertainment: { bg: '#ead4e8', color: '#6a2868' },
  bills:         { bg: '#e0d4c4', color: '#4a3020' },  // legacy
  health:        { bg: '#deecd8', color: '#2e6030' },  // legacy
  other:         { bg: '#e4e4e8', color: '#404050' },
};

export const CATEGORY_ICONS = {
  // Income
  paycheck:       '💵', salary:        '💼', freelance:     '💻', bonuses:       '🎁',
  stocks:         '📈', gift:          '🎀', benefits:      '🏛️', retirement:    '🏖️',
  // Expense — Housing
  housing:        '🏠', mortgage:      '🏦', utilities:     '⚡',
  // Expense — Food
  groceries:      '🛒', dining:        '🍽️', fooddelivery:  '🛵',
  // Expense — Transport
  transport:      '🚌', gas:           '⛽', gascharging:   '⛽',
  carpayment:     '🚗', carinsurance:  '🛡️',
  // Expense — Health
  healthins:      '❤️', medical:       '💊',
  // Expense — Bills / Tech
  phone:          '📱', internet:      '🌐', subscriptions: '📺',
  // Expense — Personal / Family
  childcare:      '👶', education:     '🎓', creditcards:   '💳',
  personalcare:   '💆', clothing:      '👕',
  // Expense — Shopping
  shopping:       '🛍️', onlineshopping:'📦', entertainment: '🎬',
  // Legacy
  bills:          '📋', health:        '🏥', other:         '📌',
};

export const CATEGORY_COLORS = {
  // Expense
  housing:       '#c49060',
  mortgage:      '#a87448',
  utilities:     '#9a9860',
  groceries:     '#c4a46b',
  dining:        '#d4b888',
  fooddelivery:  '#e0a878',
  transport:     '#a07848',
  gas:           '#c48448',   // legacy
  gascharging:   '#c48448',
  carpayment:    '#8090b0',
  carinsurance:  '#7080a8',
  healthins:     '#70a880',
  medical:       '#8faa7c',
  phone:         '#9888c8',
  internet:      '#7898c8',
  subscriptions: '#a878c0',
  childcare:     '#c878a0',
  education:     '#a0a068',
  creditcards:   '#c07068',
  personalcare:  '#c888a0',
  clothing:      '#68a898',
  shopping:      '#9878c0',
  onlineshopping: '#8068b0',
  entertainment: '#b07498',
  // Legacy
  bills:         '#7c5c34',
  health:        '#8faa7c',
  other:         '#9aa0ac',
};
