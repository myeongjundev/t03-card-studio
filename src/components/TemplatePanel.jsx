import { LIMITS } from '../state/editorState.js';
import DropZone from './DropZone.jsx';

function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

export default function TemplatePanel({
  templates,
  name,
  editingId,
  onNameChange,
  onCreate,
  onUpdate,
  onLoad,
  onEdit,
  onDelete,
  onCancelEdit,
  onExportJson,
  onImportJson,
}) {
  const editing = templates.find((template) => template.id === editingId) ?? null;
  const canSave = name.trim() !== '';

  return (
    <section className="panel panel-templates" aria-labelledby="template-heading">
      <h2 id="template-heading"><span>03</span> 저장하기</h2>

      <div className="field">
        <label htmlFor="template-name">템플릿 이름</label>
        <input
          id="template-name"
          type="text"
          value={name}
          maxLength={LIMITS.nameMaxLength}
          placeholder="예: 공지용 파란 카드"
          onChange={(event) => onNameChange(event.target.value)}
        />
      </div>

      {editing ? (
        <>
          <p className="editing-banner">
            <strong>{editing.name}</strong> 을(를) 수정하고 있습니다.
          </p>
          <div className="button-row">
            <button type="button" className="primary" onClick={onUpdate} disabled={!canSave}>
              변경 내용 저장
            </button>
            <button type="button" onClick={onCreate} disabled={!canSave}>
              새 템플릿으로 저장
            </button>
            <button type="button" onClick={onCancelEdit}>
              수정 취소
            </button>
          </div>
        </>
      ) : (
        <div className="button-row">
          <button type="button" className="primary" onClick={onCreate} disabled={!canSave}>
            현재 설정을 템플릿으로 저장
          </button>
        </div>
      )}

      <p className="hint">
        문구·위치·크기·색상·비율을 저장합니다. 배경 이미지는 저장하지 않으므로
        불러온 뒤 다시 골라 주세요.
      </p>

      <h3 className="subheading">
        저장된 템플릿 <span className="count">{templates.length}개</span>
      </h3>

      {templates.length === 0 ? (
        <p className="empty">
          아직 저장한 템플릿이 없습니다. 위에서 이름을 적고 저장해 보세요.
        </p>
      ) : (
        <ul className="template-list">
          {templates.map((template) => (
            <li
              key={template.id}
              className={template.id === editingId ? 'template-item editing' : 'template-item'}
            >
              <div className="template-info">
                <span className="template-name">{template.name}</span>
                <span className="template-meta">
                  {template.ratio} · {template.fontSize}px · {formatDate(template.updatedAt)}
                </span>
              </div>
              <div className="button-row">
                <button type="button" className="small" onClick={() => onLoad(template.id)}>
                  불러오기
                </button>
                <button type="button" className="small" onClick={() => onEdit(template.id)}>
                  수정
                </button>
                <button type="button" className="small" onClick={() => onDelete(template.id)}>
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3 className="subheading">설정 파일 백업</h3>

      <div className="button-row">
        <button
          type="button"
          onClick={onExportJson}
          disabled={templates.length === 0}
        >
          설정 내보내기
        </button>
      </div>

      <div className="field" style={{ marginTop: 10 }}>
        <span className="field-label">설정 가져오기 (JSON)</span>
        <DropZone
          accept="application/json,.json"
          onFile={onImportJson}
          icon="file"
          title="JSON 파일 끌어다 놓기"
          hint="또는 클릭해서 고르기"
          compact
        />
        <p className="hint">
          파일을 모두 확인한 뒤에만 저장합니다. 형식이 맞지 않으면 가져오기를
          중단하고 지금 저장된 템플릿을 그대로 둡니다.
        </p>
      </div>
    </section>
  );
}
