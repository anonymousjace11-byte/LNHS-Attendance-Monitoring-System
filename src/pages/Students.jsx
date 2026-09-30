import { useEffect, useMemo, useState } from 'react';
import { Download, Eye, IdCard, Pencil, Plus, Search, UserX } from 'lucide-react';
import Alert from '../components/Alert';
import Button from '../components/Button';
import FormField from '../components/FormField';
import Modal from '../components/Modal';
import StudentIdCard from '../components/StudentIdCard';
import { useData } from '../context/DataContext';
import { normalizePhilippinePhone } from '../utils/phone';

const STRANDS = ['All Strands', 'STEM', 'ABM', 'HUMSS', 'TVL', 'GAS'];
const EMPTY_FORM = {
  lastName: '', firstName: '', middle: '', studentCode: '', strand: 'STEM',
  sectionId: '', section: '', adviser: '', parentName: '', parentPhone: '', relationship: 'Parent',
};

function nextStudentCode(studentCodes) {
  const prefix = `${new Date().getFullYear()}-`;
  const usedCodes = new Set([...studentCodes].map((code) => String(code || '').trim()));
  let sequence = 1;
  while (usedCodes.has(`${prefix}${String(sequence).padStart(4, '0')}`)) sequence += 1;
  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

function splitStudentName(value) {
  const name = String(value || '').trim();
  if (name.includes(', ')) {
    const [lastName, remainder = ''] = name.split(', ');
    const middleMatch = remainder.match(/\s(\w)\.$/);
    return { lastName, firstName: remainder.replace(/\s\w\.$/, ''), middle: middleMatch?.[1] || '' };
  }
  const parts = name.split(/\s+/).filter(Boolean);
  return { lastName: parts.pop() || '', firstName: parts.join(' '), middle: '' };
}

function validate(form, existing) {
  const errors = {};
  const originalCode = existing ? existing.studentCode || existing.code || existing.id : '';
  if (!form.lastName.trim()) errors.lastName = 'Last name is required.';
  if (!form.firstName.trim()) errors.firstName = 'First name is required.';
  if (!form.studentCode.trim()) errors.studentCode = 'Student code is required.';
  if ((!existing || form.studentCode.trim() !== originalCode) && !/^\d{4}-\d{4}$/.test(form.studentCode.trim())) {
    errors.studentCode = 'Format: YYYY-NNNN (e.g. 2024-0001)';
  }
  if (!form.section) errors.section = 'Section is required.';
  const hasParentDetails = form.parentName.trim() || form.parentPhone.trim();
  if (hasParentDetails) {
    if (!form.parentName.trim()) errors.parentName = 'Parent or guardian name is required.';
    const normalizedPhone = normalizePhilippinePhone(form.parentPhone);
    if (!normalizedPhone) errors.parentPhone = 'Contact number is required.';
    if (normalizedPhone && !/^\+63\d{10}$/.test(normalizedPhone)) errors.parentPhone = 'Format: +63XXXXXXXXXX';
  }
  return errors;
}

function StudentModal({ onClose, onSave, existing, studentCodes, sections, advisers }) {
  const existingSection = existing
    ? sections.find((section) => section.id === existing.sectionId || section.name === existing.section)
    : null;
  const existingName = splitStudentName(existing?.name);
  const [form, setForm] = useState(existing ? {
    lastName: existingName.lastName,
    firstName: existingName.firstName,
    middle: existingName.middle,
    studentCode: existing.studentCode || existing.code || existing.id,
    strand: existing.strand || 'STEM',
    sectionId: existing.sectionId || existingSection?.id || '',
    section: existingSection?.name || existing.section || '',
    adviser: existing.adviser || '',
    parentName: existing.parentName || '',
    parentPhone: String(existing.parentPhone || '').replace(/•{3}/, '0000000'),
    relationship: existing.relationship || 'Parent',
  } : { ...EMPTY_FORM, studentCode: nextStudentCode(studentCodes) });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(existing?.photoUrl || '');

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const handleBlur = (key) => {
    const fieldErrors = validate(form, existing);
    setErrors((current) => ({ ...current, [key]: fieldErrors[key] }));
  };

  const handleSave = async () => {
    const fieldErrors = validate(form, existing);
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors);
      return;
    }
    if (!existing && studentCodes.has(form.studentCode.trim())) {
      setErrors({ studentCode: 'This student code already exists.' });
      return;
    }

    setSaving(true);
    const namePartsUnchanged = existing
      && form.lastName === existingName.lastName
      && form.firstName === existingName.firstName
      && form.middle === existingName.middle;
    const name = namePartsUnchanged
      ? existing.name
      : `${form.lastName}, ${form.firstName}${form.middle ? ` ${form.middle}.` : ''}`;

    try {
      await onSave({
        ...(existing || {}),
        id: existing ? existing.id : form.studentCode.trim(),
        studentCode: form.studentCode.trim(),
        name,
        strand: form.strand,
        sectionId: form.sectionId,
        section: form.section,
        adviser: form.adviser || (existing ? existing.adviser || '' : advisers[0] || ''),
        active: existing ? existing.active !== false : true,
        parentPhone: normalizePhilippinePhone(form.parentPhone),
        parentName: form.parentName,
        ...(existing?.qrValue ? { qrValue: existing.qrValue } : {}),
        ...(existing?.qrUuid ? { qrUuid: existing.qrUuid } : {}),
      }, photoFile);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const input = (key, type = 'text', extra = {}) => (
    <input
      type={type}
      id={key}
      className={`field-input${errors[key] ? ' error' : ''}`}
      value={form[key]}
      onChange={(event) => setField(key, event.target.value)}
      onBlur={() => handleBlur(key)}
      {...extra}
    />
  );

  return (
    <Modal
      title={existing ? 'Edit Student Record' : 'Register New Student'}
      onClose={onClose}
      maxWidth="620px"
      className="student-form-modal"
      footer={(
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
            {existing ? 'Update Student' : 'Register Student'}
          </Button>
        </>
      )}
    >
      <div className="modal-section">
        <div className="modal-section__label">Personal Information</div>
        <div className="student-form-grid student-form-grid--three">
          <FormField label="Last Name" required id="lastName" error={errors.lastName}>{input('lastName', 'text', { placeholder: 'Santos' })}</FormField>
          <FormField label="First Name" required id="firstName" error={errors.firstName}>{input('firstName', 'text', { placeholder: 'Maria' })}</FormField>
          <FormField label="Middle Initial" id="middle">{input('middle', 'text', { placeholder: 'L' })}</FormField>
        </div>
      </div>

      <div className="modal-section">
        <div className="modal-section__label">Enrollment</div>
        <div className="student-form-grid student-form-grid--two">
          <FormField label="Student Code" required id="studentCode" error={errors.studentCode} hint="Format: YYYY-NNNN">
            {input('studentCode', 'text', { placeholder: '2024-0001', style: { fontFamily: 'ui-monospace, monospace' }, readOnly: true })}
          </FormField>
          <FormField label="Strand" id="strand">
            <select id="strand" className="field-input" value={form.strand} onChange={(event) => setField('strand', event.target.value)}>
              {STRANDS.slice(1).map((strand) => <option key={strand}>{strand}</option>)}
            </select>
          </FormField>
          <FormField label="Section" required id="section" error={errors.section}>
            <select id="section" className={`field-input${errors.section ? ' error' : ''}`} value={form.sectionId}
              onChange={(event) => {
                const section = sections.find((item) => item.id === event.target.value);
                setForm((current) => ({ ...current, sectionId: event.target.value, section: section?.name || '' }));
              }}>
              <option value="">Select section...</option>
              {sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
            </select>
          </FormField>
          <FormField label="Adviser" id="adviser">
            <select id="adviser" className="field-input" value={form.adviser} onChange={(event) => setField('adviser', event.target.value)}>
              <option value="">Select adviser...</option>
              {advisers.map((adviser) => <option key={adviser}>{adviser}</option>)}
            </select>
          </FormField>
        </div>
      </div>

      <div className="modal-section">
        <div className="modal-section__label">Student Photo</div>
        <FormField hint="Optional. JPG or PNG, used on the student ID card.">
          <input type="file" accept="image/jpeg,image/png" className="field-input" onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
          }} />
          {photoPreview && <img src={photoPreview} alt="Student preview" className="student-photo-preview" />}
        </FormField>
      </div>

      <div className="modal-section">
        <div className="modal-section__label">Parent / Guardian Contact</div>
        <p className="modal-section__hint">Optional. Add this later from the Parents page.</p>
        <div className="student-form-grid student-form-grid--two">
          <FormField label="Parent / Guardian Name" id="parentName" error={errors.parentName}>{input('parentName', 'text', { placeholder: 'Luisa Santos' })}</FormField>
          <FormField label="Relationship" id="relationship">
            <select id="relationship" className="field-input" value={form.relationship} onChange={(event) => setField('relationship', event.target.value)}>
              {['Parent', 'Guardian', 'Grandparent', 'Sibling', 'Other'].map((relationship) => <option key={relationship}>{relationship}</option>)}
            </select>
          </FormField>
        </div>
        <FormField label="Mobile Number" id="parentPhone" error={errors.parentPhone} hint="Philippine format: +63XXXXXXXXXX" className="student-phone-field">
          {input('parentPhone', 'tel', {
            placeholder: '09XXXXXXXXX or +639XXXXXXXXX',
            style: { fontFamily: 'ui-monospace, monospace' },
            onBlur: () => setField('parentPhone', normalizePhilippinePhone(form.parentPhone)),
          })}
        </FormField>
      </div>
    </Modal>
  );
}

