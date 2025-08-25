import { pgTable, uuid, text, timestamp, numeric, pgEnum, jsonb, date, integer } from 'drizzle-orm/pg-core';

export const systemType = pgEnum('system_type', ['On-grid', 'Hybrid', 'Off-grid', 'Inverter & Battery', 'Solar Water Heater']);
export const jobStatus = pgEnum('job_status', ['Lead', 'Qualified', 'Quoted', 'Won', 'KSEB_Submitted', 'Material_Ordered', 'Installed', 'Net_Metered', 'Handover', 'Closed', 'Lost']);
export const invoiceType = pgEnum('invoice_type', ['Deposit', 'Progress', 'Final']);
export const invoiceStatus = pgEnum('invoice_status', ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled']);
export const payMode = pgEnum('pay_mode', ['UPI', 'NEFT', 'Cash', 'Card', 'Cheque']);
export const taskStatus = pgEnum('task_status', ['Open', 'InProgress', 'Blocked', 'Done']);
export const priority = pgEnum('priority', ['Low', 'Medium', 'High', 'Urgent']);
export const role = pgEnum('role', ['owner', 'staff']);

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const profiles = pgTable('profiles', {
  userId: uuid('user_id').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  role: role('role').default('staff'),
  phone: text('phone'),
  displayName: text('display_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  discom: text('discom').default('KSEB'),
  consumerNo: text('consumer_no'),
  phase: text('phase'),
  sanctionedLoadKw: numeric('sanctioned_load_kw', { precision: 6, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  date: date('date'),
  source: text('source'),
  name: text('name'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  interestedCapacityKw: numeric('interested_capacity_kw', { precision: 6, scale: 2 }),
  notes: text('notes'),
  assignedTo: uuid('assigned_to'),
  status: text('status'),
});

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  customerId: uuid('customer_id').notNull(),
  leadId: uuid('lead_id'),
  systemType: systemType('system_type').notNull(),
  capacityKw: numeric('capacity_kw', { precision: 6, scale: 2 }),
  roofType: text('roof_type'),
  status: jobStatus('status').notNull().default('Lead'),
  quotedPrice: numeric('quoted_price', { precision: 12, scale: 2 }),
  discount: numeric('discount', { precision: 12, scale: 2 }),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }),
  depositAmount: numeric('deposit_amount', { precision: 12, scale: 2 }),
  balanceDue: numeric('balance_due', { precision: 12, scale: 2 }),
  dateLead: date('date_lead'),
  dateSiteSurvey: date('date_site_survey'),
  dateQuote: date('date_quote'),
  dateWon: date('date_won'),
  dateKsebSubmit: date('date_kseb_submit'),
  dateInstall: date('date_install'),
  dateMeter: date('date_meter'),
  dateHandover: date('date_handover'),
  ksebApplicationNo: text('kseb_application_no'),
  subsidyPortalRef: text('subsidy_portal_ref'),
  location: text('location'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const proposals = pgTable('proposals', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  jobId: uuid('job_id').notNull(),
  date: date('date'),
  kitName: text('kit_name'),
  priceBeforeTax: numeric('price_before_tax', { precision: 12, scale: 2 }),
  tax: numeric('tax', { precision: 12, scale: 2 }),
  total: numeric('total', { precision: 12, scale: 2 }),
  validTill: date('valid_till'),
  pdfUrl: text('pdf_url'),
  terms: text('terms'),
});

export const items = pgTable('items', {
  itemCode: text('item_code').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  name: text('name').notNull(),
  category: text('category'),
  unit: text('unit'),
  gstRate: numeric('gst_rate', { precision: 5, scale: 2 }),
  mrp: numeric('mrp', { precision: 12, scale: 2 }),
  preferredVendor: text('preferred_vendor'),
  specs: jsonb('specs'),
});

export const kits = pgTable('kits', {
  kitName: text('kit_name').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  description: text('description'),
  capacityKw: numeric('capacity_kw', { precision: 6, scale: 2 }),
  sellingPrice: numeric('selling_price', { precision: 12, scale: 2 }),
});

export const kitItems = pgTable('kit_items', {
  kitName: text('kit_name').notNull(),
  itemCode: text('item_code').notNull(),
  qty: numeric('qty', { precision: 10, scale: 2 }),
});

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  jobId: uuid('job_id').notNull(),
  date: date('date'),
  invoiceType: invoiceType('invoice_type').notNull(),
  amountBeforeTax: numeric('amount_before_tax', { precision: 12, scale: 2 }),
  tax: numeric('tax', { precision: 12, scale: 2 }),
  total: numeric('total', { precision: 12, scale: 2 }),
  dueDate: date('due_date'),
  status: invoiceStatus('status').default('Draft'),
  irn: text('irn'),
  pdfUrl: text('pdf_url'),
});

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  invoiceId: uuid('invoice_id').notNull(),
  date: date('date'),
  mode: payMode('mode'),
  amount: numeric('amount', { precision: 12, scale: 2 }),
  reference: text('reference'),
  receivedBy: text('received_by'),
  notes: text('notes'),
});

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  jobId: uuid('job_id').notNull(),
  docType: text('doc_type'),
  fileUrl: text('file_url'),
  version: integer('version'),
  signedBy: text('signed_by'),
  signedDate: date('signed_date'),
  notes: text('notes'),
});

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  jobId: uuid('job_id').notNull(),
  title: text('title'),
  assignedTo: uuid('assigned_to'),
  dueDate: date('due_date'),
  status: taskStatus('status').default('Open'),
  priority: priority('priority').default('Medium'),
  notes: text('notes'),
});

export const serviceTickets = pgTable('service_tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  customerId: uuid('customer_id').notNull(),
  jobId: uuid('job_id'),
  date: date('date'),
  issueType: text('issue_type'),
  priority: priority('priority').default('Medium'),
  status: taskStatus('status').default('Open'),
  summary: text('summary'),
  assignedTo: uuid('assigned_to'),
  resolutionNotes: text('resolution_notes'),
});

export const backgroundJobs = pgTable('background_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  type: text('type').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>(),
  runAt: timestamp('run_at', { withTimezone: true }).defaultNow(),
  attempts: integer('attempts').default(0),
  lastError: text('last_error'),
});

export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  currency: text('currency').default('INR'),
  upiId: text('upi_id'),
  defaultTaxRate: numeric('default_tax_rate', { precision: 5, scale: 2 }).default('0'),
  primaryDiscom: text('primary_discom').default('KSEB'),
  proposalNoteMl: text('proposal_note_ml'),
  depositPercent: numeric('deposit_percent', { precision: 5, scale: 2 }).default('0'),
});

