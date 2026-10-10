// Single source of truth for official UNACO links. Do not hardcode elsewhere.
export const LINKS = {
  whatsappChannel: { label: 'WhatsApp channel', href: 'https://whatsapp.com/channel/0029Vatxewg4NVibRIK9cD3t', note: 'News and announcements' },
  contactGainGroup: { label: '3080 Freshmen Connect group', href: 'https://chat.whatsapp.com/JzIQhMzHcMH4rNkX1nCoWJ?s=cl&p=a&mlu=4&ilr=4', note: 'Join the freshmen group' },
  startPage: { label: 'UNACO Start.page', href: 'https://official-unaco.start.page/', note: 'All official UNACO links' },
  feedback: { label: 'Complaints and feedback', href: 'https://ngl.link/anonymousyaffgraduate', note: 'External NGL page. UNACO cannot vouch for its anonymity beyond what NGL itself provides.' },
} as const;