export default function Students() {
  const { students: liveStudents, sections, teachers, parentContacts, saveStudent } = useData();
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [strand, setStrand] = useState('All Strands');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [success, setSuccess] = useState('');
  const [previewStudent, setPreviewStudent] = useState(null);

  useEffect(() => setStudents(liveStudents), [liveStudents]);

  const adviserNames = teachers.map((teacher) => teacher.name).filter(Boolean);
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const parentByStudentId = new Map(parentContacts.map((contact) => [contact.studentId, contact]));
  const studentCodes = useMemo(
    () => new Set(students.flatMap((student) => [student.id, student.studentCode, student.code].filter(Boolean))),
    [students],
  );
  const filtered = useMemo(() => students.filter((student) => {
    const query = search.trim().toLowerCase();
    const name = String(student.name || '').toLowerCase();
    const id = String(student.id || '').toLowerCase();
    return (!query || name.includes(query) || id.includes(query))
      && (strand === 'All Strands' || student.strand === strand);
  }), [students, search, strand]);

  const displayStudentId = (student) => {
    const source = student.studentCode || student.code;
    if (source) {
      const normalized = String(source).replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
      return normalized.startsWith('LNHS-') ? normalized : `LNHS-${normalized}`;
    }
    return `LNHS-${String(student.id).replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase()}`;
  };

  const handleSave = async (data, photoFile) => {
    const updatedStudent = await saveStudent(data, photoFile);
    if (previewStudent?.id === updatedStudent.id) setPreviewStudent(updatedStudent);
    setSuccess(editing ? `${data.name} updated successfully.` : `${data.name} registered successfully.`);
    window.setTimeout(() => setSuccess(''), 4000);
  };

  const handlePreviewPhoto = async (photoFile) => {
    if (!previewStudent) return;
    const updatedStudent = await saveStudent(previewStudent, photoFile);
    setStudents((current) => current.map((student) => student.id === updatedStudent.id ? updatedStudent : student));
    setPreviewStudent(updatedStudent);
    setSuccess('Student photo saved to the live record.');
    window.setTimeout(() => setSuccess(''), 4000);
  };

  const handleIdExport = async (student) => {
    await saveStudent({
      ...student,
      idCardGeneratedAt: new Date().toISOString(),
      idCardQrValue: student.qrValue || student.qrUuid || student.studentCode || student.code || student.id,
    });
    setSuccess('Student ID export recorded. The same QR credential will be reused.');
    window.setTimeout(() => setSuccess(''), 4000);
  };

  const toggleActive = async (id) => {
    const student = students.find((item) => item.id === id);
    if (!student) return;
    await saveStudent({ ...student, active: !student.active });
    setSuccess(`${student.name} ${student.active ? 'deactivated' : 'activated'} successfully.`);
    window.setTimeout(() => setSuccess(''), 4000);
  };

  return (
    <div className="animate-fade-in">
      {previewStudent && (
        <Modal title="Student ID Preview" onClose={() => setPreviewStudent(null)} maxWidth="1200px" className="student-id-preview-modal">
          <StudentIdCard student={previewStudent} onPhotoUpload={handlePreviewPhoto}
            onPrint={() => { handleIdExport(previewStudent); window.print(); }}
            onExport={() => handleIdExport(previewStudent)} />
        </Modal>
      )}

      {(showModal || editing) && (
        <StudentModal key={editing?.id || 'new-student'}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={handleSave} existing={editing} studentCodes={studentCodes}
          sections={sections.filter((section) => section.id && section.name)} advisers={adviserNames} />
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-sub">{students.length} registered · {students.filter((student) => student.active).length} active</p>
        </div>
        <div className="page-header__actions">
          <Button variant="ghost" size="sm" type="button" aria-label="Export students"><Download size={13} /> Export</Button>
          <Button variant="primary" size="sm" onClick={() => { setEditing(null); setShowModal(true); }}><Plus size={13} /> Add Student</Button>
        </div>
      </div>

      {success && <Alert type="success" onClose={() => setSuccess('')} className="mb-4">{success}</Alert>}

      <div className="toolbar">
        <label className="toolbar__search">
          <Search size={14} aria-hidden="true" />
          <input className="toolbar__input" placeholder="Search by name or student ID..." value={search}
            onChange={(event) => setSearch(event.target.value)} aria-label="Search students by name or student ID" />
        </label>
        <select className="field-input toolbar__select" value={strand} onChange={(event) => setStrand(event.target.value)} aria-label="Filter by strand">
          {STRANDS.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>

      <div className="card students-table-card">
        <div className="overflow-x-auto">
          <table className="data-table students-table">
            <thead><tr>
              <th>Student ID</th><th>Name</th><th>Strand</th><th>Section</th>
              <th>Adviser</th><th>Parent Contact</th><th>Status</th><th className="right">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((student) => {
                const parent = parentByStudentId.get(student.id);
                return <tr key={student.id}>
                  <td className="mono students-table__id">{displayStudentId(student)}</td>
                  <td><span className="cell-name">{student.name}</span></td>
                  <td><span className="badge badge-navy">{student.strand}</span></td>
                  <td>{student.section || sectionById.get(student.sectionId)?.name || '—'}</td>
                  <td>{student.adviser || sectionById.get(student.sectionId)?.adviser || '—'}</td>
                  <td className="mono students-table__phone">{student.parentPhone || parent?.parentPhone || '—'}</td>
                  <td><span className={`badge ${student.active ? 'badge-active' : 'badge-inactive'}`}>{student.active ? 'Active' : 'Inactive'}</span></td>
                  <td className="right"><div className="row-actions">
                    <Button variant="ghost" size="sm" onClick={() => setEditing({
                      ...student,
                      parentName: student.parentName || parent?.parentName || '',
                      parentPhone: student.parentPhone || parent?.parentPhone || '',
                    })} title="Edit student" aria-label={`Edit ${student.name}`}><Pencil size={12} /> Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => setPreviewStudent(student)} title="Preview ID" aria-label={`Preview ID for ${student.name}`}><Eye size={12} /> Preview ID</Button>
                    <Button variant="primary" size="sm" onClick={() => {
                      handleIdExport(student);
                      setPreviewStudent(student);
                      window.setTimeout(() => window.print(), 150);
                    }} title="Export ID" aria-label={`Export ID for ${student.name}`}><IdCard size={12} /> Export ID</Button>
                    <Button variant={student.active ? 'danger' : 'success'} size="sm" onClick={() => toggleActive(student.id)}
                      title={student.active ? 'Deactivate' : 'Activate'} aria-label={`${student.active ? 'Deactivate' : 'Activate'} ${student.name}`}>
                      <UserX size={12} /> {student.active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div></td>
                </tr>;
              })}
              {!filtered.length && <tr><td colSpan="8" className="empty-row">No students match your search.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="table-footer">Showing {filtered.length} of {students.length} students</div>
      </div>
    </div>
  );
}
