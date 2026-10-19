import { useMemo } from 'react';
import { Table, Typography } from 'antd';
import { formatTime, formatUtc, fromNow } from '../utils/logUtils';
import { useTableHeight } from '../hooks/useTableHeight';
import { CategoryTag, Clip, Dash, FilterTag, PlatformTag, StatusTag } from './LogCells';

const { Text } = Typography;

const byString = (key) => (a, b) => (a[key] || '').localeCompare(b[key] || '');

function IdCell({ facetKey, value, onAddFilter }) {
  if (!value) return <Dash />;
  return (
    <Text
      className="id-cell"
      title={`${value} — click to filter · Alt+click to exclude`}
      onClick={(e) => {
        e.stopPropagation();
        onAddFilter(facetKey, value, e.altKey);
      }}
    >
      {value.length > 10 ? `…${value.slice(-8)}` : value}
    </Text>
  );
}

/**
 * Virtualised: only the rows in view are mounted, so a 500-row page costs about the same
 * as a 20-row one. Cells stick to plain elements with native `title` tooltips for the same
 * reason. The raw JSON that used to expand inline is in the detail drawer (click a row).
 */
export default function LogTable({ logs, loadedCount, loading, onOpen, onAddFilter, selectedId }) {
  const height = useTableHeight();

  const columns = useMemo(
    () => [
      {
        title: 'Time',
        dataIndex: 'time',
        width: 175,
        fixed: 'left',
        sorter: (a, b) => (a.time ?? 0) - (b.time ?? 0),
        defaultSortOrder: 'descend',
        render: (t, log) => (
          <div title={`Event: ${formatTime(log.eventTime)}\n${formatUtc(log.eventTime)}\nReceived: ${formatTime(log.createdAt)}`}>
            <div className="mono">{formatTime(t, 'MM-DD HH:mm:ss.SSS')}</div>
            <div className="cell-sub">{fromNow(t)}</div>
          </div>
        ),
      },
      {
        title: 'Platform',
        dataIndex: 'platform',
        width: 95,
        sorter: byString('platform'),
        render: (_, log) => <PlatformTag log={log} onAddFilter={onAddFilter} />,
      },
      {
        title: 'Category',
        dataIndex: 'category',
        width: 100,
        sorter: byString('category'),
        render: (_, log) => <CategoryTag log={log} onAddFilter={onAddFilter} />,
      },
      {
        title: 'Event',
        dataIndex: 'name',
        width: 340,
        sorter: byString('name'),
        render: (name, log) => (
          <>
            <Clip className="mono" title={name} style={{ fontWeight: 600 }}>
              {name || '—'}
            </Clip>
            {log.apiHost && (
              <Clip className="cell-sub" title={log.apiHost}>
                {log.apiHost}
              </Clip>
            )}
          </>
        ),
      },
      {
        title: 'Status',
        dataIndex: 'apiStatus',
        width: 95,
        sorter: (a, b) => (a.apiStatus ?? -1) - (b.apiStatus ?? -1),
        render: (_, log) => <StatusTag log={log} onAddFilter={onAddFilter} />,
      },
      {
        title: 'Error',
        dataIndex: 'errorMessage',
        width: 280,
        sorter: byString('errorMessage'),
        render: (msg, log) =>
          msg ? (
            <Clip title={msg}>
              <Text type={log.errorMessage === 'Canceled' ? 'secondary' : 'danger'}>
                {log.errorCode && log.errorCode !== String(log.apiStatus) ? `[${log.errorCode}] ` : ''}
                {msg}
              </Text>
            </Clip>
          ) : (
            <Dash />
          ),
      },
      {
        title: 'Device',
        dataIndex: 'deviceModel',
        width: 185,
        sorter: byString('deviceModel'),
        render: (model, log) => (
          <>
            <Clip title={model}>{model || '—'}</Clip>
            <Clip className="cell-sub">
              {log.platform} {log.osVersion}
            </Clip>
          </>
        ),
      },
      {
        title: 'App version',
        dataIndex: 'appVersion',
        width: 160,
        sorter: byString('appVersion'),
        render: (v) => <FilterTag facetKey="appVersion" value={v} onAddFilter={onAddFilter} />,
      },
      {
        title: 'Network',
        dataIndex: 'network',
        width: 90,
        render: (v) => <FilterTag facetKey="network" value={v} color={v === 'none' ? 'red' : undefined} onAddFilter={onAddFilter} />,
      },
      {
        title: 'User',
        dataIndex: 'userId',
        width: 110,
        render: (v) => <IdCell facetKey="userId" value={v} onAddFilter={onAddFilter} />,
      },
      {
        title: 'Project',
        dataIndex: 'projectId',
        width: 110,
        render: (v) => <IdCell facetKey="projectId" value={v} onAddFilter={onAddFilter} />,
      },
    ],
    [onAddFilter],
  );

  return (
    <Table
      className="log-table"
      rowKey="id"
      size="small"
      virtual
      columns={columns}
      dataSource={logs}
      loading={loading}
      scroll={{ x: 1740, y: height }}
      pagination={{
        defaultPageSize: 50,
        pageSizeOptions: [25, 50, 100, 200, 500, 1000],
        showSizeChanger: true,
        // Pages split the loaded logs only; the server may hold more (see CoverageNotice).
        showTotal: (total, range) =>
          `${range[0]}–${range[1]} of ${total.toLocaleString()} ${total < loadedCount ? `(filtered from ${loadedCount.toLocaleString()} loaded)` : 'loaded'}`,
      }}
      onRow={(log) => ({ onClick: () => onOpen(log) })}
      rowClassName={(log) =>
        ['log-row', log.isError && log.errorMessage !== 'Canceled' ? 'row-error' : '', log.id === selectedId ? 'row-selected' : '']
          .filter(Boolean)
          .join(' ')
      }
    />
  );
}
