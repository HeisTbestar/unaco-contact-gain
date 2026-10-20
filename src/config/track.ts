/** Shared allow-lists for analytics events (client sends, server validates). Event names carry no personal data. */
export const TRACK_TYPES = ['pageview', 'click', 'form_start', 'form_success', 'form_error', 'remove_open', 'remove_success'] as const;
export type TrackType = (typeof TRACK_TYPES)[number];

export const CLICK_TARGETS = {
  brand_home: 'Header: logo',
  nav_home: 'Nav: Home',
  nav_how: 'Nav: How it works',
  nav_register: 'Nav: Add contact',
  nav_faq: 'Nav: FAQs',
  header_channel: 'Header: WhatsApp channel',
  cta_add_contact: 'Hero: Add my contact',
  cta_how: 'Hero: How it works',
  link_group_how: 'How it works: group link',
  link_group_success: 'After sign-up: group link',
  cta_join_group: 'Join band: Join now',
  link_channel: 'Links: WhatsApp channel',
  link_group: 'Links: Freshmen Connect group',
  link_startpage: 'Links: Start.page',
  link_feedback: 'Links: Complaints and feedback',
  footer_remove: 'Footer: Remove my number',
  footer_faq: 'Footer: FAQs',
  footer_startpage: 'Footer: Start.page',
  faq_open: 'FAQ question opened',
} as const;

export const FORM_ERROR_TARGETS = {
  validation: 'Validation error',
  server: 'Server error',
  rate_limit: 'Rate limited',
  network: 'Network error',
} as const;
