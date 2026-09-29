import { useEffect } from 'react';
import { Button, Descriptions, Divider, Drawer, Flex, Grid, Space, Tag, Tooltip, Typography } from 'antd';
import { LeftOutlined, MinusCircleOutlined, PlusCircleOutlined, RightOutlined } from '@ant-design/icons';
import { formatDuration, formatTime, formatUtc, fromNow, statusColor } from '../utils/logUtils';
import { CategoryTag, PlatformTag, StatusTag } from './LogCells';
import JsonBlock from './JsonBlock';

const { Text } = Typography;

/** Value with copy + "filter is / is not" shortcuts. */
function Value({ facetKey, value, display, onAddFilter, mono = true }) {
  if (value === null || value === undefined || value === '') return <Text type="secondary">—</Text>;
  const text = String(value);
  return (
    <Flex align="center" gap={6} wrap>
      <Text className={mono ? 'mono' : undefined} copyable={{ text }} style={{ wordBreak: 'break-all' }}>
        {display ?? text}
      </Text>
      {facetKey && (
        <Space size={2}>
          <Tooltip title="Show only this">
            <Button size="small" type="text" icon={<PlusCircleOutlined />} onClick={() => onAddFilter(facetKey, text, false)} />
          </Tooltip>
          <Tooltip title="Exclude this">
            <Button size="small" type="text" icon={<MinusCircleOutlined />} onClick={() => onAddFilter(facetKey, text, true)} />
          </Tooltip>
        </Space>
      )}
    </Flex>
  );
}

function Section({ title, items }) {
  const visible = items.filter(Boolean);
  if (!visible.length) return null;
  return (
    <>
      <Divider orientation="left" orientationMargin={0} style={{ margin: '16px 0 8px' }}>
        {title}
      </Divider>
      <Descriptions size="small" bordered column={1} items={visible} labelStyle={{ width: 140 }} />
    </>
  );
}

