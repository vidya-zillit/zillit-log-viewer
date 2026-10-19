import { Button, Card, Flex, Input, Popconfirm, Progress, Select, Space, Switch, Tag, Tooltip, Typography, Upload } from 'antd';
import { CloudDownloadOutlined, DownloadOutlined, KeyOutlined, PlusOutlined, ReloadOutlined, StopOutlined, UploadOutlined } from '@ant-design/icons';
import { fromNow } from '../utils/logUtils';
import TokenStatus from './TokenStatus';

const { Text } = Typography;

const LIMIT_OPTIONS = [50, 100, 200, 500, 1000].map((n) => ({ value: n, label: `${n} / request` }));
export const AUTO_REFRESH_OPTIONS = [15, 30, 60, 120].map((s) => ({ value: s, label: `every ${s}s` }));

export default function ConnectionBar({
  environments,
  envKey,
  onEnvChange,
  token,
  onTokenChange,
  cleanedToken,
  limit,
  onLimitChange,
  status,
  progress,
  total,
  loadedCount,
  lastFetchedAt,
  onFetch,
  onLoadMore,
  onLoadAll,
  onCancel,
  autoRefresh,
  onAutoRefreshChange,
  refreshInterval,
  onRefreshIntervalChange,
  onExport,
  onImport,
  exportCount,
  serverFiltered,
  rangeMode,
}) {
  const env = environments.find((e) => e.key === envKey) ?? environments[0];
  const busy = status !== 'idle';
  const canLoadMore = total !== null && loadedCount < total;
  const remaining = total !== null ? Math.max(total - loadedCount, 0) : 0;

  return (
    <Card size="small">
      <Flex wrap gap={12} align="flex-start">
        <div>
          <div className="field-label">Environment</div>
          <Select
            value={envKey}
            onChange={onEnvChange}
            style={{ width: 130 }}
            options={environments.map((e) => ({
              value: e.key,
              label: (
                <Space size={6}>
                  <Tag color={e.color} style={{ marginInlineEnd: 0 }}>
                    {e.label}
                  </Tag>
                </Space>
              ),
            }))}
          />
        </div>

        <div style={{ flex: '1 1 360px', minWidth: 260 }}>
          <div className="field-label">
            Auth token <Text type="secondary">(Bearer — “Bearer …” prefix is stripped automatically)</Text>
          </div>
          <Input.Password
            value={token}
            onChange={(e) => onTokenChange(e.target.value)}
            onPressEnter={onFetch}
            placeholder="eyJhbGciOi…"
            prefix={<KeyOutlined />}
            allowClear
          />
          <div style={{ marginTop: 4 }}>
            <TokenStatus token={cleanedToken} />
          </div>
        </div>

        <div>
          <div className="field-label">Logs per request</div>
          <Tooltip title={rangeMode ? 'Ignored while a date range is set: Fetch loads the whole range, 1,000 per request' : undefined}>
            <Select value={limit} onChange={onLimitChange} options={LIMIT_OPTIONS} style={{ width: 150 }} disabled={rangeMode} />
          </Tooltip>
        </div>

        <div>
          <div className="field-label">&nbsp;</div>
          <Space wrap>
            <Button type="primary" icon={<ReloadOutlined />} onClick={onFetch} loading={status === 'loading'} disabled={status === 'loadingAll'}>
              {rangeMode ? 'Fetch range' : 'Fetch latest'}
            </Button>
            <Button icon={<PlusOutlined />} onClick={onLoadMore} disabled={busy || !canLoadMore}>
              Load more
            </Button>
            <Popconfirm
              title="Load every remaining log?"
              description={`${remaining.toLocaleString()} logs ≈ ${Math.ceil(remaining / limit)} requests of ${limit}.`}
              onConfirm={onLoadAll}
              disabled={busy || !canLoadMore}
            >
              <Button icon={<CloudDownloadOutlined />} disabled={busy || !canLoadMore}>
                Load all
              </Button>
            </Popconfirm>
            {busy && (
              <Button danger icon={<StopOutlined />} onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Upload accept=".json,application/json" showUploadList={false} beforeUpload={(file) => (onImport(file), false)}>
              <Tooltip title="Open a saved fetchlog response (or a JSON array of logs)">
                <Button icon={<UploadOutlined />}>Import JSON</Button>
              </Tooltip>
            </Upload>
            <Tooltip title="Download the logs that match the current filters as JSON">
              <Button icon={<DownloadOutlined />} onClick={onExport} disabled={!exportCount}>
                Export ({exportCount.toLocaleString()})
              </Button>
            </Tooltip>
          </Space>
        </div>
      </Flex>

      <Flex wrap gap={16} align="center" style={{ marginTop: 10 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {env.baseUrl}
        </Text>
        <Text style={{ fontSize: 12 }}>
          Loaded <b>{loadedCount.toLocaleString()}</b>
          {total !== null && (
            <>
              {' '}
              of <b>{total.toLocaleString()}</b> {serverFiltered ? 'matching the server query' : 'on server'}
            </>
          )}
          {lastFetchedAt && <Text type="secondary"> · updated {fromNow(lastFetchedAt)}</Text>}
        </Text>
        <Space size={6}>
          <Switch size="small" checked={autoRefresh} onChange={onAutoRefreshChange} disabled={!cleanedToken} />
          <Text style={{ fontSize: 12 }}>Auto-refresh</Text>
          <Select size="small" value={refreshInterval} onChange={onRefreshIntervalChange} options={AUTO_REFRESH_OPTIONS} style={{ width: 110 }} />
        </Space>
        {progress && (
          <Flex align="center" gap={8} style={{ flex: '1 1 240px', maxWidth: 420 }}>
            <Progress
              size="small"
              percent={progress.total ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : 0}
              status="active"
              style={{ margin: 0, flex: 1 }}
            />
            <Text style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
              {progress.loaded.toLocaleString()}
              {progress.total ? ` / ${progress.total.toLocaleString()}` : ''}
            </Text>
          </Flex>
        )}
      </Flex>
    </Card>
  );
}
