import { useEffect, useMemo, useState } from 'react';
import { Download, Eye, IdCard, Pencil, Plus, Search, Trash2, UserX, Users } from 'lucide-react';
import Alert from '../components/Alert';
import Button from '../components/Button';
import { EmptyTableRow } from '../components/EmptyState';
import FormField from '../components/FormField';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import StudentIdCard from '../components/StudentIdCard';
import PageCover from '../components/PageCover';
import SortableHeader, { sortRows } from '../components/SortableHeader';
import { useData } from '../context/DataContext';
import { downloadCsv } from '../utils/csvExport';
import { displayValue } from '../utils/display';
import { isValidPhilippineMobile, normalizePhilippinePhone } from '../utils/phone';

const TRACK_OPTIONS = ['Academic Track', 'Tech Pro Track'];
const TRACK_STRANDS = {
  'Academic Track': ['HUMSS', 'STEM', 'ABM'],
  'Tech Pro Track': ['TVL', 'Electrical', 'Carpentry'],
};
const TRACK_SECTIONS = {
  'HUMSS': ['Socrates', 'Plato', 'Confusious'],
  'STEM': ['Euler', 'Gaus'],
  'ABM': ['Dirham'],
  'TVL': ['Muffin', 'Champagne', 'Cinnamon'],
  'Electrical': ['Watts'],
  'Carpentry': ['Hammer'],
};
const SECTION_NAME_ALIASES = {
  HUMSS: ['socrates', 'plato', 'confusious', 'confucious'],
  STEM: ['euler', 'gaus', 'gauss'],
  ABM: ['dirham'],
  TVL: ['muffin', 'champagne', 'cinnamon'],
  Electrical: ['watts'],
  Carpentry: ['hammer'],
};
const PAGE_SIZE = 10;
const EMPTY_FORM = {
  lastName: '', firstName: '', middle: '', studentCode: '', track: 'Academic Track', strand: 'HUMSS',
  gender: '', sectionId: '', section: '', adviser: '', parentName: '', parentPhone: '', relationship: 'Parent',
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

function sectionMatchesCourse(section, course) {
  const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (section.strand && TRACK_SECTIONS[section.strand]) return section.strand === course;
  const normalizedName = normalize(section.name);
  return SECTION_NAME_ALIASES[course]?.some((alias) => normalizedName.includes(normalize(alias))) || false;
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
  if (!['Male', 'Female'].includes(form.gender)) errors.gender = 'Select a gender.';
  if (!form.section) errors.section = 'Section is required.';
  if (!form.parentName.trim()) errors.parentName = 'Parent or guardian name is required.';
  const normalizedPhone = normalizePhilippinePhone(form.parentPhone);
  if (!normalizedPhone) errors.parentPhone = 'Contact number is required.';
  if (normalizedPhone && !isValidPhilippineMobile(normalizedPhone)) errors.parentPhone = 'Enter a valid Philippine mobile number, such as +639171234567.';
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
    track: existing.track || (['TVL', 'Electrical', 'Carpentry'].includes(existing.strand) ? 'Tech Pro Track' : 'Academic Track'),
    strand: existing.strand || 'HUMSS',
    gender: existing.gender || '',
    sectionId: existing.sectionId || existingSection?.id || '',
    section: existingSection?.name || existing.section || '',
    adviser: existing.adviser || '',
    parentName: existing.parentName || '',
    parentPhone: String(existing.parentPhone || '').replace(/•{3}/, '0000000'),
    relationship: existing.relationship || 'Parent',
  } : { ...EMPTY_FORM, studentCode: nextStudentCode(studentCodes) });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(existing?.photoUrl || '');
  const courseSections = sections.filter((section) => sectionMatchesCourse(section, form.strand));
  const sectionChoices = courseSections.length
    ? courseSections
    : (TRACK_SECTIONS[form.strand] || []).map((name) => ({ id: name, name, strand: form.strand }));
  const availableSectionChoices = form.section && !sectionChoices.some((item) => item.name === form.section)
    ? [{ id: form.sectionId || form.section, name: form.section, strand: form.strand }, ...sectionChoices]
    : sectionChoices;

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
    setSaveError('');
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
        track: form.track,
        strand: form.strand,
        gender: form.gender,
        sectionId: form.sectionId,
        section: form.section,
        adviser: form.adviser || (existing ? existing.adviser || '' : advisers[0] || ''),
        active: existing ? existing.active !== false : true,
        parentPhone: normalizePhilippinePhone(form.parentPhone),
        parentName: form.parentName,
        relationship: form.relationship,
        ...(existing?.qrValue ? { qrValue: existing.qrValue } : {}),
        ...(existing?.qrUuid ? { qrUuid: existing.qrUuid } : {}),
      }, photoFile);
      onClose();
    } catch (error) {
      setSaveError(error.message || 'Unable to save the student record.');
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
      portal
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
          <FormField label="Last Name" required id="lastName" error={errors.lastName}>{input('lastName', 'text', { placeholder: 'e.g. Dela Cruz' })}</FormField>
          <FormField label="First Name" required id="firstName" error={errors.firstName}>{input('firstName', 'text', { placeholder: 'e.g. Juan' })}</FormField>
          <FormField label="Middle Initial" id="middle">{input('middle', 'text', { placeholder: 'e.g. A' })}</FormField>
        </div>
      </div>

      <div className="modal-section">
        <div className="modal-section__label">Enrollment</div>
        <div className="student-form-grid student-form-grid--two">
          <FormField label="Student Code" required id="studentCode" error={errors.studentCode} hint="Format: YYYY-NNNN">
            {input('studentCode', 'text', { placeholder: 'e.g. 2026-0001', style: { fontFamily: 'ui-monospace, monospace' }, readOnly: true })}
          </FormField>
          <FormField label="Gender" required id="gender" error={errors.gender}>
            <select id="gender" required aria-required="true" className={`field-input${errors.gender ? ' error' : ''}`} value={form.gender} onChange={(event) => setField('gender', event.target.value)}>
              <option value="">Select gender...</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </FormField>
          <FormField label="Track" id="track">
            <select id="track" className="field-input" value={form.track} onChange={(event) => {
              const track = event.target.value;
              const strand = TRACK_STRANDS[track][0];
              setForm((current) => ({ ...current, track, strand, sectionId: '', section: '' }));
            }}>
              {TRACK_OPTIONS.map((track) => <option key={track}>{track}</option>)}
            </select>
          </FormField>
          <FormField label="Strand / Course" id="strand">
            <select id="strand" className="field-input" value={form.strand} onChange={(event) => {
              setForm((current) => ({ ...current, strand: event.target.value, sectionId: '', section: '' }));
            }}>
              {!TRACK_STRANDS[form.track].includes(form.strand) && <option value={form.strand}>{form.strand}</option>}
              {TRACK_STRANDS[form.track].map((strand) => <option key={strand}>{strand}</option>)}
            </select>
          </FormField>
          <FormField label="Section" required id="section" error={errors.section}>
            <select id="section" className={`field-input${errors.section ? ' error' : ''}`} value={form.sectionId}
              onChange={(event) => {
                const selectedSection = sectionChoices.find((item) => item.id === event.target.value);
                setForm((current) => ({ ...current, sectionId: event.target.value, section: selectedSection?.name || '' }));
              }}>
              <option value="">Select section...</option>
              {availableSectionChoices.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
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
        {saveError && <Alert type="error">{saveError}</Alert>}
        <FormField hint="Optional. JPG or PNG, used on the student ID card.">
          <input type="file" accept="image/jpeg,image/png" className="field-input" onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (!['image/jpeg', 'image/png'].includes(file.type)) {
              setSaveError('Choose a JPG or PNG photo.');
              setPhotoFile(null);
              return;
            }
            if (file.size > 7 * 1024 * 1024) {
              setSaveError('Student photos must be smaller than 7 MB.');
              setPhotoFile(null);
              return;
            }
            setSaveError('');
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
          }} />
          {photoPreview && <img src={photoPreview} alt="Student preview" className="student-photo-preview" />}
        </FormField>
      </div>

      <div className="modal-section">
        <div className="modal-section__label">Parent / Guardian Contact</div>
        <p className="modal-section__hint">Required. In case of emergency, contact this parent or guardian.</p>
        <div className="student-form-grid student-form-grid--two">
          <FormField label="Parent / Guardian (Emergency Contact)" required id="parentName" error={errors.parentName}>{input('parentName', 'text', { placeholder: 'e.g. Maria Santos', required: true, 'aria-required': 'true' })}</FormField>
          <FormField label="Relationship" id="relationship">
            <select id="relationship" className="field-input" value={form.relationship} onChange={(event) => setField('relationship', event.target.value)}>
              {['Parent', 'Guardian', 'Grandparent', 'Sibling', 'Other'].map((relationship) => <option key={relationship}>{relationship}</option>)}
            </select>
          </FormField>
        </div>
        <FormField label="Emergency Contact Number" required id="parentPhone" error={errors.parentPhone} hint="Required · Philippine format: +63XXXXXXXXXX" className="student-phone-field">
          {input('parentPhone', 'tel', {
            placeholder: 'e.g. 09XXXXXXXXX or +639XXXXXXXXX',
            required: true,
            'aria-required': 'true',
            inputMode: 'tel',
            style: { fontFamily: 'ui-monospace, monospace' },
          })}
        </FormField>
      </div>
    </Modal>
  );
}

