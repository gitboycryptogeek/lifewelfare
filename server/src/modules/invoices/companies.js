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
