/**
 * DocumentsTab Component
 * =======================
 * Documents view with folder structure, list, and collapse demos.
 */

import { MdDescription, MdFolder, MdInsertDriveFile, MdMoreVert } from 'react-icons/md'

import { DEMO_DOCUMENTS, FOLDER_ITEMS } from '../../constants/demoData'

export const DocumentsTab = () => (
  <div className="animate-in fade-in space-y-6 duration-300">
    {/* Folder Structure with Collapse */}
    <div className="card border-base-300 bg-base-100 border shadow-sm">
      <div className="card-body">
        <h3 className="card-title">Project Files</h3>
        <div className="space-y-2">
          {FOLDER_ITEMS.map((folder, i) => (
            <div
              key={i}
              className="collapse-arrow border-base-300 bg-base-100 hover:border-primary/30 collapse rounded-lg border transition-all">
              <input
                type="checkbox"
                defaultChecked={folder.open}
                aria-label={`Toggle ${folder.name} folder`}
              />
              <div className="collapse-title font-medium">
                <div className="flex items-center gap-2">
                  <MdFolder size={20} className="text-warning" aria-hidden="true" />
                  {folder.name}
                  <span className="badge badge-ghost badge-sm">{folder.files} files</span>
                </div>
              </div>
              <div className="collapse-content">
                {folder.items ? (
                  <ul className="menu gap-1 p-0" role="list">
                    {folder.items.map((item, j) => (
                      <li key={j}>
                        <a className="transition-colors">
                          <MdInsertDriveFile
                            size={18}
                            className="text-primary"
                            aria-hidden="true"
                          />
                          {item}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-base-content/70 text-sm">24 meeting notes from Q3-Q4 2024</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Explicit List Component Demo */}
    <div className="card border-base-300 bg-base-100 border shadow-sm">
      <div className="card-body">
        <h3 className="card-title text-base">List Component</h3>
        <ul className="list bg-base-200 rounded-box" role="list">
          <li className="list-row">
            <div className="text-4xl font-thin tabular-nums opacity-30">01</div>
            <div>
              <img
                className="rounded-box size-10"
                src="https://img.daisyui.com/images/profile/demo/1@94.webp"
                alt=""
              />
            </div>
            <div>
              <div className="font-medium">Dio Lupa</div>
              <div className="text-base-content/60 text-xs">Lead Designer</div>
            </div>
            <button className="btn btn-ghost btn-square btn-sm" aria-label="More options">
              <MdMoreVert aria-hidden="true" />
            </button>
          </li>
          <li className="list-row">
            <div className="text-4xl font-thin tabular-nums opacity-30">02</div>
            <div>
              <img
                className="rounded-box size-10"
                src="https://img.daisyui.com/images/profile/demo/4@94.webp"
                alt=""
              />
            </div>
            <div>
              <div className="font-medium">Ellie Beilish</div>
              <div className="text-base-content/60 text-xs">Product Manager</div>
            </div>
            <button className="btn btn-ghost btn-square btn-sm" aria-label="More options">
              <MdMoreVert aria-hidden="true" />
            </button>
          </li>
          <li className="list-row">
            <div className="text-4xl font-thin tabular-nums opacity-30">03</div>
            <div>
              <img
                className="rounded-box size-10"
                src="https://img.daisyui.com/images/profile/demo/3@94.webp"
                alt=""
              />
            </div>
            <div>
              <div className="font-medium">Sabrino Gardener</div>
              <div className="text-base-content/60 text-xs">Engineering Lead</div>
            </div>
            <button className="btn btn-ghost btn-square btn-sm" aria-label="More options">
              <MdMoreVert aria-hidden="true" />
            </button>
          </li>
        </ul>
      </div>
    </div>

    {/* Document List */}
    <div className="card border-base-300 bg-base-100 border shadow-sm">
      <div className="card-body p-0">
        <ul className="divide-base-300 divide-y" role="list">
          {DEMO_DOCUMENTS.map((doc) => (
            <li
              key={doc.id}
              className="hover:bg-base-200/50 flex items-center gap-4 p-4 transition-colors">
              <div className="bg-primary/10 flex size-10 items-center justify-center rounded-lg">
                <MdDescription size={20} className="text-primary" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{doc.name}</div>
                <div className="text-base-content/60 text-xs">Modified {doc.modified}</div>
              </div>
              <span
                className={`badge badge-sm ${doc.status === 'Published' ? 'badge-success' : doc.status === 'Draft' ? 'badge-ghost' : 'badge-warning'}`}>
                {doc.status}
              </span>
              <button
                className="btn btn-ghost btn-sm btn-circle"
                aria-label={`More options for ${doc.name}`}>
                <MdMoreVert size={20} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </div>
)
