const { useState, useEffect } = React;

// ═══════════════ UTILITY FUNCTIONS ═══════════════
const calculateDueDate = (dateStr) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 30);
    return d;
};

const calculateInterest = (amount, rate) =>
    (parseFloat(amount) * parseFloat(rate) / 100).toFixed(2);

// Auto-generate Loan ID like SF-2026-001
const generateLoanId = (existingLoans) => {
    const year = new Date().getFullYear();
    const count = existingLoans.length + 1;
    return `SF-${year}-${String(count).padStart(3, '0')}`;
};

// Get tiered message based on overdue months
const getTieredMessage = (record, status, remainingPrincipal, businessName, formatCurrency, formatDate) => {
    const amt = record.loan.interestAmount;
    const daysOverdue = status.days || 0;
    const monthsOverdue = Math.floor(daysOverdue / 30);
    const loanId = record.loanId || 'N/A';

    const header = `Hello *${record.customer.name}*,\n\nRef: Loan *${loanId}*\nFrom: *${businessName}*\n\n💰 Interest Due: *${formatCurrency(amt)}*\n📅 Due Date: *${formatDate(new Date(record.loan.dueDate))}*\n💳 Remaining Principal: *${formatCurrency(remainingPrincipal)}*`;

    if (status.label !== 'Overdue') {
        // 🟢 Friendly - Not overdue yet
        return `${header}\n\n🟢 *Gentle Reminder*\nYour next interest payment is approaching on *${formatDate(new Date(record.loan.dueDate))}*. Kindly arrange the payment before the due date to maintain a good record.\n\nThank you for your cooperation! 🙏`;
    }
    if (monthsOverdue < 2) {
        // 🟡 Firm - 1 month overdue
        return `${header}\n\n🟡 *Payment Overdue (${daysOverdue} days)*\nYour interest payment is overdue. Please clear the dues at the earliest to avoid further action.\n\nKindly make the payment immediately. Thank you.`;
    }
    if (monthsOverdue < 3) {
        // 🟠 Strong Warning - 2 months overdue
        return `${header}\n\n🟠 *SECOND REMINDER — Urgent*\nYour payment has been overdue for *${daysOverdue} days*. Continued non-payment may result in action against the surety item held as collateral.\n\n⚠️ Please settle your dues IMMEDIATELY to avoid any inconvenience.`;
    }
    // 🔴 Final Notice - 3+ months overdue
    return `${header}\n\n🔴 *FINAL NOTICE*\nYour interest payment has been pending for over *${daysOverdue} days (${monthsOverdue} months)*.\n\n⛔ This is your LAST warning. If the outstanding amount is not settled within *7 days*, we will be compelled to:\n• Initiate recovery proceedings on the surety/collateral item\n• Take appropriate legal action\n\nPlease treat this as URGENT and contact us immediately.`;
};

const formatCurrency = (amt) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt);

const formatDate = (d) =>
    new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);

// Derive a combined payment status from data
const getPaymentStatus = (record) => {
    const principal = parseFloat(record.loan.amount);
    const totalPaid = (record.payments || []).reduce((s, p) => s + parseFloat(p.amount), 0);
    const interestAmt = parseFloat(record.loan.interestAmount);

    if (principal <= 0) return { label: 'Paid', icon: '✅', class: 'status-paid', color: 'var(--success)' };

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(record.loan.dueDate); due.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due - today) / 86400000);

    // Check if any partial payments exist
    const hasPartialPayments = (record.payments || []).length > 0;

    if (diffDays < 0) return { label: 'Overdue', icon: '⚠️', class: 'status-overdue', days: Math.abs(diffDays), color: 'var(--danger)' };
    if (diffDays === 0) return { label: 'Due Today', icon: '🔴', class: 'status-due', days: 0, color: 'var(--warning)' };
    if (diffDays <= 3) return { label: 'Due Soon', icon: '🟡', class: 'status-due', days: diffDays, color: 'var(--warning)' };
    if (hasPartialPayments) return { label: 'Partial', icon: '🟡', class: 'status-partial', days: diffDays, color: '#f59e0b' };
    return { label: 'Pending', icon: '❌', class: 'status-pending', days: diffDays, color: 'var(--text-muted)' };
};

