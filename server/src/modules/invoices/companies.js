const path = require('path');

// Invoice-issuing companies. Each has its own plans, rates, branding and invoice prefix.
// Rate arrays are indexed by cover option (index 0 unused).
const COMPANIES = {
  mlc: {
    key: 'mlc',
    name: 'My Life Companion Welfare',
    prefix: 'INV',
    primary: '#1A2B4A',
    accent: '#F5A623',
    planDescription: 'Extended family cover (annual)',
    coverHeader: 'COVER',
    headerLines: [
      'Development House, Floor 13, Suite 18, Nairobi',
      '+254-118-043-715  |  info@mylife-companion.com',
      'Underwritten by Old Mutual',
    ],
    issuedByLines: [
      'Development House, Floor 13, Suite 18',
      '+254-118-043-715  |  info@mylife-companion.com',
      'Underwritten by Old Mutual',
    ],
    footer: 'My Life Companion Welfare  ·  info@mylife-companion.com  ·  +254-118-043-715  ·  Underwritten by Old Mutual',
    payment: {
      paybill: '625625',
      account: '20190955',
      bank: { accountName: 'Life Companion Welfare', bank: 'National Bank', accountNo: '7718883051' },
    },
    plans: [
      { option: 1, name: 'Option 1', premium: 1500, cover: 'KES 50,000' },
      { option: 2, name: 'Option 2', premium: 3000, cover: 'KES 100,000' },
      { option: 3, name: 'Option 3', premium: 6000, cover: 'KES 200,000' },
      { option: 4, name: 'Option 4', premium: 9000, cover: 'KES 300,000' },
      { option: 5, name: 'Option 5', premium: 12000, cover: 'KES 400,000' },
      { option: 6, name: 'Option 6', premium: 15000, cover: 'KES 500,000' },
    ],
    extraChildRates: [0, 300, 500, 500, 500, 500, 500],
    parent80Rates: [0, 1000, 2000, 4000, 4000, 4000, 4000],
  },

  francis: {
    key: 'francis',
    name: 'Francis Funeral Home',
    prefix: 'FFH',
    primary: '#2B1A17',
    accent: '#E8501E',
    logo: path.join(__dirname, '../../assets/francis-logo.png'),
    planDescription: 'Funeral last expense cover (annual)',
    coverHeader: 'CASH TOKEN',
    headerLines: [
      'Busia, Kenya',
      'Call / WhatsApp: 0757531326',
      'www.mylife-companion.com',
    ],
    issuedByLines: [
      'Busia, Kenya',
      'Call / WhatsApp: 0757531326',
      'In partnership with My Life Companion Welfare',
    ],
    footer: 'Francis Funeral Home, Busia  ·  Call / WhatsApp 0757531326  ·  www.mylife-companion.com',
    payment: {
      paybill: '247247',
      account: '855707',
      accountName: 'Francis Funeral Home Busia',
    },
    mlcLogo: path.join(__dirname, '../../assets/mlc-logo.png'),
    registrationNote: 'One-off registration of KSH. 200/- must accompany the payment.',
    policyTerms: [
      'Cover applies to principal member, one spouse, biological children, and biological parents. Cover may be extended to adopted children subject to proof of legal adoption.',
      'Cover commences once the premium is paid in full. Premium for any extra dependent and for any parents should be paid up front. Payment to be made annually in advance through MPESA Paybill Number **247247** Account number **855707**, Account Name **FRANCIS FUNERAL HOME**. Premiums may be reviewed annually at the discretion of the underwriter.',
      'There is a waiting period of 3 months for parents and 2 months for the rest from the date of commencement of the policy and subject to payment of full premium. In case of natural death within the waiting period no benefit is payable.',
      'The maximum benefit payable on death of a child below the age of 10 years shall be KES 100,000 as provided by Insurance Act Cap 487 – Sec 96. Children are covered from 14 days old to age 18 years and those between age 18 years to 24 years are covered subject to confirmation of being in fulltime education.',
      'Maximum age at entry is 90 years next birthday for parents, and 70 years for main member and spouse. There is no cover expiry age.',
      'There is a maximum of 6 claims payable in any one year.',
      'On policy renewal, the full premium should be paid within 30 days of cover renewal. If no payment is received within the 30-day grace period, the cover automatically lapses.',
      'Cover is renewable annually.',
    ],
    claimProcedure: [
      ['(a)', 'Contact your Intermediary: FRANCIS FUNERAL HOME.'],
      ['(b)', 'Provide a certified copy of ID card of the deceased member or birth certificate if the deceased is a child under the age of 18 years and a certified copy of ID card of the principal member who signed for the cover.'],
      ['(c)', 'Forward the death notification letter/form immediately to FRANCIS FUNERAL HOME.'],
      ['(d)', 'Fill death claim report form available at FRANCIS FUNERAL HOME and submit a certified copy of burial permit. (In the case of a death of a child under ten years of age, an original certificate of death will be required for payment of the benefit).'],
      ['(e)', 'Where the cause of death is accidental, a police abstract and autopsy report must be provided.'],
      ['(f)', 'Wait for up to 72 hours for the claim settlement depending on the level of benefit purchased after full claim documentation.'],
    ],
    coverFor: 'Principal Member, One Spouse, Biological Children, Biological Parents',
    mandatoryDocs: "Principal member's copy of ID and KRA PIN; and spouse's copy of ID.",
    plans: [
      {
        option: 1, name: 'Option 1', premium: 1500, cover: 'KES 5,000',
        hearse: 'Standard hearse', casket: 'Simple casket',
        features: 'Mortuary bill 10 days, Lowering gear + Trolley',
      },
      {
        option: 2, name: 'Option 2', premium: 3000, cover: 'KES 10,000',
        hearse: 'Standard hearse', casket: 'Mexican casket or Odinga quarter casket',
        features: 'Mortuary bill 10 days, Lowering gear + Trolley',
      },
      {
        option: 3, name: 'Option 3', premium: 6000, cover: 'KES 15,000',
        hearse: 'Chariot hearse', casket: 'Hammer casket / Improved hammer / Doom play casket / Saitoti casket',
        features: 'Mortuary bill 14 days, Red carpet, Lowering gear + Trolley',
      },
      {
        option: 4, name: 'Option 4', premium: 9000, cover: 'KES 20,000',
        hearse: 'Chariot hearse', casket: 'Sharon casket / Fidel casket',
        features: 'Mortuary bill 16 days, Automatic lowering gear + Trolley, Picture stand, Red carpet + Grave carpet',
      },
      {
        option: 5, name: 'Option 5', premium: 12000, cover: 'KES 25,000',
        hearse: 'Executive Mercedes Benz hearse', casket: 'Executive casket of choice',
        features: 'Mortuary bill max 30 days, Bouquet of flowers, Automatic lowering gear + Trolley, Picture stand, Red carpet + Grave carpet',
      },
    ],
    extraChildRates: [0, 300, 500, 500, 500, 500],
    parent80Rates: [0, 1000, 2000, 4000, 4000, 4000],
  },
};

function getCompany(key) {
  return COMPANIES[key] || COMPANIES.mlc;
}

function isValidCompany(key) {
  return Object.prototype.hasOwnProperty.call(COMPANIES, key);
}

module.exports = { COMPANIES, getCompany, isValidCompany };