function StudentDeleteModal({ student, onClose, onConfirm, loading, error }) {
  return (
    <Modal title="Delete Student" onClose={onClose} maxWidth="440px" portal
      footer={(
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="destructive" size="sm" loading={loading} onClick={onConfirm}>
            <Trash2 size={13} /> Delete Student
          </Button>
        </>
      )}>
      <div className="student-delete-confirmation">
        <p>Delete <strong>{student.name}</strong> ({student.studentCode || student.code || student.id})?</p>
        <p>Parent contact and active QR credentials will be removed. Attendance and SMS history will be kept.</p>
        {error && <Alert type="error">{error}</Alert>}
      </div>
    </Modal>
  );
}

export default function Students() {
  const { students: liveStudents, sections, teachers, parentContacts, saveStudent, deleteStudent, generateStudentQr } = useData();
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [track, setTrack] = useState('All Tracks');
  const [course, setCourse] = useState('All Courses');
  const [section, setSection] = useState('All Sections');
  const [sortColumn, setSortColumn] = useState('studentId');
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [success, setSuccess] = useState('');
  const [idError, setIdError] = useState('');
  const [previewStudent, setPreviewStudent] = useState(null);
  const [exportIdWhenReady, setExportIdWhenReady] = useState(false);

  const exportStudents = () => {
    const headers = ['Student ID', 'Name', 'Track', 'Strand / Course', 'Section', 'Adviser', 'Parent / Guardian', 'Parent Phone', 'Gender', 'Status'];
    const rows = sortedStudents.map((student) => {
      const parent = parentByStudentId.get(student.id);
      const section = student.section || sectionById.get(student.sectionId)?.name || '';
      return [
        displayValue(student.studentCode || student.code || student.id),
        displayValue(student.name),
        displayValue(student.track || (['TVL', 'Electrical', 'Carpentry'].includes(student.strand) ? 'Tech Pro Track' : 'Academic Track')),
        displayValue(student.strand),
        displayValue(section),
        displayValue(student.adviser || sectionById.get(student.sectionId)?.adviser),
        displayValue(parent?.parentName || student.parentName),
        displayValue(parent?.parentPhone || student.parentPhone),
        displayValue(student.gender),
        student.active === false ? 'Inactive' : 'Active',
      ];
    });
    downloadCsv([headers, ...rows], 'students.csv');
  };
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => setStudents(liveStudents), [liveStudents]);

  const adviserNames = teachers.map((teacher) => teacher.name).filter(Boolean);
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const parentByStudentId = new Map(parentContacts.map((contact) => [contact.studentId, contact]));
  const studentCodes = useMemo(
    () => new Set(students.flatMap((student) => [student.id, student.studentCode, student.code].filter(Boolean))),
    [students],
  );
  const sectionOptions = useMemo(() => ['All Sections', ...Array.from(new Set(
    sections.filter((item) => course === 'All Courses' || sectionMatchesCourse(item, course))
      .map((item) => item.name)
      .filter(Boolean)
  ))].sort((a, b) => a === 'All Sections' ? -1 : b === 'All Sections' ? 1 : a.localeCompare(b)), [sections, course]);

  const courseOptions = useMemo(() => track === 'All Tracks'
    ? ['All Courses', ...Object.values(TRACK_STRANDS).flat()] 
    : ['All Courses', ...TRACK_STRANDS[track]], [track]);

  const filtered = useMemo(() => students.filter((student) => {
    const query = search.trim().toLowerCase();
    const name = String(student.name || '').toLowerCase();
    const id = String(student.id || '').toLowerCase();
    const studentSection = student.section || sectionById.get(student.sectionId)?.name || '';
    const studentTrack = student.track || (['TVL', 'Electrical', 'Carpentry'].includes(student.strand) ? 'Tech Pro Track' : 'Academic Track');
    return (!query || name.includes(query) || id.includes(query))
      && (track === 'All Tracks' || studentTrack === track)
      && (course === 'All Courses' || student.strand === course)
      && (section === 'All Sections' || studentSection === section);
  }), [students, search, track, course, section, sectionById]);

  useEffect(() => setCurrentPage(1), [search, track, course, section]);

  const displayStudentId = (student) => {
    const source = student.studentCode || student.code;
    if (source) {
      const normalized = String(source).replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
      return normalized.startsWith('LNHS-') ? normalized : `LNHS-${normalized}`;
    }
    return `LNHS-${String(student.id).replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase()}`;
  };

  const sortedStudents = useMemo(() => sortRows(filtered, sortColumn, sortDirection, (student, column) => {
    if (column === 'studentId') return displayStudentId(student);
    if (column === 'section') return student.section || sectionById.get(student.sectionId)?.name || '';
    if (column === 'track') return student.track || (['TVL', 'Electrical', 'Carpentry'].includes(student.strand) ? 'Tech Pro Track' : 'Academic Track');
    if (column === 'status') return student.active ? 'Active' : 'Inactive';
    return student[column] || '';
  }), [filtered, sortColumn, sortDirection, sectionById]);
  const pageStudents = sortedStudents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const changeSort = (column) => {
    if (sortColumn === column) setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc');
    else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const handleSave = async (data, photoFile) => {
    const updatedStudent = await saveStudent(data, photoFile);
    if (previewStudent?.id === updatedStudent.id) setPreviewStudent(updatedStudent);
    setSuccess(editing ? `${data.name} updated successfully.` : `${data.name} registered successfully.`);
    window.setTimeout(() => setSuccess(''), 4000);
  };

  const prepareStudentId = async (student, parent, autoExport = false) => {
    setIdError('');
    setExportIdWhenReady(false);
    try {
      const cardStudent = student.qrValue ? student : await generateStudentQr(student);
      setStudents((current) => current.map((item) => item.id === cardStudent.id ? cardStudent : item));
      setPreviewStudent({
        ...cardStudent,
        parentName: parent?.parentName || cardStudent.parentName || '',
        parentPhone: parent?.parentPhone || cardStudent.parentPhone || '',
        idCardGeneratedAt: cardStudent.idCardGeneratedAt || new Date().toISOString(),
      });
      setExportIdWhenReady(autoExport);
    } catch (error) {
      setIdError(error.message || `Unable to prepare a valid QR code for ${student.name || 'this student'}.`);
    }
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
    const exportStudent = {
      ...student,
      idCardGeneratedAt: student.idCardGeneratedAt || new Date().toISOString(),
      idCardQrValue: student.qrValue || student.qrUuid || student.studentCode || student.code || student.id,
    };
    try {
      await saveStudent(exportStudent);
      setSuccess('Student ID export recorded. The same QR credential will be reused.');
    } catch {
      setSuccess('Student ID is ready to export, but its export record could not be saved.');
    }
    window.setTimeout(() => setSuccess(''), 4000);
    return exportStudent;
  };

  const toggleActive = async (id) => {
    const student = students.find((item) => item.id === id);
    if (!student) return;
    await saveStudent({ ...student, active: !student.active });
    setSuccess(`${student.name} ${student.active ? 'deactivated' : 'activated'} successfully.`);
    window.setTimeout(() => setSuccess(''), 4000);
  };

  const confirmDelete = async () => {
    if (!deleting?.id) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await deleteStudent(deleting.id);
      setCurrentPage((current) => Math.min(current, Math.max(1, Math.ceil((filtered.length - 1) / PAGE_SIZE))));
      setSuccess(`${deleting.name} deleted. Attendance and SMS history were retained.`);
      setDeleting(null);
      window.setTimeout(() => setSuccess(''), 5000);
    } catch (error) {
      setDeleteError(error.message || 'Unable to delete student.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      {deleting && (
        <StudentDeleteModal
          student={deleting}
          onClose={() => { if (!deleteLoading) { setDeleting(null); setDeleteError(''); } }}
          onConfirm={confirmDelete}
          loading={deleteLoading}
          error={deleteError}
        />
      )}
      {previewStudent && (
        <Modal title="Student ID Preview" onClose={() => { setPreviewStudent(null); setExportIdWhenReady(false); }} maxWidth="1200px" className="student-id-preview-modal" portal>
          <StudentIdCard student={{
            ...previewStudent,
            parentName: parentByStudentId.get(previewStudent.id)?.parentName || previewStudent.parentName || '',
            parentPhone: parentByStudentId.get(previewStudent.id)?.parentPhone || previewStudent.parentPhone || '',
          }} onPhotoUpload={handlePreviewPhoto}
            onPrint={() => { void handleIdExport(previewStudent); }}
            onExport={() => handleIdExport(previewStudent)}
            autoExportPdf={exportIdWhenReady}
            onAutoExportComplete={setExportIdWhenReady} />
        </Modal>
      )}

      {(showModal || editing) && (
        <StudentModal key={editing?.id || 'new-student'}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={handleSave} existing={editing} studentCodes={studentCodes}
          sections={sections.filter((section) => section.id && section.name)} advisers={adviserNames} />
      )}

      <PageCover
        eyebrow="Administrator Panel"
        title="Students"
        subtitle={`${students.length} registered · ${students.filter((student) => student.active).length} active`}
        actions={(
          <>
          <Button variant="ghost" size="sm" type="button" aria-label="Export students" onClick={exportStudents}><Download size={13} /> Export</Button>
          <Button variant="primary" size="sm" onClick={() => { setEditing(null); setShowModal(true); }}><Plus size={13} /> Add Student</Button>
          </>
        )}
      />

      {success && <Alert type="success" onClose={() => setSuccess('')} className="mb-4">{success}</Alert>}
      {idError && <Alert type="error" onClose={() => setIdError('')} className="mb-4">{idError}</Alert>}

      <div className="toolbar">
        <label className="toolbar__search">
          <Search size={14} aria-hidden="true" />
          <input className="toolbar__input" placeholder="Search by name or student ID..." value={search}
            onChange={(event) => setSearch(event.target.value)} aria-label="Search students by name or student ID" />
        </label>
        <select className="field-input toolbar__select" value={track} onChange={(event) => { setTrack(event.target.value); setCourse('All Courses'); setSection('All Sections'); }} aria-label="Filter by track">
          {['All Tracks', ...TRACK_OPTIONS].map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className="field-input toolbar__select" value={course} onChange={(event) => { setCourse(event.target.value); setSection('All Sections'); }} aria-label="Filter by strand or course">
          {courseOptions.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className="field-input toolbar__select" value={section} onChange={(event) => setSection(event.target.value)} aria-label="Filter by section">
          {sectionOptions.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>

      <div className="card students-table-card">
        <div className="overflow-x-auto">
          <table className="data-table students-table">
            <thead><tr>
              <SortableHeader label="Student ID" column="studentId" sortColumn={sortColumn} sortDirection={sortDirection} onSort={changeSort} />
              <SortableHeader label="Name" column="name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={changeSort} />
              <SortableHeader label="Track" column="track" sortColumn={sortColumn} sortDirection={sortDirection} onSort={changeSort} />
              <SortableHeader label="Strand / Course" column="strand" sortColumn={sortColumn} sortDirection={sortDirection} onSort={changeSort} />
              <SortableHeader label="Section" column="section" sortColumn={sortColumn} sortDirection={sortDirection} onSort={changeSort} />
              <th>Adviser</th><th>Parent Contact</th>
              <SortableHeader label="Status" column="status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={changeSort} />
              <th className="right">Actions</th>
            </tr></thead>
            <tbody>
              {pageStudents.map((student) => {
                const parent = parentByStudentId.get(student.id);
                return <tr key={student.id}>
                  <td className="mono students-table__id">{displayStudentId(student)}</td>
                  <td>
                    <span className="cell-name">{displayValue(student.name)}</span>
                    <span className="students-table__meta">
                      {[
                        student.strand,
                        student.section || sectionById.get(student.sectionId)?.name,
                        student.adviser || sectionById.get(student.sectionId)?.adviser,
                        parent?.parentPhone || student.parentPhone,
                      ].filter(Boolean).map(displayValue).join(' · ')}
                    </span>
                  </td>
                  <td><span className="pill-strand badge-strand" data-strand={student.track}>{displayValue(student.track || (['TVL', 'Electrical', 'Carpentry'].includes(student.strand) ? 'Tech Pro Track' : 'Academic Track'))}</span></td>
                  <td><span className="pill-strand badge-strand" data-strand={student.strand}>{displayValue(student.strand)}</span></td>
                  <td>{displayValue(student.section || sectionById.get(student.sectionId)?.name)}</td>
                  <td>{displayValue(student.adviser || sectionById.get(student.sectionId)?.adviser)}</td>
                  <td className="mono students-table__phone">{displayValue(parent?.parentPhone || student.parentPhone)}</td>
                  <td><span className={`pill-status ${student.active ? 'pill-status--active' : 'pill-status--inactive'}`}>{student.active ? 'Active' : 'Inactive'}</span></td>
                  <td className="right"><div className="row-actions">
                    <Button variant="outline" className="table-action--edit" size="sm" onClick={() => setEditing({
                      ...student,
                      parentName: parent?.parentName || student.parentName || '',
                      parentPhone: parent?.parentPhone || student.parentPhone || '',
                    })} title="Edit student" aria-label={`Edit ${student.name || 'student'}`}><Pencil size={12} /> Edit</Button>
                    <Button variant="outline" className="table-action--preview" size="sm" onClick={() => { void prepareStudentId(student, parent); }} title="Preview ID" aria-label={`Preview ID for ${student.name || 'student'}`}><Eye size={12} /> Preview ID</Button>
                    <Button variant="outline" className="table-action--export" size="sm" onClick={() => { void prepareStudentId(student, parent, true); }} title="Export ID" aria-label={`Export ID for ${student.name || 'student'}`}><IdCard size={12} /> Export ID</Button>
                    <Button variant="outline" className={student.active ? 'table-action--delete' : 'table-action--approve'} size="sm" onClick={() => toggleActive(student.id)}
                      title={student.active ? 'Deactivate' : 'Activate'} aria-label={`${student.active ? 'Deactivate' : 'Activate'} ${student.name || 'student'}`}>
                      <UserX size={12} /> {student.active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button variant="outline" className="table-action--delete students-table__delete" size="sm"
                      onClick={() => { setDeleteError(''); setDeleting(student); }}
                      title="Permanently delete student" aria-label={`Delete ${student.name || 'student'}`}>
                      <Trash2 size={12} />
                    </Button>
                  </div></td>
                </tr>;
              })}
              {!filtered.length && (
                <EmptyTableRow
                  colSpan={8}
                  icon={Users}
                  title={students.length ? 'No students match these filters.' : 'No students yet.'}
                  subtitle={students.length ? 'Try changing the search, track, course, or section filters.' : 'Add a student to get started.'}
                />
              )}
            </tbody>
          </table>
        </div>
        <Pagination totalItems={sortedStudents.length} currentPage={currentPage} pageSize={PAGE_SIZE} onPageChange={setCurrentPage} itemLabel="students" />
      </div>
    </div>
  );
}