// ═══════════════ QR CODE MODAL (Dynamic UPI) ═══════════════
const QRCodeModal = ({ record, settings, onClose }) => {
    const upiId = settings?.upiId || '';
    const businessName = 'Shaik uddandu bee';
    const amt = record.loan.interestAmount;

    // Build dynamic UPI QR URL
    let qrImgUrl = '';
    if (upiId) {
        const encodedName = encodeURIComponent(businessName);
        const upiLink = `upi://pay?pa=${upiId}&pn=${encodedName}&am=${amt}&cu=INR`;
        qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiLink)}&color=000000&bgcolor=ffffff`;
    }

    const hasCustomQr = !!settings?.storeQrCode;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-panel" style={{ maxWidth: '380px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3><i className="fa-solid fa-qrcode"></i> Scan to Pay</h3>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>

                <div style={{ padding: '1rem' }}>
                    {/* Dynamic QR takes priority when UPI ID is set */}
                    {upiId ? (
                        <>
                            <p style={{ marginBottom: '0.8rem', fontSize: '0.9rem' }}>Scan this QR to pay exactly <strong>{formatCurrency(amt)}</strong> to <strong>{upiId}</strong></p>
                            <div style={{ background: 'white', padding: '15px', borderRadius: '12px', display: 'inline-block', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
                                <img src={qrImgUrl} alt="Dynamic UPI QR" style={{ width: '220px', height: '220px', display: 'block' }} />
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.8rem' }}>Opens PhonePe / Google Pay / Paytm with pre-filled amount</p>
                        </>
                    ) : hasCustomQr ? (
                        <>
                            <p style={{ marginBottom: '1rem' }}>Scan to Pay: <strong>{settings.upiId || 'Store UPI'}</strong></p>
                            <div style={{ background: 'white', padding: '15px', borderRadius: '12px', display: 'inline-block', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
                                <img src={settings.storeQrCode} alt="Store QR" style={{ width: '200px', height: '200px', display: 'block', objectFit: 'contain' }} />
                            </div>
                        </>
                    ) : (
                        <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                            <i className="fa-solid fa-store-slash" style={{ fontSize: '2rem', color: 'var(--text-muted)' }}></i>
                            <p style={{ marginTop: '1rem' }}>No UPI ID configured.</p>
                            <small>Go to Settings and add your UPI ID first.</small>
                        </div>
                    )}

                    <div style={{ marginTop: '1.2rem' }}>
                        <h2 style={{ color: 'var(--primary)', margin: '0', fontSize: '2rem' }}>{formatCurrency(amt)}</h2>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '5px 0 0 0' }}>Interest Due for <strong>{record.customer.name}</strong></p>
                    </div>
                </div>

                <div className="modal-actions">
                    <button type="button" className="btn-cancel" onClick={onClose} style={{ width: '100%' }}>Done</button>
                </div>
            </div>
        </div>
    );
};

// ═══════════════ PAYMENT STATUS MODAL ═══════════════
const PaymentModal = ({ record, onSave, onClose }) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const [type, setType] = useState('interest');
    const [amount, setAmount] = useState(record.loan.interestAmount);
    const [date, setDate] = useState(todayStr);

    useEffect(() => {
        if (type === 'interest') setAmount(record.loan.interestAmount);
        else setAmount('');
    }, [type, record.loan.interestAmount]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(record.id, {
            id: Date.now().toString(),
            date,
            type,
            amount: parseFloat(amount)
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-panel" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3><i className="fa-solid fa-book-open"></i> Update Payment Status</h3>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.35)', color: 'var(--warning)', padding: '12px', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                        <i className="fa-solid fa-triangle-exclamation"></i> <strong>Important:</strong> This only updates your digital record. Confirm you have received the money via QR scan/cash before logging.
                    </div>

                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label>Payment Type</label>
                        <select value={type} onChange={(e) => setType(e.target.value)} required style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '8px', background: 'var(--bg-card)' }}>
                            <option value="interest">Interest Payment</option>
                            <option value="principal">Principal Repayment</option>
                        </select>
                        <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                            {type === 'interest' ? "Advances the due date by 30 days." : "Reduces outstanding principal permanently."}
                        </small>
                    </div>

                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label>Amount Received (₹)</label>
                        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required min="1" step="any" />
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label>Date Received</label>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn-primary" style={{ background: 'var(--success)' }}><i className="fa-solid fa-folder-plus"></i> Confirm & Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ═══════════════ LEDGER MODAL ═══════════════
const LedgerModal = ({ record, onClose }) => {
    const payments = record.payments || [];
    let totalPrincipalPaid = 0;
    let totalInterestPaid = 0;
    payments.forEach(p => {
        if (p.type === 'principal') totalPrincipalPaid += parseFloat(p.amount);
        if (p.type === 'interest') totalInterestPaid += parseFloat(p.amount);
    });

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-panel" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3><i className="fa-solid fa-file-invoice-dollar"></i> Ledger: {record.customer.name}</h3>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>

                <div className="stats-grid" style={{ marginBottom: '1.5rem', gap: '1rem' }}>
                    <div className="stat-card" style={{ padding: '1rem', borderBottom: '3px solid var(--primary)' }}>
                        <div className="stat-info">
                            <h3 style={{ fontSize: '0.75rem' }}>Remaining Principal</h3>
                            <p style={{ fontSize: '1.2rem' }}>{formatCurrency(record.loan.amount)}</p>
                        </div>
                    </div>
                    <div className="stat-card" style={{ padding: '1rem', borderBottom: '3px solid var(--success)' }}>
                        <div className="stat-info">
                            <h3 style={{ fontSize: '0.75rem' }}>Total Principal Paid</h3>
                            <p style={{ fontSize: '1.2rem' }}>{formatCurrency(totalPrincipalPaid)}</p>
                        </div>
                    </div>
                    <div className="stat-card" style={{ padding: '1rem', borderBottom: '3px solid var(--warning)' }}>
                        <div className="stat-info">
                            <h3 style={{ fontSize: '0.75rem' }}>Total Interest Collected</h3>
                            <p style={{ fontSize: '1.2rem' }}>{formatCurrency(totalInterestPaid)}</p>
                        </div>
                    </div>
                </div>

                <div style={{ maxHeight: '300px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    {payments.length === 0 ? (
                        <div className="empty-state" style={{ padding: '2rem' }}>
                            <p>No payments recorded yet.</p>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                            <thead style={{ background: 'rgba(255,255,255,0.05)', position: 'sticky', top: 0 }}>
                                <tr>
                                    <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Date</th>
                                    <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Type</th>
                                    <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...payments].reverse().map(p => (
                                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '12px' }}>{formatDate(new Date(p.date))}</td>
                                        <td style={{ padding: '12px' }}>
                                            <span style={{
                                                padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem',
                                                background: p.type === 'principal' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(52, 211, 153, 0.2)',
                                                color: p.type === 'principal' ? 'var(--primary)' : 'var(--success)'
                                            }}>
                                                {p.type === 'principal' ? 'Principal' : 'Interest'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{formatCurrency(p.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="modal-actions">
                    <button type="button" className="btn-cancel" onClick={onClose} style={{ width: '100%' }}>Close Ledger</button>
                </div>
            </div>
        </div>
    );
};

// ═══════════════ EDIT MODAL ═══════════════
const EditModal = ({ record, onSave, onClose }) => {
    const [form, setForm] = useState({
        name: record.customer.name,
        phone: record.customer.phone,
        address: record.customer.address,
        fatherName: record.customer.fatherName || '',
        altPhone: record.customer.altPhone || '',
        aadhaarNo: record.customer.aadhaarNo || '',
        amount: record.loan.amount,
        interestRate: record.loan.interestRate,
        loanPurpose: record.loan.purpose || 'Personal',
        disbursementMode: record.loan.disbursementMode || 'Cash',
        suretyName: record.surety.name,
        suretyValue: record.surety.value,
        suretyDesc: record.surety.description || ''
    });

    const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(record.id, {
            ...record,
            customer: { name: form.name, phone: form.phone, address: form.address, fatherName: form.fatherName, altPhone: form.altPhone, aadhaarNo: form.aadhaarNo },
            loan: { ...record.loan, amount: form.amount, interestRate: form.interestRate, interestAmount: calculateInterest(form.amount, form.interestRate), purpose: form.loanPurpose, disbursementMode: form.disbursementMode },
            surety: { name: form.suretyName, value: form.suretyValue, description: form.suretyDesc }
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3><i className="fa-solid fa-pen-to-square"></i> Edit Customer</h3>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="form-section">
                        <h4>👤 Customer Details</h4>
                        <div className="form-grid">
                            <div className="form-group"><label>Full Name</label><input type="text" value={form.name} onChange={(e) => handleChange('name', e.target.value)} required /></div>
                            <div className="form-group"><label>Phone Number</label><input type="tel" value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} required /></div>
                            <div className="form-group"><label>Father/Guardian Name</label><input type="text" value={form.fatherName} onChange={(e) => handleChange('fatherName', e.target.value)} placeholder="Optional" /></div>
                            <div className="form-group"><label>Alternate Phone</label><input type="tel" value={form.altPhone} onChange={(e) => handleChange('altPhone', e.target.value)} placeholder="Optional" /></div>
                            <div className="form-group"><label>Aadhaar Number</label><input type="text" value={form.aadhaarNo} onChange={(e) => handleChange('aadhaarNo', e.target.value)} placeholder="12-digit" maxLength="12" /></div>
                            <div className="form-group full-width"><label>Address</label><input type="text" value={form.address} onChange={(e) => handleChange('address', e.target.value)} required /></div>
                        </div>
                    </div>
                    <div className="form-section">
                        <h4>💰 Financial Terms</h4>
                        <div className="form-grid">
                            <div className="form-group"><label>Principal Amount (₹)</label><input type="number" value={form.amount} onChange={(e) => handleChange('amount', e.target.value)} required min="1" /></div>
                            <div className="form-group"><label>Interest Rate (%)</label><input type="number" value={form.interestRate} onChange={(e) => handleChange('interestRate', e.target.value)} required step="0.1" min="0" /></div>
                            <div className="form-group"><label>Loan Purpose</label>
                                <select value={form.loanPurpose} onChange={(e) => handleChange('loanPurpose', e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-card)' }}>
                                    <option value="Gold Loan">Gold Loan</option><option value="Personal">Personal</option><option value="Business">Business</option><option value="Agriculture">Agriculture</option><option value="Other">Other</option>
                                </select></div>
                            <div className="form-group"><label>Disbursement Mode</label>
                                <select value={form.disbursementMode} onChange={(e) => handleChange('disbursementMode', e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-card)' }}>
                                    <option value="Cash">Cash</option><option value="Bank Transfer">Bank Transfer</option><option value="UPI">UPI</option>
                                </select></div>
                        </div>
                    </div>
                    <div className="form-section">
                        <h4>📦 Surety Item</h4>
                        <div className="form-grid">
                            <div className="form-group"><label>Item Name</label><input type="text" value={form.suretyName} onChange={(e) => handleChange('suretyName', e.target.value)} required /></div>
                            <div className="form-group"><label>Est. Value (₹)</label><input type="number" value={form.suretyValue} onChange={(e) => handleChange('suretyValue', e.target.value)} required min="1" /></div>
                            <div className="form-group full-width"><label>Description</label><textarea rows="2" value={form.suretyDesc} onChange={(e) => handleChange('suretyDesc', e.target.value)}></textarea></div>
                        </div>
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn-primary"><i className="fa-solid fa-check"></i> Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ═══════════════ SETTINGS PANEL ═══════════════
const SettingsPanel = ({ settings, setSettings }) => {
    const handleQrUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => setSettings(prev => ({ ...prev, storeQrCode: event.target.result }));
        reader.readAsDataURL(file);
    };

    return (
        <div className="view active-view" style={{ display: 'block' }}>
            <div className="section-box">
                <h3><i className="fa-solid fa-store"></i> Store Settings</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Configure your store details for payment collection via dynamic QR codes.</p>
                <div className="form-grid">
                    <div className="form-group full-width">
                        <label>Your UPI ID (Required for Dynamic QR)</label>
                        <input
                            type="text"
                            value={settings.upiId || ''}
                            onChange={e => setSettings({ ...settings, upiId: e.target.value })}
                            placeholder="e.g. yourname@ybl or 9999999999@upi"
                        />
                        <small style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>This UPI ID will be embedded in every QR code with the exact due amount.</small>
                    </div>
                    <div className="form-group full-width">
                        <label>Upload Backup Shop QR Code (Optional)</label>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                            Upload your PhonePe/GooglePay business QR as a fallback.
                        </p>
                        <div className="file-upload-wrapper">
                            <input type="file" accept="image/*" onChange={handleQrUpload} />
                        </div>
                        {settings.storeQrCode && (
                            <div style={{ marginTop: '1.5rem', background: 'white', padding: '15px', display: 'inline-block', borderRadius: '12px', textAlign: 'center' }}>
                                <p style={{ color: 'black', marginBottom: '10px', fontWeight: 'bold' }}>Active QR:</p>
                                <img src={settings.storeQrCode} alt="Store QR" style={{ width: '150px', height: '150px', objectFit: 'contain' }} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ═══════════════ CUSTOMER CARD ═══════════════
const CustomerCard = ({ record, settings, onPay, onShowQR, onShowLedger, onDelete, onEdit, onViewImage }) => {
    const status = getPaymentStatus(record);
    const isSettled = parseFloat(record.loan.amount) <= 0;

    // Card border highlight
    const alertClass = isSettled ? '' : (status.label === 'Overdue' ? 'alert-overdue' : (status.label === 'Due Today' || status.label === 'Due Soon') ? 'alert-due' : '');

    // Totals
    const totalPrincipalPaid = (record.payments || []).filter(p => p.type === 'principal').reduce((s, p) => s + parseFloat(p.amount), 0);
    const totalInterestPaid = (record.payments || []).filter(p => p.type === 'interest').reduce((s, p) => s + parseFloat(p.amount), 0);
    const remainingPrincipal = parseFloat(record.loan.amount);

    const sendWhatsAppReminder = async () => {
        if (isSettled) return;
        const upiId = settings?.upiId || '';
        const businessName = 'Shaik uddandu bee';
        const amt = record.loan.interestAmount;

        // Build tiered message based on months overdue
        const tieredBody = getTieredMessage(record, status, remainingPrincipal, businessName, formatCurrency, formatDate);

        // Build UPI QR code URL
        let qrLink = '';
        if (upiId) {
            const upiDeepLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(businessName)}&am=${amt}&cu=INR`;
            qrLink = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiDeepLink)}`;
        }

        const msg = `${tieredBody}${qrLink ? `\n\n📱 *Scan or click the QR code below to pay:*\n${qrLink}` : ''}`;

        try {
            let phone = record.customer.phone.replace(/[^0-9]/g, '');
            if (phone.length === 10) phone = '+91' + phone;
            else if (!phone.startsWith('+')) phone = '+' + phone;

            const btn = document.querySelector(`.card-${record.id} .btn-whatsapp`);
            if (btn) {
                const orig = btn.innerHTML;
                btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending...`;
                btn.disabled = true;
                setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 2000);
            }

            const response = await fetch('http://localhost:5000/send-reminder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, message: msg, amount: amt, upiId })
            });

            if (response.ok) alert(`WhatsApp message + QR sent to ${record.customer.name}!`);
            else alert(`Failed to queue message.`);
        } catch (error) {
            // Fallback: open wa.me with the full message including QR link
            const fallbackPhone = record.customer.phone.replace(/[^0-9]/g, '');
            window.open(`https://wa.me/${fallbackPhone}?text=${encodeURIComponent(msg)}`, '_blank');
        }
    };

    return (
        <div className={`customer-card ${alertClass} card-${record.id}`}>
            <div className="card-header">
                <div>
                    <h3>{record.customer.name}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>📞 {record.customer.phone}</p>
                </div>
                <span className={`status-badge ${status.class}`}>
                    {status.icon} {status.label} {status.days > 0 && !isSettled ? `(${status.days}d)` : ''}
                </span>
            </div>

            <div className="card-body">
                {/* Personal & Docs */}
                <div className="info-block">
                    <h4><i className="fa-solid fa-user-shield"></i> Personal & Proofs</h4>
                    {record.loanId && <div className="info-row"><span>Loan ID:</span> <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{record.loanId}</span></div>}
                    {record.customer.fatherName && <div className="info-row"><span>Father/Guardian:</span> <span>{record.customer.fatherName}</span></div>}
                    <div className="info-row"><span>Address:</span> <span>{record.customer.address}</span></div>
                    {record.customer.altPhone && <div className="info-row"><span>Alt Phone:</span> <span>{record.customer.altPhone}</span></div>}
                    {record.customer.aadhaarNo && <div className="info-row"><span>Aadhaar:</span> <span>{record.customer.aadhaarNo}</span></div>}
                    <div className="doc-links">
                        {record.documents?.aadhaar && <span className="doc-badge" onClick={() => onViewImage(record.documents.aadhaar)}><i className="fa-solid fa-file-image"></i> Aadhaar</span>}
                        {record.documents?.pan && <span className="doc-badge" onClick={() => onViewImage(record.documents.pan)}><i className="fa-solid fa-file-image"></i> PAN</span>}
                        {(!record.documents || (!record.documents.aadhaar && !record.documents.pan)) && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No Docs Uploaded</span>}
                    </div>
                </div>

                {/* Loan Details + Payable Summary */}
                <div className="info-block">
                    <h4><i className="fa-solid fa-money-bill-wave"></i> Loan & Payment Summary</h4>
                    <div className="info-row"><span>Remaining Principal:</span> <span style={{ color: isSettled ? 'var(--success)' : 'var(--primary)', fontWeight: 'bold' }}>{formatCurrency(remainingPrincipal)}</span></div>
                    {record.loan.purpose && <div className="info-row"><span>Purpose:</span> <span>{record.loan.purpose}</span></div>}
                    {record.loan.disbursementMode && <div className="info-row"><span>Disbursed Via:</span> <span>{record.loan.disbursementMode}</span></div>}
                    {!isSettled && (
                        <>
                            <div className="info-row"><span>Interest Rate:</span> <span>{record.loan.interestRate}% ({formatCurrency(record.loan.interestAmount)}/cycle)</span></div>
                            <div className="info-row"><span>Date Given:</span> <span>{formatDate(new Date(record.loan.dateGiven))}</span></div>
                            <div className="info-row" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '4px', marginTop: '4px' }}>
                                <span>Due Date:</span> <span style={{ color: status.label === 'Overdue' ? 'var(--danger)' : 'inherit', fontWeight: 'bold' }}>{formatDate(new Date(record.loan.dueDate))}</span>
                            </div>
                        </>
                    )}
                    {/* Paid amounts */}
                    <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                        <div className="info-row"><span>Principal Paid:</span> <span style={{ color: 'var(--success)' }}>{formatCurrency(totalPrincipalPaid)}</span></div>
                        <div className="info-row"><span>Interest Collected:</span> <span style={{ color: 'var(--success)' }}>{formatCurrency(totalInterestPaid)}</span></div>
                    </div>
                </div>

                {/* Surety */}
                <div className="info-block">
                    <h4><i className="fa-solid fa-box"></i> Surety Item</h4>
                    <div className="info-row"><span>Item:</span> <span>{record.surety.name}</span></div>
                    <div className="info-row"><span>Est. Value:</span> <span>{formatCurrency(record.surety.value)}</span></div>
                    {record.documents?.suretyImage && (
                        <div style={{ cursor: 'pointer' }} onClick={() => onViewImage(record.documents.suretyImage)}>
                            <img src={record.documents.suretyImage} className="surety-img" alt="Surety" loading="lazy" />
                            <small style={{ display: 'block', textAlign: 'center', color: 'var(--primary)', marginTop: '4px' }}><i className="fa-solid fa-magnifying-glass-plus"></i> View</small>
                        </div>
                    )}
                </div>
            </div>

            {/* Action Buttons — NO "Pay Now" button */}
            <div className="card-actions">
                <button className="action-btn btn-whatsapp" onClick={sendWhatsAppReminder} disabled={isSettled} style={{ opacity: isSettled ? 0.3 : 1 }} title="Send WhatsApp Reminder + QR">
                    <i className="fa-brands fa-whatsapp"></i> Alert
                </button>
                <button className="action-btn" onClick={() => onShowQR(record)} disabled={isSettled} style={{ background: isSettled ? 'gray' : '#8b5cf6', color: 'white' }} title="Show Dynamic UPI QR">
                    <i className="fa-solid fa-qrcode"></i>
                </button>
                <button className="action-btn" onClick={() => onShowLedger(record)} style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }} title="View Payment Ledger">
                    <i className="fa-solid fa-file-invoice-dollar"></i> Ledger
                </button>
                <button className="action-btn" onClick={() => onPay(record)} disabled={isSettled} style={{ background: isSettled ? 'gray' : 'var(--success)', color: 'white' }} title="Log Received Payment (Manual)">
                    <i className="fa-solid fa-check-double"></i> Update Status
                </button>
                <button className="action-btn" onClick={() => onEdit(record)} style={{ background: 'rgba(129, 140, 248, 0.12)', color: 'var(--primary)' }} title="Edit Customer">
                    <i className="fa-solid fa-pen"></i>
                </button>
                <button className="action-btn" onClick={() => onDelete(record.id)} style={{ background: 'rgba(248, 113, 113, 0.1)', color: 'var(--danger)' }} title="Delete Record">
                    <i className="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    );
};

