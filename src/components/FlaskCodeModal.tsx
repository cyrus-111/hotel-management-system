import React, { useState } from 'react';
import { FLASK_PROJECT_FILES, FlaskProjectFile } from '../data/flaskSourceFiles';
import { FLASK_TEMPLATE_FILES } from '../data/flaskTemplatesPart1';
import { FLASK_TEMPLATE_FILES_PART2 } from '../data/flaskTemplatesPart2';
import { FLASK_TEMPLATE_FILES_PART3 } from '../data/flaskTemplatesPart3';
import { Copy, Check, Terminal, FileCode, Database, FolderTree } from 'lucide-react';

const ALL_FILES: FlaskProjectFile[] = [
  ...FLASK_PROJECT_FILES,
  ...FLASK_TEMPLATE_FILES,
  ...FLASK_TEMPLATE_FILES_PART2,
  ...FLASK_TEMPLATE_FILES_PART3,
];

export const FlaskCodeModal: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [selectedPath, setSelectedPath] = useState<string>('app.py');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [viewAllMode, setViewAllMode] = useState<boolean>(false);

  const activeFile = ALL_FILES.find((f) => f.path === selectedPath) || ALL_FILES[0];

  const handleCopy = (path: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const handleCopyAllBundle = () => {
    const bundle = ALL_FILES.map(
      (f) =>
        `# =====================================================================\n# FILE: ${f.path}\n# DESCRIPTION: ${f.description}\n# =====================================================================\n\n${f.content}\n`
    ).join('\n\n');
    handleCopy('ALL_FILES', bundle);
  };

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 mb-8 border-b border-[#E2D9C8]">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#6E655B] mb-1">
            PYTHON FLASK &bull; POSTGRESQL (HOTEL_DB) &bull; JINJA2 SOURCE CODE
          </div>
          <h1 className="text-3xl md:text-4xl text-[#2B2620] font-serif-editorial">
            Complete Flask + PostgreSQL Source Files
          </h1>
          <p className="text-sm text-[#6E655B] mt-2 max-w-3xl">
            Every required file for your local Python Flask + PostgreSQL project (<code>app.py</code>, <code>db.py</code>, <code>.env</code>, <code>requirements.txt</code>, all 12 Jinja2 templates, <code>static/css/style.css</code>, and <code>static/js/main.js</code>). All currency values use the <code>inr</code> Jinja filter in Indian Rupees (₹).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setViewAllMode(!viewAllMode)}
            className="px-4 py-2 text-xs font-medium bg-white border border-[#E2D9C8] text-[#2B2620] rounded-[5px] hover:bg-[#EFE8DC] transition-colors cursor-pointer"
          >
            {viewAllMode ? 'Single File Inspector' : 'Show All 18 Files Sequential'}
          </button>
          <button
            type="button"
            onClick={handleCopyAllBundle}
            className="px-4 py-2 text-xs font-medium bg-[#8B3E1F] text-white rounded-[5px] hover:bg-[#6E2F15] transition-colors flex items-center gap-2 cursor-pointer"
          >
            {copiedPath === 'ALL_FILES' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedPath === 'ALL_FILES' ? 'Copied All 18 Files!' : 'Copy Entire Project Bundle'}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium bg-white border border-[#E2D9C8] text-[#2B2620] rounded-[5px] hover:bg-[#EFE8DC] transition-colors cursor-pointer"
            >
              Return to Live App
            </button>
          )}
        </div>
      </div>

      {/* Run Instructions Box */}
      <div className="bg-white border border-[#E2D9C8] rounded-[6px] p-6 mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#8B3E1F] mb-2">
              <FolderTree className="w-4 h-4" />
              1. Project Directory Structure
            </div>
            <pre className="text-xs font-mono bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px] p-3 text-[#2B2620] overflow-x-auto leading-relaxed">
{`hartwell/
├── app.py
├── db.py
├── .env
├── requirements.txt
├── templates/
│   ├── base.html
│   ├── home.html
│   ├── dashboard.html
│   ├── guests.html
│   ├── guest_form.html
│   ├── rooms.html
│   ├── room_form.html
│   ├── reservations.html
│   ├── reservation_form.html
│   ├── payments.html
│   ├── search.html
│   └── reports.html
└── static/
    ├── css/style.css
    ├── js/main.js
    └── img/ (place room & estate photos)`}
            </pre>
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#8B3E1F] mb-2">
              <Database className="w-4 h-4" />
              2. Configure .env for PostgreSQL
            </div>
            <p className="text-xs text-[#6E655B] mb-2">
              Point <code>.env</code> to your existing <code>hotel_db</code> PostgreSQL database. No tables are created or altered by the app.
            </p>
            <pre className="text-xs font-mono bg-[#FBF7F0] border border-[#E2D9C8] rounded-[4px] p-3 text-[#2B2620] overflow-x-auto leading-relaxed">
{`DB_HOST=localhost
DB_PORT=5432
DB_NAME=hotel_db
DB_USER=postgres
DB_PASSWORD=your_password_here
SECRET_KEY=change_me`}
            </pre>
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#8B3E1F] mb-2">
              <Terminal className="w-4 h-4" />
              3. Install &amp; Run Instructions
            </div>
            <p className="text-xs text-[#6E655B] mb-2">
              Install dependencies from <code>requirements.txt</code> and launch the Flask server:
            </p>
            <pre className="text-xs font-mono bg-[#2B2620] text-[#FBF7F0] rounded-[4px] p-3 overflow-x-auto leading-relaxed">
{`# Create & activate virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\\Scripts\\activate

# Install Flask, psycopg2-binary, python-dotenv
pip install -r requirements.txt

# Run the application
python app.py
# -> Running on http://127.0.0.1:5000`}
            </pre>
          </div>
        </div>
      </div>

      {viewAllMode ? (
        <div className="space-y-8">
          {ALL_FILES.map((file) => (
            <div key={file.path} className="bg-white border border-[#E2D9C8] rounded-[6px] overflow-hidden">
              <div className="bg-[#EFE8DC] px-5 py-3 border-b border-[#E2D9C8] flex items-center justify-between">
                <div>
                  <span className="font-mono text-sm font-semibold text-[#2B2620]">{file.path}</span>
                  <span className="text-xs text-[#6E655B] ml-3">{file.description}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(file.path, file.content)}
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-[#E2D9C8] rounded-[4px] text-[#2B2620] hover:bg-[#FBF7F0] flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedPath === file.path ? <Check className="w-3.5 h-3.5 text-[#5C6446]" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedPath === file.path ? 'Copied' : 'Copy File'}
                </button>
              </div>
              <pre className="p-5 text-xs font-mono text-[#2B2620] bg-white overflow-x-auto leading-relaxed">
                <code>{file.content}</code>
              </pre>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* File Sidebar */}
          <div className="lg:col-span-3 bg-white border border-[#E2D9C8] rounded-[6px] p-3 h-fit">
            <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#6E655B] px-2 py-1.5">
              Project Files ({ALL_FILES.length})
            </div>
            <div className="space-y-1 mt-1">
              {ALL_FILES.map((f) => {
                const isActive = f.path === selectedPath;
                return (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => setSelectedPath(f.path)}
                    className={`w-full text-left px-3 py-2 rounded-[4px] text-xs font-mono flex items-center gap-2 transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#8B3E1F] text-white font-medium'
                        : 'text-[#2B2620] hover:bg-[#EFE8DC]'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{f.path}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Code Viewer */}
          <div className="lg:col-span-9 bg-white border border-[#E2D9C8] rounded-[6px] overflow-hidden">
            <div className="bg-[#EFE8DC] px-5 py-3.5 border-b border-[#E2D9C8] flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-mono text-sm font-semibold text-[#2B2620]">{activeFile.path}</div>
                <div className="text-xs text-[#6E655B] mt-0.5">{activeFile.description}</div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(activeFile.path, activeFile.content)}
                className="px-3.5 py-1.5 text-xs font-medium bg-[#8B3E1F] text-white rounded-[4px] hover:bg-[#6E2F15] flex items-center gap-1.5 cursor-pointer"
              >
                {copiedPath === activeFile.path ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedPath === activeFile.path ? 'Copied to Clipboard' : `Copy ${activeFile.path}`}
              </button>
            </div>
            <pre className="p-6 text-xs font-mono text-[#2B2620] bg-white overflow-x-auto leading-relaxed max-h-[720px]">
              <code>{activeFile.content}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
