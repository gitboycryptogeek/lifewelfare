import { INVOICE_COMPANIES, getInvoiceCompany } from '../utils/invoiceCompanies';

// Top-level switcher choosing which company the invoice is issued by
export default function InvoiceCompanyTabs({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-6">
      {Object.values(INVOICE_COMPANIES).map((c) => {
        const active = value === c.key;
        const activeCls = c.key === 'francis'
          ? 'border-[#E8501E] bg-[#FFF6F1] ring-2 ring-[#E8501E]/30'
          : 'border-brand-gold bg-brand-gold/10 ring-2 ring-brand-gold/30';
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(c.key)}
            className={`flex items-center gap-3 rounded-xl border px-3 sm:px-4 py-3 text-left transition-colors ${active ? activeCls : 'border-gray-200 bg-white hover:bg-gray-50'}`}
          >
            {c.logo ? (
              <img src={c.logo} alt="" className="h-9 w-14 object-contain shrink-0 hidden sm:block" />
            ) : (
              <span className="h-9 w-9 rounded-full bg-brand-navy text-brand-gold text-[10px] font-bold items-center justify-center shrink-0 hidden sm:flex">MLC</span>
            )}
            <div className="min-w-0">
              <p className={`font-heading font-bold text-sm sm:text-base truncate ${active ? 'text-brand-navy' : 'text-gray-600'}`}>{c.shortName}</p>
              <p className="text-xs text-gray-400 truncate">{c.tagline}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Brand heading shown at the top of the dark invoice preview panel
export function InvoicePreviewBrand({ company }) {
  const c = getInvoiceCompany(company);
  return (
    <div className="flex items-center gap-3 mb-5">
      {c.logo && (
        <div className="bg-white rounded-lg p-1 shrink-0">
          <img src={c.logo} alt="" className="h-10 w-16 object-contain" />
        </div>
      )}
      <div>
        <p className={`font-heading font-bold text-base mb-0.5 ${c.key === 'francis' ? 'text-[#F47B4F]' : 'text-brand-gold'}`}>{c.name}</p>
        <p className="text-xs text-gray-400">{c.tagline}</p>
      </div>
    </div>
  );
}

// Francis Funeral plan benefits shown in the preview panel
export function InvoicePlanBenefits({ plan }) {
  if (!plan?.hearse) return null;
  return (
    <div className="mt-3 bg-white/10 rounded-lg p-3 text-xs space-y-1">
      <p className="text-gray-400 uppercase tracking-wide font-semibold mb-1">What's included</p>
      <p><span className="text-gray-400">Hearse:</span> {plan.hearse}</p>
      <p><span className="text-gray-400">Casket:</span> {plan.casket}</p>
      <p><span className="text-gray-400">Extras:</span> {plan.features}</p>
    </div>
  );
}

export function previewPanelBg(company) {
  return company === 'francis' ? 'bg-[#2B1A17]' : 'bg-brand-navy';
}
