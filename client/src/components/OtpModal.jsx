import { useRef, useState, useEffect } from 'react';
import { MdClose } from 'react-icons/md';

export default function OtpModal({
  isOpen,
  title,
  description,
  onSubmit,
  onClose,
  onResend,
  isLoading = false,
  error = null,
}) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(60);
  const inputRefs = useRef([]);

  // Reset digits and start resend countdown when modal opens
  useEffect(() => {
    if (isOpen) {
      setDigits(['', '', '', '', '', '']);
      setResendCooldown(60);
      // Auto-focus first input after a short delay
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [isOpen]);

  // Resend countdown timer
  useEffect(() => {
    if (!isOpen || resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [isOpen, resendCooldown]);

  if (!isOpen) return null;

  function handleChange(index, value) {
    // Allow only a single digit
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      handleSubmit();
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  }

  function handleSubmit() {
    const code = digits.join('');
    if (code.length === 6) onSubmit(code);
  }

  function handleResend() {
    setDigits(['', '', '', '', '', '']);
    setResendCooldown(60);
    onResend?.();
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-heading text-lg font-bold text-brand-navy">{title}</h2>
            {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 ml-4 flex-shrink-0"
          >
            <MdClose size={20} />
          </button>
        </div>

        {/* 6-digit input row */}
        <div className="flex gap-2 justify-center my-6" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={`w-11 h-14 text-center text-2xl font-bold border-2 rounded-xl outline-none transition-colors
                ${d ? 'border-brand-navy text-brand-navy' : 'border-gray-200 text-gray-400'}
                focus:border-brand-gold`}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-500 text-sm text-center mb-4">{error}</p>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={isLoading || digits.join('').length < 6}
          className="btn-primary w-full text-center"
        >
          {isLoading ? 'Verifying…' : 'Verify Code'}
        </button>

        {/* Resend */}
        {onResend && (
          <p className="text-center text-sm text-gray-500 mt-4">
            Didn't receive the code?{' '}
            {resendCooldown > 0 ? (
              <span className="text-gray-400">Resend in {resendCooldown}s</span>
            ) : (
              <button
                onClick={handleResend}
                className="text-brand-gold hover:underline font-medium"
              >
                Resend OTP
              </button>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
