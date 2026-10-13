// Invoice-issuing companies. Must stay in sync with server/src/modules/invoices/companies.js.
// Rate arrays are indexed by cover option (index 0 unused).
export const INVOICE_COMPANIES = {
  mlc: {
    key: 'mlc',
    name: 'My Life Companion Welfare',
    shortName: 'My Life Companion',
    tagline: 'Underwritten by Old Mutual',
    coverLabel: 'Cover',
    payment: { paybill: '625625', account: '20190955' },
    plans: [
      { option: 1, name: 'Option 1 — KES 1,500/yr', premium: 1500, cover: 'KES 50,000' },
      { option: 2, name: 'Option 2 — KES 3,000/yr', premium: 3000, cover: 'KES 100,000' },
      { option: 3, name: 'Option 3 — KES 6,000/yr', premium: 6000, cover: 'KES 200,000' },
      { option: 4, name: 'Option 4 — KES 9,000/yr', premium: 9000, cover: 'KES 300,000' },
      { option: 5, name: 'Option 5 — KES 12,000/yr', premium: 12000, cover: 'KES 400,000' },
      { option: 6, name: 'Option 6 — KES 15,000/yr', premium: 15000, cover: 'KES 500,000' },
    ],
    extraChildRates: [0, 300, 500, 500, 500, 500, 500],
    parent80Rates: [0, 1000, 2000, 4000, 4000, 4000, 4000],
  },
  francis: {
    key: 'francis',
    name: 'Francis Funeral Home',
    shortName: 'Francis Funeral',
    tagline: 'Busia · Funeral last expense cover',
    logo: '/assets/francis-logo.png',
    coverLabel: 'Cash Token',
    payment: { paybill: '247247', account: '855707', accountName: 'Francis Funeral Home Busia' },
    hasPolicy: true,
    plans: [
      {
        option: 1, name: 'Option 1 — KES 1,500/yr', premium: 1500, cover: 'KES 5,000',
        hearse: 'Standard hearse', casket: 'Simple casket',
        features: 'Mortuary bill 10 days, Lowering gear + Trolley',
      },
      {
        option: 2, name: 'Option 2 — KES 3,000/yr', premium: 3000, cover: 'KES 10,000',
        hearse: 'Standard hearse', casket: 'Mexican casket or Odinga quarter casket',
        features: 'Mortuary bill 10 days, Lowering gear + Trolley',
      },
      {
        option: 3, name: 'Option 3 — KES 6,000/yr', premium: 6000, cover: 'KES 15,000',
        hearse: 'Chariot hearse', casket: 'Hammer / Improved hammer / Doom play / Saitoti casket',
        features: 'Mortuary bill 14 days, Red carpet, Lowering gear + Trolley',
      },
      {
        option: 4, name: 'Option 4 — KES 9,000/yr', premium: 9000, cover: 'KES 20,000',
        hearse: 'Chariot hearse', casket: 'Sharon casket / Fidel casket',
        features: 'Mortuary bill 16 days, Automatic lowering gear + Trolley, Picture stand, Red carpet + Grave carpet',
      },
      {
        option: 5, name: 'Option 5 — KES 12,000/yr', premium: 12000, cover: 'KES 25,000',
        hearse: 'Executive Mercedes Benz hearse', casket: 'Executive casket of choice',
        features: 'Mortuary bill max 30 days, Bouquet of flowers, Automatic lowering gear + Trolley, Picture stand, Red carpet + Grave carpet',
      },
    ],
    extraChildRates: [0, 300, 500, 500, 500, 500],
    parent80Rates: [0, 1000, 2000, 4000, 4000, 4000],
  },
};

export function getInvoiceCompany(key) {
  return INVOICE_COMPANIES[key] || INVOICE_COMPANIES.mlc;
}
