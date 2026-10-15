import { useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import Button from '../components/Button';
import Alert from '../components/Alert';
import { EmptyTableRow } from '../components/EmptyState';
import FormField from '../components/FormField';
import Modal from '../components/Modal';
import { useData } from '../context/DataContext';
import { displayValue } from '../utils/display';
import { normalizePhilippinePhone } from '../utils/phone';

function ParentModal({ onClose, onSave, existing, students }) {
  const [form, setForm] = useState(existing ? { ...existing, parentPhone: normalizePhilippinePhone(existing.parentPhone) } : { studentId: '', parentName: '', parentPhone: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function submit() {
    const parentPhone = normalizePhilippinePhone(form.parentPhone);
    if (!form.studentId || !form.parentName.trim() || !/^\+63\d{10}$/.test(parentPhone)) {
      setError('Select a student, enter a parent name, and use +63XXXXXXXXXX format.');
      return;
    }
    setSaving(true);
    await onSave({ ...form, parentPhone });
    setSaving(false);
    onClose();
  }

  return <Modal title={existing ? 'Edit Parent Contact' : 'Register Parent Contact'} onClose={onClose} maxWidth="480px" footer={<>
    <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
    <Button variant="primary" size="sm" loading={saving} onClick={submit}>{existing ? 'Save Changes' : 'Register Parent'}</Button>
  </>}>
    <div className="space-y-4">
      {error && <Alert type="error">{error}</Alert>}
      <FormField label="Student" required id="parent-student">
        <select id="parent-student" className="field-input" value={form.studentId} onChange={(event) => set('studentId', event.target.value)} disabled={!!existing}>
          <option value="">Select student…</option>
          {students.map((student) => <option key={student.id} value={student.id}>{student.name || '—'} ({student.id})</option>)}
        </select>
      </FormField>
      <FormField label="Parent / Guardian Name" required id="parent-name">
        <input id="parent-name" className="field-input" value={form.parentName} onChange={(event) => set('parentName', event.target.value)} placeholder="Maria Santos" />
      </FormField>
      <FormField label="Mobile Number" required id="parent-phone" hint="Philippine format: +63XXXXXXXXXX">
        <input id="parent-phone" className="field-input" value={form.parentPhone} onChange={(event) => set('parentPhone', event.target.value)} onBlur={() => set('parentPhone', normalizePhilippinePhone(form.parentPhone))} placeholder="09XXXXXXXXX or +639XXXXXXXXX" />
      </FormField>
    </div>
  </Modal>;
}

export default function Parents() {
  const { parentContacts, students, saveParentContact, deleteParentContact } = useData();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [success, setSuccess] = useState('');
  const rows = useMemo(() => parentContacts.map((contact) => ({
    ...contact,
    student: students.find((item) => item.id === contact.studentId),
  })).filter((contact) => {
    const query = search.toLowerCase();
    return !query || contact.parentName?.toLowerCase().includes(query) || contact.student?.name?.toLowerCase().includes(query) || contact.studentId?.toLowerCase().includes(query);
  }), [parentContacts, students, search]);

  async function save(contact) {
    await saveParentContact(contact);
    setSuccess(`${editing?.id ? 'Parent contact updated.' : 'Parent contact saved.'} Attendance notifications will use this contact.`);
    setTimeout(() => setSuccess(''), 4000);
  }

  async function remove(contact) {
    if (!window.confirm(`Remove ${contact.parentName || 'this parent contact'}?`)) return;
    await deleteParentContact(contact.id);
    setSuccess('Parent contact removed.');
    setTimeout(() => setSuccess(''), 4000);
  }

  return <div className="animate-fade-in">
    {editing && <ParentModal key={editing.id || 'new-parent'} onClose={() => setEditing(null)} onSave={save} existing={editing.id ? editing : null} students={students} />}
    <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
      <div><h1 className="page-title">Parents</h1><p className="page-sub">Register the contact used for attendance SMS notifications.</p></div>
      <Button variant="primary" size="sm" onClick={() => setEditing({ studentId: '', parentName: '', parentPhone: '' })}><Plus size={13} /> Register Parent</Button>
    </div>
    {success && <Alert type="success" className="mb-4" onClose={() => setSuccess('')}>{success}</Alert>}
    <div className="relative mb-4" style={{ maxWidth: '340px' }}>
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)', pointerEvents: 'none' }} />
      <input className="field-input pl-9" placeholder="Search parent or student…" value={search} onChange={(event) => setSearch(event.target.value)} />
    </div>
    <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="data-table w-full">
      <thead><tr><th>Student</th><th>Parent / Guardian</th><th>Mobile Number</th><th>Notifications</th><th>Actions</th></tr></thead>
      <tbody>{rows.map((contact) => <tr key={contact.id}>
        <td><div style={{ fontWeight: 600 }}>{displayValue(contact.student?.name)}</div><div style={{ fontFamily: 'JetBrains Mono', fontSize: '.72rem', color: 'var(--text-muted)' }}>{displayValue(contact.studentId)}</div></td>
        <td>{displayValue(contact.parentName)}</td><td style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-sub)' }}>{displayValue(contact.parentPhone)}</td>
        <td><span className="badge badge-active">Enabled</span></td>
        <td><div className="flex gap-1.5"><Button variant="ghost" size="sm" onClick={() => setEditing(contact)} title="Edit parent contact" aria-label="Edit parent contact"><Pencil size={12} /></Button><Button variant="danger" size="sm" onClick={() => remove(contact)} title="Remove parent contact" aria-label="Remove parent contact"><Trash2 size={12} /></Button></div></td>
      </tr>)}{!rows.length && <EmptyTableRow colSpan={5} icon={Users} title={parentContacts.length ? 'No parent contacts match your search.' : 'No parent contacts yet.'} subtitle={parentContacts.length ? 'Try another parent or student name.' : 'Register parent contacts to enable SMS notifications.'} />}</tbody>
    </table></div></div>
  </div>;
}
