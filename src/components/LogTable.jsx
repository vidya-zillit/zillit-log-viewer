import { useMemo } from 'react';
import { Table, Tooltip, Typography } from 'antd';
import { formatTime, formatUtc, fromNow } from '../utils/logUtils';
import { CategoryTag, FilterTag, PlatformTag, StatusTag } from './LogCells';
import JsonBlock from './JsonBlock';

const { Text } = Typography;

const byString = (key) => (a, b) => (a[key] || '').localeCompare(b[key] || '');

function IdCell({ facetKey, value, onAddFilter }) {
  if (!value) return <Text type="secondary">—</Text>;
  return (
    <Tooltip title={`${value} — click to filter`}>
      <Text
        className="id-cell"
        onClick={(e) => {
          e.stopPropagation();
          onAddFilter(facetKey, value, e.altKey);
        }}
      >
        {value.length > 10 ? `…${value.slice(-8)}` : value}
      </Text>
    </Tooltip>
  );
}

export default function LogTable({ logs, loading, onOpen, onAddFilter, selectedId }) {
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
          <Tooltip
            title={
              <div>
                <div>Event: {formatTime(log.eventTime)}</div>
                <div>{formatUtc(log.eventTime)}</div>
                <div>Received: {formatTime(log.createdAt)}</div>
              </div>
            }
          >
            <div className="mono">{formatTime(t, 'MM-DD HH:mm:ss.SSS')}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {fromNow(t)}
            </Text>
          </Tooltip>
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
          <div className="cell-clip">
            <Text strong className="mono" ellipsis={{ tooltip: name }} style={{ maxWidth: 320 }}>
              {name || '—'}
            </Text>
            {log.apiHost && (
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {log.apiHost}
                </Text>
              </div>
            )}
          </div>
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
            <Text type={log.errorMessage === 'Canceled' ? 'secondary' : 'danger'} ellipsis={{ tooltip: msg }} style={{ maxWidth: 260 }}>
              {log.errorCode && log.errorCode !== String(log.apiStatus) ? `[${log.errorCode}] ` : ''}
              {msg}
            </Text>
          ) : (
            <Text type="secondary">—</Text>
          ),
      },
      {
        title: 'Device',
        dataIndex: 'deviceModel',
        width: 185,
        sorter: byString('deviceModel'),
        render: (model, log) => (
          <div>
            <Text ellipsis={{ tooltip: model }} style={{ maxWidth: 170 }}>
              {model || '—'}
            </Text>
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {log.platform} {log.osVersion}
              </Text>
            </div>
          </div>
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
      rowKey="id"
      size="small"
      columns={columns}
      dataSource={logs}
      loading={loading}
      scroll={{ x: 1740 }}
      sticky
      pagination={{
        defaultPageSize: 50,
        pageSizeOptions: [25, 50, 100, 200, 500],
        showSizeChanger: true,
        showTotal: (total, range) => `${range[0]}–${range[1]} of ${total.toLocaleString()}`,
      }}
      expandable={{
        expandedRowRender: (log) => <JsonBlock value={log.raw} maxHeight={420} />,
        columnWidth: 36,
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
