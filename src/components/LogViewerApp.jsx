'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, App as AntApp, Card, Col, ConfigProvider, Empty, Layout, Row, Space, Switch, Tabs, Tag, theme, Typography } from 'antd';
import { BarsOutlined, GroupOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons';
import ConnectionBar from './ConnectionBar';
import FilterPanel from './FilterPanel';
import ActiveFilters from './ActiveFilters';
import StatsBar from './StatsBar';
import LogTable from './LogTable';
import GroupedView from './GroupedView';
import LogDetailDrawer from './LogDetailDrawer';
import { useLogs } from '../hooks/useLogs';
import { usePersistentState } from '../hooks/usePersistentState';
import { describeError } from '../api/logsApi';
import { cleanToken } from '../utils/jwt';
import {
  applyBaseFilters,
  applyFacetFilters,
  computeFacetOptions,
  countActiveFilters,
  createEmptyFilters,
} from '../utils/logUtils';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

function LogViewer({ environments, dark, onToggleDark }) {
  const { message } = AntApp.useApp();
  const { token: themeToken } = theme.useToken();

  const [envKey, setEnvKey] = usePersistentState('lv.env', environments[0].key);
  const getEnvironment = (key) => environments.find((e) => e.key === key) ?? environments[0];
  const [rawToken, setRawToken] = usePersistentState('lv.token', '');
  const [limit, setLimit] = usePersistentState('lv.limit', 100);
  const [refreshInterval, setRefreshInterval] = usePersistentState('lv.refreshInterval', 30);
  const [groupBy, setGroupBy] = usePersistentState('lv.groupBy', 'issue');
  const [tab, setTab] = usePersistentState('lv.tab', 'logs');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [filters, setFilters] = useState(createEmptyFilters);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);

  const store = useLogs();
  const token = cleanToken(rawToken);
  const conn = useMemo(() => ({ envKey, token, limit }), [envKey, token, limit]);

  /* ---------------- filtering ---------------- */

  const deferredFilters = useDeferredValue(filters);
  const baseFiltered = useMemo(() => applyBaseFilters(store.logs, deferredFilters), [store.logs, deferredFilters]);
  const facetOptions = useMemo(() => computeFacetOptions(baseFiltered, deferredFilters.facets), [baseFiltered, deferredFilters.facets]);
  const filtered = useMemo(() => applyFacetFilters(baseFiltered, deferredFilters.facets), [baseFiltered, deferredFilters.facets]);
  const activeCount = countActiveFilters(filters);

  const resetFilters = useCallback(() => setFilters(createEmptyFilters()), []);

  const addFilter = useCallback((key, value, negate = false) => {
    setFilters((f) => {
      const cur = f.facets[key];
      // switching between "is" and "is not" starts a fresh selection for that facet
      const values = cur && Boolean(cur.negate) === negate ? cur.values : [];
      if (values.includes(value)) return f;
      return { ...f, facets: { ...f.facets, [key]: { negate, values: [...values, value] } } };
    });
  }, []);

  const applyGroup = useCallback((fields, values) => {
    setFilters((f) => {
      const facets = { ...f.facets };
      fields.forEach((field, i) => {
        facets[field] = { negate: false, values: [values[i]] };
      });
      return { ...f, facets };
    });
    setTab('logs');
  }, [setTab]);

  const toggleQuick = useCallback((key) => {
    setFilters((f) => ({ ...f, quick: f.quick.includes(key) ? f.quick.filter((k) => k !== key) : [...f.quick, key] }));
  }, []);

  /* ---------------- fetching ---------------- */

  const run = useCallback(
    async (fn) => {
      if (!token) {
        message.warning('Paste an auth token first');
        return undefined;
      }
      setError(null);
      try {
        return await fn();
      } catch (err) {
        if (err?.name === 'AbortError') {
          message.info('Cancelled');
          return undefined;
        }
        const text = describeError(err);
        setError(text);
        message.error(text);
        return undefined;
      }
    },
    [token, message],
  );

  const onFetch = () =>
    run(async () => {
      const res = await store.fetchFirst(conn);
      message.success(`Fetched ${res.received} of ${res.total.toLocaleString()} logs`);
    });

  const onLoadMore = () =>
    run(async () => {
      const res = await store.loadMore(conn);
      if (res.received && !res.added) message.warning('Server returned only logs that are already loaded (skip may be ignored).');
      else message.success(`Loaded ${res.added} more`);
    });

  const onLoadAll = () =>
    run(async () => {
      const res = await store.loadAll(conn);
      if (res.stalled) message.warning('Stopped: the server kept returning already-loaded logs.');
      else message.success(`Loaded ${res.loaded.toLocaleString()} logs`);
    });

  const onEnvChange = (key) => {
    setEnvKey(key);
    setAutoRefresh(false);
    setSelectedId(null);
    setError(null);
    store.clear();
    message.info(`Switched to ${getEnvironment(key).label} — fetch to load its logs`);
  };

  const onExport = () => {
    const blob = new Blob([JSON.stringify(filtered.map((l) => l.raw), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zillit-logs-${envKey}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (file) => {
    try {
      const json = JSON.parse(await file.text());
      const rawLogs = Array.isArray(json) ? json : json?.data?.logs ?? json?.logs;
      if (!Array.isArray(rawLogs)) throw new Error('Expected a fetchlog response ({ data: { logs } }) or an array of logs');
      setAutoRefresh(false);
      setSelectedId(null);
      setError(null);
      const count = store.importRaw(rawLogs);
      message.success(`Imported ${count.toLocaleString()} logs from ${file.name}`);
    } catch (err) {
      message.error(`Import failed: ${err.message}`);
    }
  };

  // Auto-refresh pulls the newest page on an interval and merges new logs on top.
  const connRef = useRef(conn);
  connRef.current = conn;
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const id = setInterval(async () => {
      try {
        const res = await store.refreshLatest(connRef.current);
        if (res.added) message.info(`${res.added} new log${res.added === 1 ? '' : 's'}`);
      } catch (err) {
        setAutoRefresh(false);
        const text = describeError(err);
        setError(text);
        message.error(`Auto-refresh stopped: ${text}`);
      }
    }, refreshInterval * 1000);
    return () => clearInterval(id);
  }, [autoRefresh, refreshInterval, store.refreshLatest, message]);

  /* ---------------- detail drawer ---------------- */

  const selectedLog = useMemo(
    () => (selectedId ? filtered.find((l) => l.id === selectedId) ?? store.logs.find((l) => l.id === selectedId) ?? null : null),
    [selectedId, filtered, store.logs],
  );
  const selectedIndex = selectedId ? filtered.findIndex((l) => l.id === selectedId) : -1;

  const navigate = useCallback(
    (delta) => {
      const next = filtered[selectedIndex + delta];
      if (next) setSelectedId(next.id);
    },
    [filtered, selectedIndex],
  );

  const openLog = useCallback((log) => setSelectedId(log.id), []);

  const env = getEnvironment(envKey);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        className="app-header"
        style={{ background: themeToken.colorBgContainer, borderBottom: `1px solid ${themeToken.colorBorderSecondary}` }}
      >
        <Space size={10}>
          <BarsOutlined style={{ fontSize: 20, color: themeToken.colorPrimary }} />
          <Title level={4} style={{ margin: 0 }}>
            Zillit Log Viewer
          </Title>
          <Tag color={env.color}>{env.label}</Tag>
        </Space>
        <Space>
          <SunOutlined />
          <Switch size="small" checked={dark} onChange={onToggleDark} />
          <MoonOutlined />
        </Space>
      </Header>

      <Content className="app-content">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <ConnectionBar
            environments={environments}
            envKey={envKey}
            onEnvChange={onEnvChange}
            token={rawToken}
            onTokenChange={setRawToken}
            cleanedToken={token}
            limit={limit}
            onLimitChange={setLimit}
            status={store.status}
            progress={store.progress}
            total={store.total}
            loadedCount={store.logs.length}
            lastFetchedAt={store.lastFetchedAt}
            onFetch={onFetch}
            onLoadMore={onLoadMore}
            onLoadAll={onLoadAll}
            onCancel={store.cancel}
            autoRefresh={autoRefresh}
            onAutoRefreshChange={setAutoRefresh}
            refreshInterval={refreshInterval}
            onRefreshIntervalChange={setRefreshInterval}
            onExport={onExport}
            onImport={onImport}
            exportCount={filtered.length}
          />

          {error && <Alert type="error" showIcon closable message={error} onClose={() => setError(null)} />}

          <StatsBar logs={filtered} loadedCount={store.logs.length} total={store.total} onQuickFilter={toggleQuick} />

          <Row gutter={[12, 12]}>
            <Col xs={24} lg={7} xl={6} xxl={5}>
              <FilterPanel
                filters={filters}
                onChange={setFilters}
                facetOptions={facetOptions}
                activeCount={activeCount}
                onReset={resetFilters}
              />
            </Col>
            <Col xs={24} lg={17} xl={18} xxl={19}>
              <Card size="small" styles={{ body: { paddingTop: 0 } }}>
                <Tabs
                  activeKey={tab}
                  onChange={setTab}
                  items={[
                    { key: 'logs', label: <span><BarsOutlined /> Logs ({filtered.length.toLocaleString()})</span> },
                    { key: 'grouped', label: <span><GroupOutlined /> Grouped</span> },
                  ]}
                />
                <ActiveFilters filters={filters} onChange={setFilters} onReset={resetFilters} />
                {store.logs.length === 0 && store.status === 'idle' ? (
                  <Empty
                    style={{ padding: 48 }}
                    description={
                      <Space direction="vertical" size={2}>
                        <Text>No logs loaded</Text>
                        <Text type="secondary">Pick an environment, paste an auth token and press “Fetch latest”.</Text>
                      </Space>
                    }
                  />
                ) : tab === 'logs' ? (
                  <LogTable
                    logs={filtered}
                    loading={store.status === 'loading'}
                    onOpen={openLog}
                    onAddFilter={addFilter}
                    selectedId={selectedId}
                  />
                ) : (
                  <GroupedView logs={filtered} groupBy={groupBy} onGroupByChange={setGroupBy} onApplyGroup={applyGroup} onOpen={openLog} />
                )}
              </Card>
            </Col>
          </Row>
        </Space>
      </Content>

      <LogDetailDrawer
        log={selectedLog}
        onClose={() => setSelectedId(null)}
        onAddFilter={addFilter}
        onNavigate={navigate}
        position={{ index: selectedIndex, total: filtered.length }}
      />
    </Layout>
  );
}

export default function LogViewerApp({ environments }) {
  const [dark, setDark] = usePersistentState('lv.dark', false);
  return (
    <ConfigProvider theme={{ algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm, token: { borderRadius: 6 } }}>
      <AntApp>
        <LogViewer environments={environments} dark={dark} onToggleDark={setDark} />
      </AntApp>
    </ConfigProvider>
  );
}
