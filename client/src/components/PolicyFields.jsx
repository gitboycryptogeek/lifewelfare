import { MdAdd, MdDelete, MdDescription } from 'react-icons/md';

export const MAX_DEPENDANTS = 13;
const RELATIONSHIPS = ['Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Father-in-law', 'Mother-in-law'];

export function emptyDependant() {
  return { _id: Math.random(), name: '', relationship: '' };
}

// Strip UI-only keys and empty rows before sending to the API
export function cleanDependants(rows) {
  return rows
    .filter((d) => d.name.trim())
    .map(({ name, relationship }) => ({ name: name.trim(), relationship }));
}

export function dependantsFromInvoice(inv) {
  return Array.isArray(inv?.dependants)
    ? inv.dependants.map((d) => ({ ...emptyDependant(), ...d }))
    : [];
}

const input = 'w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8501E]/40';

// Policy number + dependants editor for Francis Funeral policy documents
export default function PolicyFields({ policyNumber, onPolicyNumberChange, dependants, onDependantsChange }) {
  function update(id, field, value) {
    onDependantsChange(dependants.map((d) => (d._id === id ? { ...d, [field]: value } : d)));
  }

  return (
    <div className="border border-[#E8501E]/30 bg-[#FFF6F1] rounded-lg p-3 space-y-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-[#C55A11] uppercase tracking-wide">
        <MdDescription size={15} /> Policy Document
      </p>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Policy Number</label>
        <input
          type="text"
          value={policyNumber}
          onChange={(e) => onPolicyNumberChange(e.target.value)}
          placeholder="Auto-generated if left blank (e.g. FFH-POL-2026-00001)"
          className={input}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-gray-700">Dependants <span className="text-xs text-gray-400">({dependants.length}/{MAX_DEPENDANTS})</span></label>
          <button
            type="button"
            onClick={() => onDependantsChange([...dependants, emptyDependant()])}
            disabled={dependants.length >= MAX_DEPENDANTS}
            className="flex items-center gap-1 text-xs font-semibold text-[#C55A11] hover:text-[#E8501E] disabled:opacity-40"
          >
            <MdAdd size={15} /> Add Dependant
          </button>
        </div>
        {dependants.length === 0 && (
          <p className="text-xs text-gray-400">No dependants added. Blank rows will be printed for filling by hand.</p>
        )}
        <div className="space-y-2">
          {dependants.map((d, i) => (
            <div key={d._id} className="bg-white border border-gray-100 rounded-lg p-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}</span>
                <input type="text" value={d.name} onChange={(e) => update(d._id, 'name', e.target.value)} placeholder="Full name" className={input} />
                <input list="policy-relationships" value={d.relationship} onChange={(e) => update(d._id, 'relationship', e.target.value)} placeholder="Relationship" className={`${input} max-w-[38%]`} />
                <button type="button" onClick={() => onDependantsChange(dependants.filter((x) => x._id !== d._id))} className="p-1.5 rounded hover:bg-red-50 text-red-400 shrink-0">
                  <MdDelete size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <datalist id="policy-relationships">
          {RELATIONSHIPS.map((r) => <option key={r} value={r} />)}
        </datalist>
      </div>
    </div>
  );
}