// ═══════════════ DASHBOARD ═══════════════
const Dashboard = ({ loans, settings, onPay, onShowQR, onShowLedger, onDelete, onEdit, onViewImage }) => {
    let totalPrincipal = 0, expectedInterest = 0;
    let paidCount = 0, pendingCount = 0, partialCount = 0, overdueCount = 0;

    const recentPayments = [];
    loans.forEach(loan => {
        (loan.payments || []).forEach(p => {
            recentPayments.push({ ...p, customerName: loan.customer.name, recordId: loan.id });
        });
    });
    recentPayments.sort((a, b) => new Date(b.date) - new Date(a.date));
    const topRecentPayments = recentPayments.slice(0, 10);

    // Categorise
    const overdueLoans = [], dueLoans = [], pendingLoans = [], partialLoans = [], paidLoans = [];
    loans.forEach(record => {
        const s = getPaymentStatus(record);
        if (s.label === 'Paid') { paidCount++; paidLoans.push(record); }
        else if (s.label === 'Overdue') { overdueCount++; overdueLoans.push(record); totalPrincipal += parseFloat(record.loan.amount); expectedInterest += parseFloat(record.loan.interestAmount); }
        else if (s.label === 'Due Today' || s.label === 'Due Soon') { pendingCount++; dueLoans.push(record); totalPrincipal += parseFloat(record.loan.amount); expectedInterest += parseFloat(record.loan.interestAmount); }
        else if (s.label === 'Partial') { partialCount++; partialLoans.push(record); totalPrincipal += parseFloat(record.loan.amount); expectedInterest += parseFloat(record.loan.interestAmount); }
        else { pendingCount++; pendingLoans.push(record); totalPrincipal += parseFloat(record.loan.amount); expectedInterest += parseFloat(record.loan.interestAmount); }
    });

    const activeCount = overdueCount + pendingCount + partialCount;

    return (
        <div className="view active-view" style={{ display: 'block' }}>
            {/* Stats */}
            <div className="stats-grid">
                <div className="stat-card" style={{ borderBottom: '3px solid var(--primary)' }}>
                    <div className="stat-info">
                        <h3>💼 Total Outstanding</h3>
                        <p>{formatCurrency(totalPrincipal)}</p>
                    </div>
                </div>
                <div className="stat-card" style={{ borderBottom: '3px solid var(--success)' }}>
                    <div className="stat-info">
                        <h3>📈 Expected Interest</h3>
                        <p style={{ color: 'var(--success)' }}>{formatCurrency(expectedInterest)}</p>
                    </div>
                </div>
                <div className="stat-card" style={{ borderBottom: '3px solid var(--warning)' }}>
                    <div className="stat-info">
                        <h3>👥 Active Loans</h3>
                        <p>{activeCount}</p>
                    </div>
                </div>
                <div className="stat-card" style={{ borderBottom: '3px solid var(--success)' }}>
                    <div className="stat-info">
                        <h3>✅ Fully Paid</h3>
                        <p style={{ color: 'var(--success)' }}>{paidCount}</p>
                    </div>
                </div>
                {overdueCount > 0 && (
                    <div className="stat-card" style={{ borderBottom: '3px solid var(--danger)' }}>
                        <div className="stat-info">
                            <h3>🚨 Overdue</h3>
                            <p style={{ color: 'var(--danger)' }}>{overdueCount}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Recent Payments */}
            <div className="section-box mt-4">
                <h3><i className="fa-solid fa-money-bill-transfer"></i> Recent Payments Received</h3>
                <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border)', marginTop: '1rem', overflow: 'hidden' }}>
                    {topRecentPayments.length === 0 ? (
                        <div className="empty-state" style={{ padding: '2rem' }}><p>No payments recorded yet.</p></div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                            <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                                <tr>
                                    <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Date</th>
                                    <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Customer</th>
                                    <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Type</th>
                                    <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topRecentPayments.map(p => (
                                    <tr key={`${p.recordId}-${p.id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '12px' }}>{formatDate(new Date(p.date))}</td>
                                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{p.customerName}</td>
                                        <td style={{ padding: '12px' }}>
                                            <span style={{
                                                padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem',
                                                background: p.type === 'principal' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(52, 211, 153, 0.2)',
                                                color: p.type === 'principal' ? 'var(--primary)' : 'var(--success)'
                                            }}>
                                                {p.type === 'principal' ? 'Principal' : 'Interest'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{formatCurrency(p.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* ⚠️ Overdue Section */}
            {overdueLoans.length > 0 && (
                <div className="section-box mt-4">
                    <h3 style={{ color: 'var(--danger)' }}><i className="fa-solid fa-triangle-exclamation"></i> ⚠️ Overdue Customers</h3>
                    <div className="customer-grid">
                        {overdueLoans.map(r => <CustomerCard key={r.id} record={r} settings={settings} onPay={onPay} onShowQR={onShowQR} onShowLedger={onShowLedger} onDelete={onDelete} onEdit={onEdit} onViewImage={onViewImage} />)}
                    </div>
                </div>
            )}

            {/* 🟡 Due Soon / Today */}
            {dueLoans.length > 0 && (
                <div className="section-box mt-4">
                    <h3 style={{ color: 'var(--warning)' }}><i className="fa-solid fa-clock"></i> Due Today / Due Soon</h3>
                    <div className="customer-grid">
                        {dueLoans.map(r => <CustomerCard key={r.id} record={r} settings={settings} onPay={onPay} onShowQR={onShowQR} onShowLedger={onShowLedger} onDelete={onDelete} onEdit={onEdit} onViewImage={onViewImage} />)}
                    </div>
                </div>
            )}

            {/* ❌ Pending */}
            {(pendingLoans.length > 0 || partialLoans.length > 0) && (
                <div className="section-box mt-4">
                    <h3><i className="fa-solid fa-hourglass-half"></i> ❌ Pending & Partial Payments</h3>
                    <div className="customer-grid">
                        {[...partialLoans, ...pendingLoans].map(r => <CustomerCard key={r.id} record={r} settings={settings} onPay={onPay} onShowQR={onShowQR} onShowLedger={onShowLedger} onDelete={onDelete} onEdit={onEdit} onViewImage={onViewImage} />)}
                    </div>
                </div>
            )}

            {/* ✅ Paid */}
            {paidLoans.length > 0 && (
                <div className="section-box mt-4">
                    <h3 style={{ color: 'var(--success)' }}><i className="fa-solid fa-circle-check"></i> ✅ Fully Paid / Settled</h3>
                    <div className="customer-grid">
                        {paidLoans.map(r => <CustomerCard key={r.id} record={r} settings={settings} onPay={onPay} onShowQR={onShowQR} onShowLedger={onShowLedger} onDelete={onDelete} onEdit={onEdit} onViewImage={onViewImage} />)}
                    </div>
                </div>
            )}

            {loans.length === 0 && (
                <div className="section-box mt-4">
                    <div className="empty-state">
                        <i className="fa-solid fa-folder-open"></i>
                        No records yet. Add your first loan from the sidebar.
                    </div>
                </div>
            )}
        </div>
    );
};

// ═══════════════ ADD LOAN FORM ═══════════════
const AddLoanForm = ({ onSubmit }) => {
    const today = new Date().toISOString().split('T')[0];
    const [docs, setDocs] = useState({ aadhaar: null, pan: null, suretyImage: null });

    const handleFileChange = (e, docType) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 500;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                setDocs(prev => ({ ...prev, [docType]: canvas.toDataURL('image/jpeg', 0.6) }));
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const loanDateStr = fd.get('loanDate');
        const dueDate = calculateDueDate(loanDateStr);

        onSubmit({
            id: Date.now().toString(),
            customer: {
                name: fd.get('custName'), phone: fd.get('custPhone'), address: fd.get('custAddress'),
                fatherName: fd.get('fatherName') || '', altPhone: fd.get('altPhone') || '', aadhaarNo: fd.get('aadhaarNo') || ''
            },
            loan: {
                amount: fd.get('loanAmount'),
                interestRate: fd.get('loanInterest'),
                dateGiven: loanDateStr,
                dueDate: dueDate.toISOString(),
                interestAmount: calculateInterest(fd.get('loanAmount'), fd.get('loanInterest')),
                purpose: fd.get('loanPurpose') || 'Personal',
                disbursementMode: fd.get('disbursementMode') || 'Cash'
            },
            surety: { name: fd.get('suretyName'), value: fd.get('suretyValue'), description: fd.get('suretyDesc') },
            documents: docs,
            createdAt: new Date().toISOString()
        });
    };

    return (
        <div className="view active-view" style={{ display: 'block' }}>
            <div className="section-box">
                <form className="loan-form" onSubmit={handleSubmit}>
                    <div className="form-section">
                        <h4>👤 Customer Details & Proofs</h4>
                        <div className="form-grid">
                            <div className="form-group"><label>Full Name</label><input name="custName" type="text" required placeholder="John Doe" /></div>
                            <div className="form-group"><label>Phone Number</label><input name="custPhone" type="tel" required placeholder="91XXXXXXXXXX" /></div>
                            <div className="form-group"><label>Father/Guardian Name</label><input name="fatherName" type="text" placeholder="Optional" /></div>
                            <div className="form-group"><label>Alternate Phone</label><input name="altPhone" type="tel" placeholder="Optional" /></div>
                            <div className="form-group"><label>Aadhaar Number</label><input name="aadhaarNo" type="text" placeholder="12-digit number" maxLength="12" /></div>
                            <div className="form-group full-width"><label>Address</label><input name="custAddress" type="text" required placeholder="Home Address" /></div>
                            <div className="form-group"><label>Aadhaar Card Image (Optional)</label><div className="file-upload-wrapper"><input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'aadhaar')} /></div></div>
                            <div className="form-group"><label>PAN Card Image (Optional)</label><div className="file-upload-wrapper"><input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'pan')} /></div></div>
                        </div>
                    </div>
                    <div className="form-section">
                        <h4>💰 Financial Terms</h4>
                        <div className="form-grid">
                            <div className="form-group"><label>Principal Amount (₹)</label><input name="loanAmount" type="number" required min="1" placeholder="10000" /></div>
                            <div className="form-group"><label>Interest Rate (% per 30 Days)</label><input name="loanInterest" type="number" required step="0.1" min="0" placeholder="2.5" /></div>
                            <div className="form-group"><label>Date Given</label><input name="loanDate" type="date" required defaultValue={today} /></div>
                            <div className="form-group"><label>Payment Cycle</label><input type="text" value="30 Days Active Cycle" disabled className="disabled-input" /></div>
                            <div className="form-group"><label>Loan Purpose</label>
                                <select name="loanPurpose" style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-card)' }}>
                                    <option value="Gold Loan">Gold Loan</option><option value="Personal">Personal</option><option value="Business">Business</option><option value="Agriculture">Agriculture</option><option value="Other">Other</option>
                                </select></div>
                            <div className="form-group"><label>Disbursement Mode</label>
                                <select name="disbursementMode" style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-card)' }}>
                                    <option value="Cash">Cash</option><option value="Bank Transfer">Bank Transfer</option><option value="UPI">UPI</option>
                                </select></div>
                        </div>
                    </div>
                    <div className="form-section">
                        <h4>📦 Surety Item Assurance</h4>
                        <div className="form-grid">
                            <div className="form-group"><label>Item Name</label><input name="suretyName" type="text" required placeholder="E.g., Gold Chain 20g" /></div>
                            <div className="form-group"><label>Estimated Value (₹)</label><input name="suretyValue" type="number" required min="1" placeholder="50000" /></div>
                            <div className="form-group full-width"><label>Description / Marking Details</label><textarea name="suretyDesc" rows="2" placeholder="Brand, condition, weight..."></textarea></div>
                            <div className="form-group full-width"><label>Upload Surety Image</label><div className="file-upload-wrapper"><input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'suretyImage')} /></div></div>
                        </div>
                    </div>
                    <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" className="btn-primary"><i className="fa-solid fa-cloud-arrow-up"></i> Save Full Record</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ═══════════════ ALL CUSTOMERS ═══════════════
const CustomerList = ({ loans, settings, onPay, onShowQR, onShowLedger, onDelete, onEdit, onViewImage }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const filteredLoans = loans.filter(r =>
        r.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.customer.phone.includes(searchTerm)
    );

    return (
        <div className="view active-view" style={{ display: 'block' }}>
            <div className="section-box">
                <div className="flex-between">
                    <h3><i className="fa-solid fa-address-book"></i> Complete Database</h3>
                    <input type="text" className="search-input" placeholder="Search by name or phone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                {filteredLoans.length === 0 ? (
                    <div className="empty-state mt-4"><i className="fa-solid fa-folder-open"></i>No records matched.</div>
                ) : (
                    <div className="customer-grid">
                        {[...filteredLoans].reverse().map(r => <CustomerCard key={r.id} record={r} settings={settings} onPay={onPay} onShowQR={onShowQR} onShowLedger={onShowLedger} onDelete={onDelete} onEdit={onEdit} onViewImage={onViewImage} />)}
                    </div>
                )}
            </div>
        </div>
    );
};

// ═══════════════ EMI CALCULATOR + AMORTIZATION ═══════════════
const EMICalculator = () => {
    const [principal, setPrincipal] = useState('');
    const [rate, setRate] = useState('');
    const [tenure, setTenure] = useState('');
    const [result, setResult] = useState(null);

    const calculate = (e) => {
        e.preventDefault();
        const P = parseFloat(principal);
        const monthly_r = parseFloat(rate) / 100;
        const n = parseInt(tenure);
        if (!P || !monthly_r || !n) return;

        const emi = P * monthly_r * Math.pow(1 + monthly_r, n) / (Math.pow(1 + monthly_r, n) - 1);
        const totalPayable = emi * n;
        const totalInterest = totalPayable - P;

        const schedule = [];
        let balance = P;
        for (let m = 1; m <= n; m++) {
            const interestPortion = balance * monthly_r;
            const principalPortion = emi - interestPortion;
            balance = Math.max(0, balance - principalPortion);
            schedule.push({
                month: m,
                emi: emi.toFixed(2),
                interest: interestPortion.toFixed(2),
                principal: principalPortion.toFixed(2),
                balance: balance.toFixed(2)
            });
        }
        setResult({ emi, totalPayable, totalInterest, schedule });
    };

    return (
        <div className="view active-view" style={{ display: 'block' }}>
            <div className="section-box">
                <h3><i className="fa-solid fa-calculator"></i> EMI Calculator</h3>
                <form onSubmit={calculate}>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Principal Amount (₹)</label>
                            <input type="number" value={principal} onChange={e => setPrincipal(e.target.value)} required min="1" placeholder="50000" />
                        </div>
                        <div className="form-group">
                            <label>Interest Rate (% per Month)</label>
                            <input type="number" value={rate} onChange={e => setRate(e.target.value)} required step="0.01" min="0.01" placeholder="2" />
                        </div>
                        <div className="form-group">
                            <label>Tenure (Months)</label>
                            <input type="number" value={tenure} onChange={e => setTenure(e.target.value)} required min="1" max="120" placeholder="12" />
                        </div>
                        <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <button type="submit" className="btn-primary" style={{ width: '100%' }}><i className="fa-solid fa-calculator"></i> Calculate EMI</button>
                        </div>
                    </div>
                </form>
            </div>

            {result && (
                <>
                    <div className="stats-grid" style={{ marginTop: '2rem' }}>
                        <div className="stat-card" style={{ borderBottom: '3px solid var(--primary)' }}>
                            <div className="stat-info">
                                <h3>📅 Monthly EMI</h3>
                                <p style={{ color: 'var(--primary)' }}>{formatCurrency(result.emi)}</p>
                            </div>
                        </div>
                        <div className="stat-card" style={{ borderBottom: '3px solid var(--warning)' }}>
                            <div className="stat-info">
                                <h3>💰 Total Payable</h3>
                                <p style={{ color: 'var(--warning)' }}>{formatCurrency(result.totalPayable)}</p>
                            </div>
                        </div>
                        <div className="stat-card" style={{ borderBottom: '3px solid var(--danger)' }}>
                            <div className="stat-info">
                                <h3>📈 Total Interest</h3>
                                <p style={{ color: 'var(--danger)' }}>{formatCurrency(result.totalInterest)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="section-box" style={{ marginTop: '1.5rem' }}>
                        <h3><i className="fa-solid fa-chart-bar"></i> Interest vs Principal Ratio</h3>
                        <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', height: '36px', background: 'rgba(0,0,0,0.3)' }}>
                            <div style={{ width: `${(parseFloat(principal) / result.totalPayable * 100)}%`, background: 'linear-gradient(90deg, var(--primary), #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'white', minWidth: '60px' }}>
                                Principal {(parseFloat(principal) / result.totalPayable * 100).toFixed(1)}%
                            </div>
                            <div style={{ flex: 1, background: 'linear-gradient(90deg, var(--danger), #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'white', minWidth: '60px' }}>
                                Interest {(result.totalInterest / result.totalPayable * 100).toFixed(1)}%
                            </div>
                        </div>
                    </div>

                    <div className="section-box" style={{ marginTop: '1.5rem' }}>
                        <h3><i className="fa-solid fa-table"></i> Amortization Schedule</h3>
                        <div style={{ maxHeight: '400px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <table className="amort-table">
                                <thead>
                                    <tr>
                                        <th>Month</th>
                                        <th>EMI (₹)</th>
                                        <th>Interest (₹)</th>
                                        <th>Principal (₹)</th>
                                        <th>Balance (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.schedule.map(row => (
                                        <tr key={row.month} style={{ background: row.month % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                                            <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{row.month}</td>
                                            <td>{formatCurrency(row.emi)}</td>
                                            <td style={{ color: 'var(--danger)' }}>{formatCurrency(row.interest)}</td>
                                            <td style={{ color: 'var(--success)' }}>{formatCurrency(row.principal)}</td>
                                            <td style={{ fontWeight: 600 }}>{formatCurrency(row.balance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// ═══════════════ PROFIT & LOSS DASHBOARD ═══════════════
const ProfitLossPanel = ({ loans }) => {
    let totalLent = 0;
    let totalPrincipalRecovered = 0;
    let totalInterestEarned = 0;
    let activeCount = 0;
    let settledCount = 0;
    let overdueCount = 0;

    const customerEarnings = {};
    const monthlyData = {};

    loans.forEach(record => {
        const principalPaid = (record.payments || []).filter(p => p.type === 'principal').reduce((s, p) => s + parseFloat(p.amount), 0);
        const originalPrincipal = parseFloat(record.loan.amount) + principalPaid;
        totalLent += originalPrincipal;

        const interestPaid = (record.payments || []).filter(p => p.type === 'interest').reduce((s, p) => s + parseFloat(p.amount), 0);
        totalPrincipalRecovered += principalPaid;
        totalInterestEarned += interestPaid;

        const status = getPaymentStatus(record);
        if (status.label === 'Paid') settledCount++;
        else if (status.label === 'Overdue') overdueCount++;
        else activeCount++;

        const name = record.customer.name;
        customerEarnings[name] = (customerEarnings[name] || 0) + interestPaid;

        (record.payments || []).forEach(p => {
            const monthKey = p.date ? p.date.substring(0, 7) : 'Unknown';
            if (!monthlyData[monthKey]) monthlyData[monthKey] = { interest: 0, principal: 0 };
            if (p.type === 'interest') monthlyData[monthKey].interest += parseFloat(p.amount);
            if (p.type === 'principal') monthlyData[monthKey].principal += parseFloat(p.amount);
        });
    });

    const totalOutstanding = totalLent - totalPrincipalRecovered;
    const netProfit = totalInterestEarned;
    const collectionRate = totalLent > 0 ? ((totalPrincipalRecovered / totalLent) * 100).toFixed(1) : 0;

    const topCustomers = Object.entries(customerEarnings)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    const maxEarning = topCustomers.length > 0 ? topCustomers[0][1] : 1;

    const monthlyEntries = Object.entries(monthlyData).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
    const maxMonthly = Math.max(...monthlyEntries.map(([, d]) => d.interest + d.principal), 1);

    return (
        <div className="view active-view" style={{ display: 'block' }}>
            <div className="stats-grid">
                <div className="stat-card" style={{ borderBottom: '3px solid var(--primary)' }}>
                    <div className="stat-info">
                        <h3>🏦 Total Money Lent</h3>
                        <p>{formatCurrency(totalLent)}</p>
                    </div>
                </div>
                <div className="stat-card" style={{ borderBottom: '3px solid var(--success)' }}>
                    <div className="stat-info">
                        <h3>💵 Principal Recovered</h3>
                        <p style={{ color: 'var(--success)' }}>{formatCurrency(totalPrincipalRecovered)}</p>
                    </div>
                </div>
                <div className="stat-card" style={{ borderBottom: '3px solid #f59e0b' }}>
                    <div className="stat-info">
                        <h3>📈 Interest Earned</h3>
                        <p style={{ color: '#f59e0b' }}>{formatCurrency(totalInterestEarned)}</p>
                    </div>
                </div>
                <div className="stat-card" style={{ borderBottom: '3px solid var(--danger)' }}>
                    <div className="stat-info">
                        <h3>📊 Outstanding</h3>
                        <p style={{ color: 'var(--danger)' }}>{formatCurrency(totalOutstanding)}</p>
                    </div>
                </div>
            </div>

            <div className="section-box" style={{ marginTop: '2rem' }}>
                <h3><i className="fa-solid fa-sack-dollar"></i> Profit Summary</h3>
                <div className="stats-grid" style={{ gap: '1rem' }}>
                    <div className="stat-card" style={{ borderBottom: '3px solid var(--success)', padding: '1.2rem' }}>
                        <div className="stat-info">
                            <h3>💰 Net Profit (Interest)</h3>
                            <p style={{ color: 'var(--success)', fontSize: '1.8rem' }}>{formatCurrency(netProfit)}</p>
                        </div>
                    </div>
                    <div className="stat-card" style={{ borderBottom: '3px solid var(--primary)', padding: '1.2rem' }}>
                        <div className="stat-info">
                            <h3>📊 Collection Rate</h3>
                            <p style={{ fontSize: '1.8rem' }}>{collectionRate}%</p>
                            <div style={{ marginTop: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', height: '10px', overflow: 'hidden' }}>
                                <div style={{ width: `${collectionRate}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--success))', borderRadius: '6px', transition: 'width 1s ease' }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                    <div className="pl-status-chip" style={{ background: 'rgba(52, 211, 153, 0.12)', borderColor: 'rgba(52, 211, 153, 0.3)' }}>
                        <span style={{ fontSize: '1.5rem' }}>✅</span>
                        <div><strong style={{ fontSize: '1.3rem' }}>{settledCount}</strong><br /><small style={{ color: 'var(--text-muted)' }}>Settled</small></div>
                    </div>
                    <div className="pl-status-chip" style={{ background: 'rgba(129, 140, 248, 0.12)', borderColor: 'rgba(129, 140, 248, 0.3)' }}>
                        <span style={{ fontSize: '1.5rem' }}>📋</span>
                        <div><strong style={{ fontSize: '1.3rem' }}>{activeCount}</strong><br /><small style={{ color: 'var(--text-muted)' }}>Active</small></div>
                    </div>
                    <div className="pl-status-chip" style={{ background: 'rgba(248, 113, 113, 0.12)', borderColor: 'rgba(248, 113, 113, 0.3)' }}>
                        <span style={{ fontSize: '1.5rem' }}>🚨</span>
                        <div><strong style={{ fontSize: '1.3rem' }}>{overdueCount}</strong><br /><small style={{ color: 'var(--text-muted)' }}>Overdue</small></div>
                    </div>
                </div>
            </div>

            {monthlyEntries.length > 0 && (
                <div className="section-box" style={{ marginTop: '1.5rem' }}>
                    <h3><i className="fa-solid fa-chart-column"></i> Monthly Collections (Last 6 Months)</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {monthlyEntries.map(([month, data]) => {
                            const total = data.interest + data.principal;
                            const pct = (total / maxMonthly * 100).toFixed(0);
                            return (
                                <div key={month} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ minWidth: '80px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>{month}</span>
                                    <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', borderRadius: '6px', height: '28px', overflow: 'hidden', position: 'relative' }}>
                                        <div style={{ width: `${data.principal / total * pct}%`, height: '100%', background: 'var(--primary)', position: 'absolute', left: 0, top: 0, borderRadius: '6px 0 0 6px' }}></div>
                                        <div style={{ width: `${pct}%`, height: '100%', background: 'rgba(52, 211, 153, 0.6)', borderRadius: '6px', display: 'flex', alignItems: 'center', paddingLeft: '8px' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'white' }}>{formatCurrency(total)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            <span><span style={{ display: 'inline-block', width: '12px', height: '12px', background: 'var(--primary)', borderRadius: '3px', marginRight: '6px' }}></span>Principal</span>
                            <span><span style={{ display: 'inline-block', width: '12px', height: '12px', background: 'rgba(52, 211, 153, 0.6)', borderRadius: '3px', marginRight: '6px' }}></span>Interest</span>
                        </div>
                    </div>
                </div>
            )}

            {topCustomers.length > 0 && (
                <div className="section-box" style={{ marginTop: '1.5rem' }}>
                    <h3><i className="fa-solid fa-trophy"></i> Top 5 Interest-Earning Customers</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {topCustomers.map(([name, earned], idx) => (
                            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800, background: idx === 0 ? 'linear-gradient(135deg, #f59e0b, #d97706)' : idx === 1 ? 'linear-gradient(135deg, #94a3b8, #64748b)' : idx === 2 ? 'linear-gradient(135deg, #cd7f32, #a0522d)' : 'rgba(255,255,255,0.1)', color: 'white' }}>
                                    {idx + 1}
                                </span>
                                <span style={{ flex: 1, fontWeight: 600 }}>{name}</span>
                                <div style={{ flex: 2, background: 'rgba(0,0,0,0.3)', borderRadius: '6px', height: '22px', overflow: 'hidden' }}>
                                    <div style={{ width: `${(earned / maxEarning * 100)}%`, height: '100%', background: 'linear-gradient(90deg, var(--success), #10b981)', borderRadius: '6px', display: 'flex', alignItems: 'center', paddingLeft: '8px' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'white' }}>{formatCurrency(earned)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {loans.length === 0 && (
                <div className="section-box" style={{ marginTop: '2rem' }}>
                    <div className="empty-state">
                        <i className="fa-solid fa-chart-line"></i>
                        No loan data yet. Add loans to see your financial analytics.
                    </div>
                </div>
            )}
        </div>
    );
};

// ═══════════════ RECEIPT MODAL ═══════════════
const ReceiptModal = ({ record, payment, onClose }) => {
    const receiptNo = `RCT-${new Date().getFullYear()}-${payment.id.slice(-6)}`;
    const remainingPrincipal = parseFloat(record.loan.amount);
    const businessName = 'Shaik uddandu bee';

    const receiptText = `🧾 *PAYMENT RECEIPT*\n━━━━━━━━━━━━━━━━━━\nReceipt No: *${receiptNo}*\nDate: *${formatDate(new Date(payment.date))}*\n\n👤 Customer: *${record.customer.name}*\n📞 Phone: ${record.customer.phone}\n\n💳 Payment Type: *${payment.type === 'interest' ? 'Interest' : 'Principal Repayment'}*\n💰 Amount Paid: *${formatCurrency(payment.amount)}*\n\n📊 Remaining Principal: *${formatCurrency(remainingPrincipal)}*\n━━━━━━━━━━━━━━━━━━\n✅ Payment received successfully.\n\nFrom: *${businessName}*\nThank you for your payment! 🙏`;

    const handlePrint = () => {
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        printWindow.document.write(`
            <html><head><title>Receipt - ${receiptNo}</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; max-width: 350px; margin: 0 auto; color: #1a1a2e; }
                .receipt-box { border: 2px solid #1a1a2e; border-radius: 8px; padding: 20px; }
                .header { text-align: center; border-bottom: 2px dashed #ccc; padding-bottom: 15px; margin-bottom: 15px; }
                .header h2 { margin: 0; font-size: 1.3rem; }
                .header p { margin: 5px 0 0; color: #666; font-size: 0.85rem; }
                .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 0.9rem; }
                .row .label { color: #666; }
                .row .value { font-weight: bold; }
                .divider { border-top: 1px dashed #ccc; margin: 12px 0; }
                .total { font-size: 1.3rem; text-align: center; padding: 15px 0; border-top: 2px dashed #ccc; border-bottom: 2px dashed #ccc; margin: 15px 0; }
                .total .amount { color: #16a34a; font-weight: 800; font-size: 1.5rem; }
                .footer { text-align: center; font-size: 0.8rem; color: #999; margin-top: 15px; }
                .stamp { display: inline-block; border: 3px solid #16a34a; color: #16a34a; padding: 6px 18px; border-radius: 8px; font-weight: 800; font-size: 1rem; transform: rotate(-5deg); margin: 15px auto; text-align: center; }
            </style></head><body>
            <div class="receipt-box">
                <div class="header">
                    <h2>🏦 ${businessName}</h2>
                    <p>Payment Receipt</p>
                </div>
                <div class="row"><span class="label">Receipt No:</span><span class="value">${receiptNo}</span></div>
                <div class="row"><span class="label">Date:</span><span class="value">${formatDate(new Date(payment.date))}</span></div>
                <div class="divider"></div>
                <div class="row"><span class="label">Customer:</span><span class="value">${record.customer.name}</span></div>
                <div class="row"><span class="label">Phone:</span><span class="value">${record.customer.phone}</span></div>
                <div class="divider"></div>
                <div class="row"><span class="label">Payment Type:</span><span class="value">${payment.type === 'interest' ? 'Interest' : 'Principal'}</span></div>
                <div class="total">Amount Paid<br/><span class="amount">${formatCurrency(payment.amount)}</span></div>
                <div class="row"><span class="label">Remaining Principal:</span><span class="value">${formatCurrency(remainingPrincipal)}</span></div>
                <div style="text-align: center; margin-top: 20px;"><div class="stamp">✅ PAID</div></div>
                <div class="footer">
                    <p>Thank you for your payment!</p>
                    <p>Generated on ${formatDate(new Date())}</p>
                </div>
            </div>
            <script>setTimeout(() => { window.print(); }, 500);</script>
            </body></html>
        `);
        printWindow.document.close();
    };

    const handleWhatsApp = () => {
        const phone = record.customer.phone.replace(/[^0-9]/g, '');
        const fullPhone = phone.length === 10 ? '91' + phone : phone;
        window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(receiptText)}`, '_blank');
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-panel" style={{ maxWidth: '440px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3><i className="fa-solid fa-receipt"></i> Payment Receipt</h3>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>

                <div style={{ padding: '1rem' }}>
                    <div style={{ background: 'linear-gradient(145deg, #1a2340, #0f1528)', border: '1px solid var(--border-light)', borderRadius: '16px', padding: '1.5rem', textAlign: 'left' }}>
                        <div style={{ textAlign: 'center', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px dashed rgba(255,255,255,0.1)' }}>
                            <i className="fa-solid fa-building-columns" style={{ fontSize: '1.5rem', color: 'var(--primary)', marginBottom: '6px' }}></i>
                            <h4 style={{ color: 'var(--primary)', margin: 0 }}>{businessName}</h4>
                            <small style={{ color: 'var(--text-muted)' }}>Payment Receipt</small>
                        </div>

                        <div className="info-row"><span>Receipt No:</span><span style={{ color: 'var(--primary)', fontWeight: 700 }}>{receiptNo}</span></div>
                        <div className="info-row"><span>Date:</span><span>{formatDate(new Date(payment.date))}</span></div>
                        <div style={{ borderTop: '1px dashed rgba(255,255,255,0.08)', margin: '8px 0' }}></div>
                        <div className="info-row"><span>Customer:</span><span>{record.customer.name}</span></div>
                        <div className="info-row"><span>Phone:</span><span>{record.customer.phone}</span></div>
                        <div style={{ borderTop: '1px dashed rgba(255,255,255,0.08)', margin: '8px 0' }}></div>
                        <div className="info-row"><span>Type:</span><span>
                            <span style={{ padding: '3px 10px', borderRadius: '4px', fontSize: '0.8rem', background: payment.type === 'principal' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(52, 211, 153, 0.2)', color: payment.type === 'principal' ? 'var(--primary)' : 'var(--success)' }}>
                                {payment.type === 'principal' ? 'Principal' : 'Interest'}
                            </span>
                        </span></div>

                        <div style={{ textAlign: 'center', padding: '1rem 0', margin: '10px 0', borderTop: '1px dashed rgba(255,255,255,0.1)', borderBottom: '1px dashed rgba(255,255,255,0.1)' }}>
                            <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Amount Paid</small>
                            <h2 style={{ color: 'var(--success)', margin: 0, fontSize: '2rem' }}>{formatCurrency(payment.amount)}</h2>
                        </div>

                        <div className="info-row"><span>Remaining Principal:</span><span style={{ fontWeight: 700 }}>{formatCurrency(remainingPrincipal)}</span></div>

                        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                            <span style={{ display: 'inline-block', border: '2px solid var(--success)', color: 'var(--success)', padding: '4px 16px', borderRadius: '6px', fontWeight: 800, fontSize: '0.9rem', transform: 'rotate(-3deg)' }}>✅ PAID</span>
                        </div>
                    </div>
                </div>

                <div className="modal-actions" style={{ gap: '8px' }}>
                    <button type="button" className="action-btn btn-whatsapp" onClick={handleWhatsApp} style={{ flex: 1 }}>
                        <i className="fa-brands fa-whatsapp"></i> Share via WhatsApp
                    </button>
                    <button type="button" className="btn-primary" onClick={handlePrint} style={{ flex: 1 }}>
                        <i className="fa-solid fa-print"></i> Print Receipt
                    </button>
                </div>
                <div style={{ padding: '0 1rem 0.5rem' }}>
                    <button type="button" className="btn-cancel" onClick={onClose} style={{ width: '100%', marginTop: '8px' }}>Close</button>
                </div>
            </div>
        </div>
    );
};

// ═══════════════ SIDEBAR ═══════════════
const Sidebar = ({ activeTab, setActiveTab }) => {
    const tabs = [
        { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard' },
        { id: 'add-loan', icon: 'fa-plus-circle', label: 'Add Loan & Docs' },
        { id: 'customers', icon: 'fa-users', label: 'All Customers' },
        { id: 'emi-calc', icon: 'fa-calculator', label: 'EMI Calculator' },
        { id: 'profit-loss', icon: 'fa-sack-dollar', label: 'Profit & Loss' },
        { id: 'settings', icon: 'fa-store', label: 'Store Settings' }
    ];

    return (
        <aside className="sidebar">
            <div className="logo">
                <i className="fa-solid fa-building-columns"></i>
                <h2>SmartFinance</h2>
            </div>
            <nav>
                {tabs.map(tab => (
                    <button key={tab.id} className={`nav-btn ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                        <i className={`fa-solid ${tab.icon}`}></i> {tab.label}
                    </button>
                ))}
            </nav>
        </aside>
    );
};

// ═══════════════ APP ═══════════════
const App = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [loans, setLoans] = useState(() => {
        const saved = localStorage.getItem('smartFinanceLoansV2');
        return saved ? JSON.parse(saved) : [];
    });
    const [settings, setSettings] = useState(() => {
        const saved = localStorage.getItem('smartFinanceSettingsV1');
        return saved ? JSON.parse(saved) : { storeQrCode: null, upiId: '' };
    });

    const [toast, setToast] = useState({ show: false, message: '' });
    const [viewImage, setViewImage] = useState(null);
    const [editingRecord, setEditingRecord] = useState(null);
    const [payingRecord, setPayingRecord] = useState(null);
    const [ledgerRecord, setLedgerRecord] = useState(null);
    const [qrRecord, setQrRecord] = useState(null);
    const [receiptData, setReceiptData] = useState(null);

    useEffect(() => { localStorage.setItem('smartFinanceLoansV2', JSON.stringify(loans)); }, [loans]);
    useEffect(() => { localStorage.setItem('smartFinanceSettingsV1', JSON.stringify(settings)); }, [settings]);

    const showToast = (msg) => {
        setToast({ show: true, message: msg });
        setTimeout(() => setToast({ show: false, message: '' }), 3000);
    };

    const handleAddLoan = (newLoan) => {
        setLoans([...loans, { ...newLoan, payments: [] }]);
        showToast('✅ Loan Record Saved!');
        setActiveTab('dashboard');
    };

    const handleDeleteRow = (id) => {
        if (window.confirm('Permanently delete this loan record?')) {
            setLoans(loans.filter(l => l.id !== id));
            showToast('🗑️ Record Deleted.');
        }
    };

    const handleEditSave = (id, updated) => {
        setLoans(loans.map(l => l.id === id ? updated : l));
        setEditingRecord(null);
        showToast('✏️ Details Updated!');
    };

    const handleRecordPayment = (id, paymentData) => {
        let updatedRecord = null;
        setLoans(loans.map(loan => {
            if (loan.id === id) {
                const newPayments = [...(loan.payments || []), paymentData];
                let updatedLoan = { ...loan.loan };

                if (paymentData.type === 'principal') {
                    updatedLoan.amount = Math.max(0, updatedLoan.amount - paymentData.amount);
                    updatedLoan.interestAmount = calculateInterest(updatedLoan.amount, updatedLoan.interestRate);
                } else if (paymentData.type === 'interest') {
                    updatedLoan.dueDate = calculateDueDate(paymentData.date).toISOString();
                }

                updatedRecord = { ...loan, payments: newPayments, loan: updatedLoan };
                return updatedRecord;
            }
            return loan;
        }));
        setPayingRecord(null);
        showToast(`💰 ${paymentData.type === 'interest' ? 'Interest' : 'Principal'} Payment Status Updated!`);
        // Auto-show receipt
        if (updatedRecord) {
            setReceiptData({ record: updatedRecord, payment: paymentData });
        }
    };

    return (
        <div className="app-container">
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
            <main className="main-content">
                <header className="top-header">
                    <div className="greeting">
                        <h1>{activeTab === 'dashboard' ? '📊 Overview Dashboard' : activeTab === 'add-loan' ? '➕ New Loan Entry' : activeTab === 'emi-calc' ? '🧮 EMI Calculator' : activeTab === 'profit-loss' ? '📈 Profit & Loss' : activeTab === 'settings' ? '🏪 Store Settings' : '👥 Customer Database'}</h1>
                        <p>{activeTab === 'dashboard' ? "Real-time overview with payment status tracking." : activeTab === 'add-loan' ? "Add new customer loans with documents." : activeTab === 'emi-calc' ? "Calculate EMI and view full amortization schedule." : activeTab === 'profit-loss' ? "Complete financial analytics and profit tracking." : activeTab === 'settings' ? "Configure UPI ID for dynamic QR generation." : "Search and manage all customer records."}</p>
                    </div>
                </header>

                {activeTab === 'dashboard' && <Dashboard loans={loans} settings={settings} onPay={setPayingRecord} onShowQR={setQrRecord} onShowLedger={setLedgerRecord} onDelete={handleDeleteRow} onEdit={setEditingRecord} onViewImage={setViewImage} />}
                {activeTab === 'add-loan' && <AddLoanForm onSubmit={handleAddLoan} />}
                {activeTab === 'customers' && <CustomerList loans={loans} settings={settings} onPay={setPayingRecord} onShowQR={setQrRecord} onShowLedger={setLedgerRecord} onDelete={handleDeleteRow} onEdit={setEditingRecord} onViewImage={setViewImage} />}
                {activeTab === 'emi-calc' && <EMICalculator />}
                {activeTab === 'profit-loss' && <ProfitLossPanel loans={loans} />}
                {activeTab === 'settings' && <SettingsPanel settings={settings} setSettings={setSettings} />}
            </main>

            <div className={`toast ${toast.show ? '' : 'hidden'}`}>{toast.message}</div>

            {viewImage && (
                <div className="image-modal" onClick={() => setViewImage(null)}>
                    <button className="close-modal" onClick={() => setViewImage(null)}>&times;</button>
                    <img src={viewImage} alt="Document" onClick={(e) => e.stopPropagation()} />
                </div>
            )}
            {editingRecord && <EditModal record={editingRecord} onSave={handleEditSave} onClose={() => setEditingRecord(null)} />}
            {payingRecord && <PaymentModal record={payingRecord} onSave={handleRecordPayment} onClose={() => setPayingRecord(null)} />}
            {ledgerRecord && <LedgerModal record={ledgerRecord} onClose={() => setLedgerRecord(null)} />}
            {qrRecord && <QRCodeModal record={qrRecord} settings={settings} onClose={() => setQrRecord(null)} />}
            {receiptData && <ReceiptModal record={receiptData.record} payment={receiptData.payment} onClose={() => setReceiptData(null)} />}
        </div>
    );
};

// Mount
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
