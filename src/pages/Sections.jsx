import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil } from 'lucide-react';
import Button from '../components/Button';
import Modal from '../components/Modal';
import FormField from '../components/FormField';
import Alert from '../components/Alert';
import { useData } from '../context/DataContext';

function SectionModal({ onClose, onSave, existing, advisers }) {
  const [form, setForm] = useState(existing ?? { name:'', grade:'12', room:'', strand:'STEM', adviser:'' });
  const [errs, setErrs] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f=>({...f,[k]:v}));
  const validate = () => {
    const e = {};
    if (!form.name.trim())    e.name    = 'Section name is required.';
    if (!form.room.trim())    e.room    = 'Room is required.';
    if (!form.adviser.trim()) e.adviser = 'Adviser is required.';
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrs(e); return; }
    setSaving(true);
    await onSave({ ...form, id: existing?.id, active: existing?.active ?? true });
    setSaving(false);
    onClose();
  };

  return (
    <Modal title={existing ? 'Edit Section' : 'Add Section'} onClose={onClose} maxWidth="460px"
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
          {existing ? 'Save Changes' : 'Create Section'}
        </Button>
      </>}>
      <div className="space-y-3">
        <FormField label="Section Name" required id="sec-name" error={errs.name}>
          <input id="sec-name" className={`field-input${errs.name?' error':''}`} placeholder="Grade 12 — STEM C"
            value={form.name} onChange={(e)=>set('name',e.target.value)} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Grade Level" id="sec-grade">
            <select id="sec-grade" className="field-input" value={form.grade} onChange={(e)=>set('grade',e.target.value)}>
              {[7,8,9,10,11,12].map(g=><option key={g}>{g}</option>)}
            </select>
          </FormField>
          <FormField label="Room" required id="sec-room" error={errs.room}>
            <input id="sec-room" className={`field-input${errs.room?' error':''}`} placeholder="Room 305"
              value={form.room} onChange={(e)=>set('room',e.target.value)} />
          </FormField>
        </div>
        <FormField label="Strand" id="sec-strand">
          <select id="sec-strand" className="field-input" value={form.strand} onChange={(e)=>set('strand',e.target.value)}>
            {['STEM','ABM','HUMSS','TVL','GAS'].map(s=><option key={s}>{s}</option>)}
          </select>
        </FormField>
        <FormField label="Adviser" required id="sec-adviser" error={errs.adviser}>
          <select id="sec-adviser" className={`field-input${errs.adviser?' error':''}`}
            value={form.adviser} onChange={(e)=>set('adviser',e.target.value)}>
            <option value="">Select adviser…</option>
            {advisers.map(a=><option key={a}>{a}</option>)}
          </select>
        </FormField>
      </div>
    </Modal>
  );
}

export default function Sections() {
  const { sections: liveSections, teachers, students, saveSection } = useData();
  const navigate = useNavigate();
  const [sections, setSections]   = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [success, setSuccess]     = useState('');

  useEffect(() => setSections(liveSections.map((section) => ({
    ...section,
    active: section.active !== false,
    adviser: section.adviser || section.teacherName || section.teacher || teachers.find((teacher) => teacher.uid === section.teacherId)?.name || '',
  }))), [liveSections, teachers]);
  const adviserOptions = teachers.map((teacher) => teacher.name).filter(Boolean);

  const handleSave = async (data) => {
    await saveSection({ ...data, teacherId: teachers.find((teacher) => teacher.name === data.adviser)?.uid || '' });
    setSuccess(editing ? `${data.name} updated successfully.` : `${data.name} created successfully.`);
    setTimeout(()=>setSuccess(''),4000);
  };

  const normalizeGrade = (value) => String(value || '').replace(/^grade\s*/i, '').trim();
  const grades = [...new Set(sections.map((section) => normalizeGrade(section.grade)).filter(Boolean))].sort((a,b)=>Number(b)-Number(a));

  return (
    <div className="animate-fade-in">
      {(showModal || editing) && (
        <SectionModal
          key={editing?.id || 'new-section'}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={handleSave}
          existing={editing}
          advisers={adviserOptions}
        />
      )}

      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Sections</h1>
          <p className="page-sub">
            {sections.filter(s=>s.active).length} active sections ·&nbsp;
            {students.filter((student) => sections.some((section) => section.id === (student.sectionId || student.section) || section.name === (student.sectionId || student.section))).length} students enrolled
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={()=>{setEditing(null);setShowModal(true);}}>
          <Plus size={13} /> Add Section
        </Button>
      </div>

      {success && <Alert type="success" onClose={()=>setSuccess('')} className="mb-4">{success}</Alert>}

      {grades.map(grade=>(
        <div key={grade} className="mb-4">
          <div className="flex items-center gap-3 mb-3">
            <span style={{ fontFamily:'Work Sans', fontWeight:800, fontSize:'.9rem', color:'var(--navy-900)' }}>
              Grade {grade}
            </span>
            <div style={{ flex:1, height:'1px', background:'var(--border)' }} />
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))' }}>
            {sections.filter((section) => normalizeGrade(section.grade) === grade).map(sec=>(
              <div key={sec.id} className="card p-3" style={{ opacity: sec.active ? 1 : .65 }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div style={{ fontFamily:'Work Sans', fontWeight:700, fontSize:'.95rem', color:'var(--navy-900)' }}>
                      {sec.name}
                    </div>
                    <div style={{ fontSize:'.8rem', color:'var(--text-muted)', marginTop:'1px' }}>{sec.room}</div>
                  </div>
                  <span className="badge badge-navy">{sec.strand}</span>
                </div>
                <div className="space-y-1.5 mb-4 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color:'var(--text-muted)' }}>Adviser</span>
                    <span style={{ fontWeight:600, color:'var(--text-main)' }}>{sec.adviser}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color:'var(--text-muted)' }}>Students</span>
                    <span style={{ fontFamily:'JetBrains Mono', fontWeight:500, color:'var(--navy-800)' }}>{students.filter((student) => (student.sectionId || student.section) === sec.id || (student.sectionId || student.section) === sec.name).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color:'var(--text-muted)' }}>Status</span>
                    <span className={`badge ${sec.active ? 'badge-active' : 'badge-inactive'}`}>
                      {sec.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="section-actions flex gap-2">
                  <Button variant="ghost" size="sm" className="flex-1" onClick={()=>setEditing(sec)}>
                    <Pencil size={12} /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1" onClick={() => navigate(`/attendance?section=${encodeURIComponent(sec.name)}`)}>
                    View Attendance
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