export default function LogDetailDrawer({ log, onClose, onAddFilter, onNavigate, position }) {
  const screens = Grid.useBreakpoint();

  useEffect(() => {
    if (!log) return undefined;
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowUp' || e.key === 'k') onNavigate(-1);
      if (e.key === 'ArrowDown' || e.key === 'j') onNavigate(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [log, onNavigate]);

  const v = (facetKey, value, extra) => <Value facetKey={facetKey} value={value} onAddFilter={onAddFilter} {...extra} />;

  return (
    <Drawer
      open={Boolean(log)}
      onClose={onClose}
      width={screens.md ? 760 : '100%'}
      destroyOnClose
      title={
        log && (
          <Space wrap>
            <PlatformTag log={log} onAddFilter={onAddFilter} />
            <CategoryTag log={log} onAddFilter={onAddFilter} />
            <StatusTag log={log} onAddFilter={onAddFilter} />
            <Text strong className="mono">
              {log.name}
            </Text>
          </Space>
        )
      }
      extra={
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {position.index + 1} / {position.total}
          </Text>
          <Tooltip title="Newer (↑ / k)">
            <Button icon={<LeftOutlined />} onClick={() => onNavigate(-1)} disabled={position.index <= 0} />
          </Tooltip>
          <Tooltip title="Older (↓ / j)">
            <Button icon={<RightOutlined />} onClick={() => onNavigate(1)} disabled={position.index >= position.total - 1} />
          </Tooltip>
        </Space>
      }
    >
      {log && (
        <>
          <Section
            title="Overview"
            items={[
              { key: 'event', label: 'Event time', children: <Value value={`${formatTime(log.eventTime)}  (${fromNow(log.eventTime)})`} /> },
              { key: 'utc', label: 'Event time UTC', children: <Value value={formatUtc(log.eventTime)} /> },
              { key: 'recv', label: 'Received', children: <Value value={formatTime(log.createdAt)} /> },
              log.ingestDelayMs !== null && {
                key: 'delay',
                label: 'Upload delay',
                children: (
                  <Tag color={log.ingestDelayMs > 60_000 ? 'orange' : 'default'}>{formatDuration(log.ingestDelayMs)}</Tag>
                ),
              },
              { key: 'name', label: 'Name', children: v('name', log.name) },
              { key: 'category', label: 'Category', children: v('category', log.category) },
              { key: 'network', label: 'Network', children: v('network', log.network) },
            ]}
          />

          {log.apiUrl && (
            <Section
              title="API"
              items={[
                { key: 'method', label: 'Method', children: v('apiMethod', log.apiMethod) },
                { key: 'url', label: 'URL', children: v(null, log.apiUrl) },
                { key: 'host', label: 'Host', children: v('apiHost', log.apiHost) },
                { key: 'endpoint', label: 'Endpoint', children: v('endpoint', log.endpoint) },
                {
                  key: 'status',
                  label: 'Status',
                  children:
                    log.apiStatus !== null ? (
                      <Space>
                        <Tag color={statusColor(log.apiStatus)}>{log.apiStatus}</Tag>
                        {v('apiStatus', log.apiStatus)}
                      </Space>
                    ) : (
                      v('statusGroup', log.statusGroup)
                    ),
                },
                log.apiRequest && { key: 'req', label: 'Request', children: <JsonBlock value={log.apiRequest} maxHeight={240} /> },
                log.apiResponse && { key: 'res', label: 'Response', children: <JsonBlock value={log.apiResponse} maxHeight={240} /> },
              ]}
            />
          )}

          {(log.errorMessage || log.errorCode) && (
            <Section
              title="Error"
              items={[
                { key: 'msg', label: 'Message', children: v('errorMessage', log.errorMessage) },
                log.errorCode && { key: 'code', label: 'Code', children: v('errorCode', log.errorCode) },
              ]}
            />
          )}

          {log.context && (
            <Section
              title="Context"
              items={Object.entries(log.context).map(([key, value]) => ({
                key,
                label: key,
                children:
                  value === null ||
                  typeof value === 'number' ||
                  typeof value === 'boolean' ||
                  (typeof value === 'string' && !value.trim().startsWith('{') && !value.includes('\n')) ? (
                    <Value value={value} />
                  ) : (
                    <JsonBlock value={value} maxHeight={260} />
                  ),
              }))}
            />
          )}

          <Section
            title="Device & app"
            items={[
              { key: 'platform', label: 'Platform', children: v('platform', log.platform) },
              { key: 'model', label: 'Device model', children: v('deviceModel', log.deviceModel) },
              { key: 'os', label: 'OS version', children: v('osVersion', log.osVersion) },
              { key: 'app', label: 'App version', children: v('appVersion', log.appVersion) },
              { key: 'device', label: 'Device ID', children: v('deviceId', log.deviceId) },
              { key: 'install', label: 'Install ID', children: v('installId', log.installId) },
            ]}
          />

          <Section
            title="Identity"
            items={[
              { key: 'project', label: 'Project ID', children: v('projectId', log.projectId) },
              { key: 'user', label: 'User ID', children: v('userId', log.userId) },
            ]}
          />

          <Section
            title="Meta"
            items={[
              { key: 'id', label: '_id', children: v(null, log.id) },
              { key: 'uid', label: 'unique_id', children: v(null, log.uniqueId) },
              { key: 'fp', label: 'Fingerprint', children: v(null, log.fingerprint) },
              { key: 'schema', label: 'Schema / normaliser', children: <Value value={`v${log.schemaVersion ?? '?'} / v${log.normaliserVersion ?? '?'}`} /> },
              {
                key: 'conformed',
                label: 'Conformed',
                children: <Tag color={log.conformed ? 'green' : 'red'}>{String(log.conformed ?? 'unknown')}</Tag>,
              },
            ]}
          />

          <Divider orientation="left" orientationMargin={0} style={{ margin: '16px 0 8px' }}>
            Raw JSON
          </Divider>
          <JsonBlock value={log.raw} maxHeight={600} />
        </>
      )}
    </Drawer>
  );
}
