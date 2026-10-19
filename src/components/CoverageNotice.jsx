import { useMemo } from 'react';
import { Alert, Button, Popconfirm, Space } from 'antd';
import { CloudDownloadOutlined, PlusOutlined } from '@ant-design/icons';
import { formatTime, fromNow } from '../utils/logUtils';

/**
 * Says how much of the server's result is actually loaded. The table, filters and stats only
 * see loaded logs, so without this a partial download (say the newest 1,000 of a 30-day
 * range) looks like the whole result.
 */
export default function CoverageNotice({ logs, total, limit, applied, busy, onLoadMore, onLoadAll }) {
  // Oldest receive time among loaded logs: the server's date range filters on createdAt.
  const oldest = useMemo(() => {
    let min = null;
    for (const l of logs) {
      const t = l.createdAt ?? l.time;
      if (t !== null && (min === null || t < min)) min = t;
    }
    return min;
  }, [logs]);

  if (total === null || !logs.length || logs.length >= total) return null;

  const remaining = total - logs.length;
  const requests = Math.ceil(remaining / limit);
  const rangeStart = applied?.params?.startDate ? Date.parse(applied.params.startDate) : null;
  const matching = applied && Object.keys(applied.params).length ? 'matching ' : '';

  return (
    <Alert
      type="warning"
      showIcon
      message={`Showing the newest ${logs.length.toLocaleString()} of ${total.toLocaleString()} ${matching}logs`}
      description={
        <>
          Loaded logs were received by the server as far back as <b>{formatTime(oldest, 'MMM D, HH:mm')}</b> ({fromNow(oldest)})
          {rangeStart !== null && (
            <>
              , but your range starts <b>{formatTime(rangeStart, 'MMM D, HH:mm')}</b>
            </>
          )}
          . The table, filters and stats only cover loaded logs — {remaining.toLocaleString()} more are still on the server.
        </>
      }
      action={
        <Space direction="vertical" size={6}>
          <Button size="small" block icon={<PlusOutlined />} onClick={onLoadMore} disabled={busy}>
            Load next {Math.min(limit, remaining).toLocaleString()}
          </Button>
          <Popconfirm
            title="Load every remaining log?"
            description={`${remaining.toLocaleString()} logs ≈ ${requests} request${requests === 1 ? '' : 's'} of ${limit}.`}
            onConfirm={onLoadAll}
            disabled={busy}
          >
            <Button size="small" block type="primary" icon={<CloudDownloadOutlined />} disabled={busy}>
              Load all {remaining.toLocaleString()}
            </Button>
          </Popconfirm>
        </Space>
      }
    />
  );
}
