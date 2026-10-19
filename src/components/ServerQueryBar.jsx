import { useMemo, useState } from 'react';
import { AutoComplete, Badge, Button, Card, Col, DatePicker, Flex, Input, Row, Segmented, Select, Space, Tag, Tooltip, Typography } from 'antd';
import { CloudServerOutlined, DownOutlined, SearchOutlined, UpOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  countServerQuery,
  createEmptyServerQuery,
  describeServerQuery,
  hasTimeRange,
  RANGE_LOAD_CAP,
  SERVER_FIELDS,
  serverQueryKey,
  TIME_PRESETS,
} from '../config/serverQuery';

const { Text } = Typography;
const { RangePicker } = DatePicker;
const MAX_SUGGESTIONS = 200;

function Field({ label, children }) {
  return (
    <div>
      <div className="field-label">{label}</div>
      {children}
    </div>
  );
}

/** Distinct values of each exact-match field among the loaded logs, most frequent first. */
function useSuggestions(logs, enabled) {
  return useMemo(() => {
    if (!enabled) return {};
    const result = {};
    for (const { key, logKey } of SERVER_FIELDS) {
      const counts = new Map();
      for (const log of logs) {
        const v = log[logKey];
        if (v === null || v === undefined || v === '') continue;
        const s = String(v);
        counts.set(s, (counts.get(s) || 0) + 1);
      }
      result[key] = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_SUGGESTIONS)
        .map(([value, count]) => ({ value, label: `${value}  (${count})` }));
    }
    return result;
  }, [logs, enabled]);
}

/**
 * Filters the API applies before anything is downloaded: the date range (on received time)
 * and exact-match fields. Edits take effect on the next fetch; the filter panel below keeps
 * refining whatever is loaded.
 */
export default function ServerQueryBar({ draft, onChange, applied, logs, onApply, busy, hasToken }) {
  const [expanded, setExpanded] = useState(() => SERVER_FIELDS.some((f) => draft.fields[f.key]));
  const suggestions = useSuggestions(logs, expanded);

  const set = (patch) => onChange((d) => ({ ...d, ...patch }));
  const setField = (key, value) => onChange((d) => ({ ...d, fields: { ...d.fields, [key]: value } }));

  const count = countServerQuery(draft);
  const fieldCount = SERVER_FIELDS.filter((f) => (draft.fields[f.key] ?? '').trim()).length;
  const dirty = applied !== null && serverQueryKey(applied.draft) !== serverQueryKey(draft);
  const appliedSummary = applied ? describeServerQuery(applied.draft) : '';
  const rangeValue = draft.range ? draft.range.map((ms) => (ms === null ? null : dayjs(ms))) : null;

  return (
    <Card
      size="small"
      title={
        <Space size={8}>
          <CloudServerOutlined />
          Server query
          {count > 0 && <Badge count={count} color="blue" />}
          <Text type="secondary" style={{ fontWeight: 'normal', fontSize: 12 }}>
            decides which logs are fetched
          </Text>
        </Space>
      }
      extra={
        <Button size="small" onClick={() => onChange(createEmptyServerQuery())} disabled={!count}>
          Clear
        </Button>
      }
    >
      <Flex wrap gap={12} align="flex-end">
        <Field label="Received time (server)">
          <Space.Compact>
            <Select value={draft.time} onChange={(time) => set({ time })} options={TIME_PRESETS.map((p) => ({ value: p.key, label: p.label }))} style={{ width: 150 }} />
            {draft.time === 'custom' && (
              <RangePicker
                showTime={{ format: 'HH:mm' }}
                format="YYYY-MM-DD HH:mm"
                allowEmpty={[true, true]}
                value={rangeValue}
                onChange={(v) =>
                  set({
                    range:
                      v && (v[0] || v[1])
                        ? [v[0] ? v[0].startOf('minute').valueOf() : null, v[1] ? v[1].endOf('minute').valueOf() : null]
                        : null,
                  })
                }
              />
            )}
          </Space.Compact>
        </Field>

        <Field label="Errors">
          <Tooltip title={draft.search.trim() ? 'Ignored while “Error message contains” is set (the API gives search priority)' : undefined}>
            <Segmented
              value={draft.hasError}
              onChange={(hasError) => set({ hasError })}
              disabled={Boolean(draft.search.trim())}
              options={[
                { label: 'Any', value: '' },
                { label: 'With error', value: 'true' },
                { label: 'Without', value: 'false' },
              ]}
            />
          </Tooltip>
        </Field>

        <Field label="Error message contains">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="timeout"
            value={draft.search}
            onChange={(e) => set({ search: e.target.value })}
            onPressEnter={onApply}
            style={{ width: 200 }}
          />
        </Field>

        <Button type="link" onClick={() => setExpanded((x) => !x)} icon={expanded ? <UpOutlined /> : <DownOutlined />}>
          Exact-match fields{fieldCount > 0 ? ` (${fieldCount})` : ''}
        </Button>
      </Flex>

      {expanded && (
        <Row gutter={[12, 10]} style={{ marginTop: 12 }}>
          {SERVER_FIELDS.map((f) => (
            <Col key={f.key} xs={24} sm={12} md={8} lg={6} xl={4}>
              <Field label={f.label}>
                <AutoComplete
                  allowClear
                  style={{ width: '100%' }}
                  value={draft.fields[f.key] ?? ''}
                  options={suggestions[f.key]}
                  onChange={(v) => setField(f.key, v ?? '')}
                  filterOption={(input, opt) => opt.value.toLowerCase().includes(input.toLowerCase())}
                  placeholder={f.key === 'api_status' ? '500' : 'exact value'}
                  status={f.key === 'api_status' && draft.fields.api_status?.trim() && !/^\d{3}$/.test(draft.fields.api_status.trim()) ? 'error' : undefined}
                  popupMatchSelectWidth={320}
                />
              </Field>
            </Col>
          ))}
        </Row>
      )}

      <Flex wrap gap={8} align="center" style={{ marginTop: 10, minHeight: 24 }}>
        {dirty ? (
          <>
            <Tag color="warning" style={{ marginInlineEnd: 0 }}>
              Changed — not applied yet
            </Tag>
            <Button size="small" type="primary" onClick={onApply} disabled={busy || !hasToken}>
              Apply &amp; fetch
            </Button>
          </>
        ) : applied ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Loaded logs match: {appliedSummary || 'no server filters (everything)'}
          </Text>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {hasTimeRange(draft)
              ? `Fetch range loads every matching log (up to ${RANGE_LOAD_CAP.toLocaleString()}), 1,000 per request. Dates filter on when the server received the log.`
              : 'Applied when you press Fetch latest. Dates filter on when the server received the log.'}
          </Text>
        )}
      </Flex>
    </Card>
  );
}
