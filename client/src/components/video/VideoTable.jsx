import { Link } from 'react-router-dom';
import { StatusBadge, DeadlineFlag, Buffer, Avatar } from '../ui';
import { fmtShort, relDays } from '../../lib/format';

/** Manager view of videos: editor deadline vs client deadline side by side, buffer and flag. */
export default function VideoTable({ videos, base = '/manager/videos' }) {
  return (
    <>
      {/* desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="table-head py-3 pl-1 pr-3 w-6" />
              <th className="table-head py-3 pr-3">Video</th>
              <th className="table-head py-3 pr-3">Status</th>
              <th className="table-head py-3 pr-3">Editor</th>
              <th className="table-head py-3 pr-3">Editor due</th>
              <th className="table-head py-3 pr-3">Client due</th>
              <th className="table-head py-3 pr-3 text-right">Buffer</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((v) => (
              <tr key={v._id} className={`group border-b border-white/[0.04] transition hover:bg-white/[0.02] ${v.flag === 'red' ? 'bg-bad/[0.03]' : ''}`}>
                <td className="py-3 pl-1 pr-3"><DeadlineFlag flag={v.flag} overdue={v.overdue} compact /></td>
                <td className="max-w-[260px] py-3 pr-3">
                  <Link to={`${base}/${v._id}`} className="block truncate text-cream-soft transition group-hover:text-cream">{v.title}</Link>
                  {v.overdue && <span className="text-[11px] text-bad">Overdue</span>}
                  {!v.overdue && v.flag === 'red' && <span className="text-[11px] text-bad">Editor deadline after client deadline</span>}
                </td>
                <td className="py-3 pr-3"><StatusBadge status={v.status} /></td>
                <td className="py-3 pr-3">
                  {v.assignedEditor ? (
                    <span className="flex items-center gap-2"><Avatar name={v.assignedEditor.name} size="sm" /><span className="truncate">{v.assignedEditor.name}</span></span>
                  ) : <span className="text-muted">Unassigned</span>}
                </td>
                <td className="py-3 pr-3 tabular-nums">
                  {v.editorDeadline ? (<><div>{fmtShort(v.editorDeadline)}</div><div className="text-[11px] text-muted">{relDays(v.editorDeadline)}</div></>) : <span className="text-muted">—</span>}
                </td>
                <td className="py-3 pr-3 tabular-nums">
                  <div>{fmtShort(v.clientDeadline)}</div><div className="text-[11px] text-muted">{relDays(v.clientDeadline)}</div>
                </td>
                <td className="py-3 pr-3 text-right"><Buffer days={v.bufferDays} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* mobile */}
      <div className="space-y-2 md:hidden">
        {videos.map((v) => (
          <Link key={v._id} to={`${base}/${v._id}`} className={`block rounded-xl border px-4 py-3 transition ${v.flag === 'red' ? 'border-bad/30 bg-bad/[0.04]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm text-cream-soft">{v.title}</span>
              <DeadlineFlag flag={v.flag} overdue={v.overdue} compact />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={v.status} />
              <span className="text-xs text-muted">{v.assignedEditor?.name || 'Unassigned'}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              <div><div className="text-muted">Editor</div><div className="tabular-nums">{fmtShort(v.editorDeadline)}</div></div>
              <div><div className="text-muted">Client</div><div className="tabular-nums">{fmtShort(v.clientDeadline)}</div></div>
              <div className="text-right"><div className="text-muted">Buffer</div><Buffer days={v.bufferDays} /></div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
