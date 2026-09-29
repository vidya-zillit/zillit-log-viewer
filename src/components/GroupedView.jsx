import { useMemo } from 'react';
import { Button, Flex, Progress, Segmented, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { EyeOutlined, FilterOutlined } from '@ant-design/icons';
import { EMPTY, facetLabel, formatTime, fromNow, GROUP_BYS, groupLogs, PLATFORM_COLORS } from '../utils/logUtils';

const { Text } = Typography;

/** Aggregates the filtered logs so repeated issues collapse into one row with counts. */
export default function GroupedView({ logs, groupBy, onGroupByChange, onApplyGroup, onOpen }) {
  const def = GROUP_BYS.find((g) => g.key === groupBy) ?? GROUP_BYS[0];
  const groups = useMemo(() => groupLogs(logs, def.fields), [logs, def]);
  const max = groups[0]?.count ?? 1;

  const columns = [
    ...def.fields.map((field, i) => ({
      title: facetLabel(field),
      key: field,
      width: i === 0 ? 360 : 280,
      render: (_, g) =>
        g.values[i] === EMPTY ? (
          <Text type="secondary">{EMPTY}</Text>
        ) : (
          <Text className="mono" ellipsis={{ tooltip: g.values[i] }} style={{ maxWidth: i === 0 ? 340 : 260 }}>
            {g.values[i]}
          </Text>
        ),
    })),
    {
      title: 'Count',
      dataIndex: 'count',
      width: 170,
      sorter: (a, b) => a.count - b.count,
      defaultSortOrder: 'descend',
      render: (count) => (
        <Flex align="center" gap={8}>
          <Text strong style={{ minWidth: 40 }}>
            {count.toLocaleString()}
          </Text>
          <Progress percent={(count / max) * 100} showInfo={false} size="small" style={{ margin: 0, flex: 1 }} />
        </Flex>
      ),
    },
    {
      title: 'Errors',
      dataIndex: 'errorCount',
      width: 80,
      sorter: (a, b) => a.errorCount - b.errorCount,
      render: (n) => (n ? <Text type="danger">{n}</Text> : <Text type="secondary">0</Text>),
    },
    {
      title: 'Platforms',
      dataIndex: 'platforms',
      width: 150,
      render: (platforms) => platforms.map((p) => <Tag key={p} color={PLATFORM_COLORS[p]}>{p}</Tag>),
    },
    { title: 'Users', dataIndex: 'userCount', width: 75, sorter: (a, b) => a.userCount - b.userCount },
    { title: 'Devices', dataIndex: 'deviceCount', width: 80, sorter: (a, b) => a.deviceCount - b.deviceCount },
    {
      title: 'First seen',
      dataIndex: 'first',
      width: 140,
      sorter: (a, b) => (a.first ?? 0) - (b.first ?? 0),
      render: (t) => <Tooltip title={formatTime(t)}>{formatTime(t, 'MM-DD HH:mm:ss')}</Tooltip>,
    },
    {
      title: 'Last seen',
      dataIndex: 'last',
      width: 140,
      sorter: (a, b) => (a.last ?? 0) - (b.last ?? 0),
      render: (t) => (
        <Tooltip title={formatTime(t)}>
          <div>{formatTime(t, 'MM-DD HH:mm:ss')}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {fromNow(t)}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      fixed: 'right',
      render: (_, g) => (
        <Space size={2}>
          <Tooltip title="Filter the log list to this group">
            <Button size="small" type="text" icon={<FilterOutlined />} onClick={() => onApplyGroup(def.fields, g.values)} />
          </Tooltip>
          <Tooltip title="Open latest log in this group">
            <Button size="small" type="text" icon={<EyeOutlined />} onClick={() => onOpen(g.sample)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Flex wrap gap={8} align="center" style={{ marginBottom: 8 }}>
        <Text type="secondary">Group by</Text>
        <Segmented value={def.key} onChange={onGroupByChange} options={GROUP_BYS.map((g) => ({ label: g.label, value: g.key }))} />
        <Text type="secondary">{groups.length.toLocaleString()} groups</Text>
      </Flex>
      <Table
        rowKey="key"
        size="small"
        columns={columns}
        dataSource={groups}
        scroll={{ x: 1200 }}
        pagination={{ defaultPageSize: 50, showSizeChanger: true, pageSizeOptions: [25, 50, 100, 200] }}
      />
    </>
  );
}
