import { useState, useEffect } from 'react';
import { Search, Plus, Pencil, CheckCircle } from 'lucide-react';
import Button from '../components/Button';
import Modal from '../components/Modal';
import FormField from '../components/FormField';
import Alert from '../components/Alert';
import { useData } from '../context/DataContext';

function emailValid(v) { return /^[^\s@]+@lnhs\.edu\.ph$/i.test(v.trim()); }

function TeacherModal({ onClose, onSave, existing, sections }) {
  const [form, setForm] = useState(existing ? {
    name: existing.name, email: existing.email, strand: existing.strand,
    sectionId: existing.sectionId || '', approved: existing.approved, password: '', confirmPassword: '',
  } : { name: '', email: '', strand: 'STEM', sectionId: '', approved: true, password: '', confirmPassword: '' });
  const [errs, setErrs]     = useState({});
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.name.trim())         e.name  = 'Full name is required.';
    if ((!existing || form.email.trim().toLowerCase() !== existing.email.trim().toLowerCase()) && !emailValid(form.email)) {
      e.email = 'Must be a valid @lnhs.edu.ph address.';
    }
    if (!existing && form.password.length < 6) e.password = 'Password must be at least 6 characters.';
    if (form.password && form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.';
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrs(e); return; }
    setSaving(true);
    await onSave({ ...form, uid: existing?.uid });
    setSaving(false);
    onClose();
  };

  return (
    <Modal title={existing ? 'Edit Teacher Account' : 'Add Teacher Account'} onClose={onClose} maxWidth="480px"
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
          {existing ? 'Save Changes' : 'Create Account'}
        </Button>
      </>}>
      <div className="space-y-4">
        <FormField label="Full Name" required id="name" error={errs.name}>
          <input id="name" className={`field-input${errs.name?' error':''}`} placeholder="Juan dela Cruz"
            value={form.name} onChange={(e)=>set('name',e.target.value)} onBlur={()=>setErrs(p=>({...p,name:validate().name}))} />
        </FormField>
        <FormField label="School Email" required id="email" error={errs.email} hint="Must end in @lnhs.edu.ph">
          <input id="email" type="email" className={`field-input${errs.email?' error':''}`} placeholder="j.delacruz@lnhs.edu.ph"
            value={form.email} onChange={(e)=>set('email',e.target.value)} onBlur={()=>setErrs(p=>({...p,email:validate().email}))} disabled={!!existing} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={existing ? 'New Password (optional)' : 'Password'} required={!existing} id="teacher-password" error={errs.password} hint="At least 6 characters. Stored securely in Firebase Authentication.">
            <input id="teacher-password" type="password" className={`field-input${errs.password?' error':''}`} value={form.password} onChange={(e)=>set('password',e.target.value)} autoComplete="new-password" />
          </FormField>
          <FormField label="Confirm Password" required={!existing} id="teacher-confirm-password" error={errs.confirmPassword}>
            <input id="teacher-confirm-password" type="password" className={`field-input${errs.confirmPassword?' error':''}`} value={form.confirmPassword} onChange={(e)=>set('confirmPassword',e.target.value)} autoComplete="new-password" />
          </FormField>
        </div>
        <FormField label="Strand" id="strand">
          <select id="strand" className="field-input" value={form.strand} onChange={(e)=>set('strand',e.target.value)}>
            {['STEM','ABM','HUMSS','TVL','GAS'].map(s=><option key={s}>{s}</option>)}
          </select>
        </FormField>
        <FormField label="Assigned Section" id="teacher-section">
          <select id="teacher-section" className="field-input" value={form.sectionId} onChange={(e)=>set('sectionId',e.target.value)}>
            <option value="">No section assigned</option>
            {sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
          </select>
        </FormField>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="approved" checked={form.approved}
            onChange={(e)=>set('approved',e.target.checked)} style={{ accentColor: 'var(--navy-800)', width:16, height:16 }} />
          <label htmlFor="approved" style={{ fontFamily:'Work Sans', fontWeight:600, fontSize:'.875rem', color:'var(--navy-800)', cursor:'pointer' }}>
            Mark as approved immediately
          </label>
        </div>
        {!existing && (
          <Alert type="warn">
            A Firebase Authentication account will be created with this password. Passwords are never stored in Firestore.
          </Alert>
        )}
      </div>
    </Modal>
  );
}

export default function Teachers() {
  const { teachers: liveTeachers, sections, saveTeacher } = useData();
  const [teachers, setTeachers]   = useState([]);
  const [search, setSearch]       = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [success, setSuccess]     = useState('');

  useEffect(() => setTeachers(liveTeachers), [liveTeachers]);

  const filtered = teachers.filter((t) => {
    const q = search.toLowerCase();
    return !q || t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q);
  });
  const sectionNameById = new Map(sections.map((section) => [section.id, section.name]));

  const handleSave = async (data) => {
    await saveTeacher(data);
    setSuccess(`${data.name} ${editing?'updated':'created'} successfully.`);
    setTimeout(() => setSuccess(''), 4000);
  };

  const approve = async (uid) => {
    const teacher = teachers.find((item) => item.uid === uid);
    if (!teacher) return;
    await saveTeacher({ ...teacher, approved: true });
    setSuccess('Teacher approved. Role claims will be assigned by the backend.');
    setTimeout(() => setSuccess(''), 4000);
  };

  return (
    <div className="animate-fade-in">
      {(showModal || editing) && (
        <TeacherModal
          key={editing?.uid || 'new-teacher'}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={handleSave}
          existing={editing}
          sections={sections}
        />
      )}

      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Teachers</h1>
          <p className="page-sub">{teachers.length} accounts · {teachers.filter(t=>t.approved).length} approved</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => { setEditing(null); setShowModal(true); }}>
          <Plus size={13} /> Add Teacher
        </Button>
      </div>

      {success && <Alert type="success" onClose={() => setSuccess('')} className="mb-4">{success}</Alert>}

      <div className="relative mb-4" style={{ maxWidth: '340px' }}>
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--text-muted)', pointerEvents:'none' }} />
        <input className="field-input pl-9" placeholder="Search by name or email…" value={search} onChange={(e)=>setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Strand</th>
                <th>Assigned Sections</th>
                <th>Approval</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.uid}>
                  <td>
                    <div style={{ fontWeight:600, color:'var(--text-main)' }}>{t.name}</div>
                    <div style={{ fontFamily:'JetBrains Mono', fontSize:'.7rem', color:'var(--text-muted)' }}>{t.uid}</div>
                  </td>
                  <td style={{ fontFamily:'JetBrains Mono', fontSize:'.8rem', color:'var(--text-sub)' }}>{t.email}</td>
                  <td><span className="badge badge-navy">{t.strand}</span></td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {(t.sections || (t.sectionId ? [t.sectionId] : [])).map((sec) => (
                        <span key={sec} style={{ fontSize:'.74rem', background:'#f0f4f8', color:'var(--text-sub)', border:'1px solid var(--border)', borderRadius:'3px', padding:'1px 6px' }}>
                          {sectionNameById.get(sec) || sec}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${t.approved ? 'badge-approved' : 'badge-pending'}`}>
                      {t.approved ? 'Approved' : 'Pending'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>
                        <Pencil size={12} /> Edit
                      </Button>
                      {!t.approved && (
                        <Button variant="success" size="sm" onClick={() => approve(t.uid)}>
                          <CheckCircle size={12} /> Approve
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
