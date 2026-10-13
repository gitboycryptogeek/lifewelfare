// True when the invoice comes with a Francis Funeral policy document
export function invoiceHasPolicy(inv) {
  return inv?.company === 'francis' && (!!inv.cover_option || Array.isArray(inv.group_members));
}

async function downloadFile(path, filename) {
  const token = localStorage.getItem('token');
  const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('Failed to download PDF');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Invoice PDF; Francis plan invoices also include the policy document pages
export function downloadPdf(inv) {
  const withPolicy = invoiceHasPolicy(inv);
  return downloadFile(
    `/api/v1/invoices/${inv.id}/pdf${withPolicy ? '?policy=1' : ''}`,
    `${withPolicy ? 'invoice-policy' : 'invoice'}-${inv.invoice_number}.pdf`,
  );
}

// Policy document only
export function downloadPolicyPdf(inv) {
  return downloadFile(`/api/v1/invoices/${inv.id}/policy`, `policy-${inv.policy_number || inv.invoice_number}.pdf`);
}
