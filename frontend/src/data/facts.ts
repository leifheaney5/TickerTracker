// Company profile facts — ported from the prototype's FACTS map. Used by the
// About panel; tickers without an entry fall back to a generated blurb.

export interface CompanyFacts {
  ceo: string
  hq: string
  founded: string
  emp: string
  desc: string
}

export const FACTS: Record<string, CompanyFacts> = {
  NVDA: { ceo: 'Jensen Huang', hq: 'Santa Clara, CA', founded: '1993', emp: '29,600', desc: 'NVIDIA designs GPUs and accelerated-computing platforms that power AI training and inference, data centers, gaming, professional visualization, and autonomous machines.' },
  AAPL: { ceo: 'Tim Cook', hq: 'Cupertino, CA', founded: '1976', emp: '164,000', desc: 'Apple designs and sells consumer electronics, software, and services — including iPhone, Mac, iPad, and a fast-growing Services segment spanning the App Store, iCloud, and more.' },
  MSFT: { ceo: 'Satya Nadella', hq: 'Redmond, WA', founded: '1975', emp: '221,000', desc: 'Microsoft develops software, cloud infrastructure (Azure), productivity tools (Microsoft 365), and AI services, and owns LinkedIn, GitHub, and Xbox.' },
  TSLA: { ceo: 'Elon Musk', hq: 'Austin, TX', founded: '2003', emp: '140,000', desc: 'Tesla designs and manufactures electric vehicles, battery energy storage, and solar products, and is investing heavily in autonomy and AI.' },
  AMZN: { ceo: 'Andy Jassy', hq: 'Seattle, WA', founded: '1994', emp: '1,550,000', desc: 'Amazon operates the largest e-commerce marketplace and the leading cloud platform (AWS), alongside advertising, devices, and streaming media.' },
  GOOGL: { ceo: 'Sundar Pichai', hq: 'Mountain View, CA', founded: '1998', emp: '182,000', desc: 'Alphabet is the parent of Google, generating revenue from Search and advertising, YouTube, Google Cloud, and a portfolio of "Other Bets".' },
  META: { ceo: 'Mark Zuckerberg', hq: 'Menlo Park, CA', founded: '2004', emp: '67,000', desc: 'Meta operates Facebook, Instagram, WhatsApp, and Messenger, monetizing through advertising while investing in AI and the metaverse via Reality Labs.' },
  AMD: { ceo: 'Lisa Su', hq: 'Santa Clara, CA', founded: '1969', emp: '26,000', desc: 'AMD designs CPUs, GPUs, and adaptive computing chips for data centers, PCs, gaming, and embedded markets, competing across AI accelerators.' },
  NFLX: { ceo: 'Sarandos & Peters', hq: 'Los Gatos, CA', founded: '1997', emp: '13,000', desc: 'Netflix is a subscription streaming service producing and licensing film and television content, expanding into ad-supported tiers and gaming.' },
  PLTR: { ceo: 'Alex Karp', hq: 'Denver, CO', founded: '2003', emp: '3,900', desc: 'Palantir builds data-integration and analytics platforms (Gotham, Foundry, AIP) for government and commercial customers.' },
  COIN: { ceo: 'Brian Armstrong', hq: 'Remote-first', founded: '2012', emp: '3,700', desc: 'Coinbase operates a leading cryptocurrency exchange and custody platform, earning transaction, subscription, and services revenue.' },
  JPM: { ceo: 'Jamie Dimon', hq: 'New York, NY', founded: '1799', emp: '309,000', desc: 'JPMorgan Chase is a diversified global bank spanning consumer banking, investment banking, asset management, and markets.' },
  XOM: { ceo: 'Darren Woods', hq: 'Spring, TX', founded: '1870', emp: '62,000', desc: 'Exxon Mobil is an integrated energy company engaged in oil & gas exploration, refining, chemicals, and low-carbon initiatives.' },
  SHEL: { ceo: 'Wael Sawan', hq: 'London, UK', founded: '1907', emp: '103,000', desc: 'Shell is an integrated energy and petrochemical company with upstream, downstream, and growing renewables & energy-solutions segments.' },
}
