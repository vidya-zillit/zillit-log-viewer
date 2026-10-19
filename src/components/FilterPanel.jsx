import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, Collapse, DatePicker, Flex, Input, Segmented, Select, Space, Tag, Typography } from 'antd';
import { FilterOutlined, SearchOutlined, StopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { FACETS, FACET_GROUPS, QUICK_FILTERS } from '../utils/logUtils';

const { Text } = Typography;
const { RangePicker } = DatePicker;
const NO_OPTIONS = [];

const rangePresets = () => {
  const now = dayjs();
  return [
    { label: 'Last 15 min', value: [now.subtract(15, 'minute'), now] },
    { label: 'Last 1 hour', value: [now.subtract(1, 'hour'), now] },
    { label: 'Last 6 hours', value: [now.subtract(6, 'hour'), now] },
    { label: 'Last 24 hours', value: [now.subtract(24, 'hour'), now] },
    { label: 'Today', value: [now.startOf('day'), now.endOf('day')] },
    { label: 'Last 7 days', value: [now.subtract(7, 'day'), now] },
  ];
};

function Field({ label, children }) {
  return (
    <div>
      <div className="field-label">{label}</div>
      {children}
    </div>
  );
}

/**
 * Input that applies its value after the user pauses typing, so each keystroke doesn't
 * re-filter every loaded log. Picks up outside changes (Reset, removing a chip).
 */
function DebouncedInput({ value, onChange, delay = 250, ...rest }) {
  const [local, setLocal] = useState(value);
  const applied = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (value === applied.current) return;
    applied.current = value;
    setLocal(value);
  }, [value]);

  useEffect(() => {
    if (local === applied.current) return undefined;
    const id = setTimeout(() => {
      applied.current = local;
      onChangeRef.current(local);
    }, delay);
    return () => clearTimeout(id);
  }, [local, delay]);

  return <Input {...rest} value={local} onChange={(e) => setLocal(e.target.value)} />;
}

const FacetSelect = memo(function FacetSelect({ facet, state, options, onChange }) {
  const values = state?.values ?? [];
  const negate = Boolean(state?.negate);
  return (
    <div className="facet">
      <Flex justify="space-between" align="center" style={{ marginBottom: 4 }}>
        <Text strong style={{ fontSize: 12 }}>
          {facet.label} <Text type="secondary">({options.length})</Text>
        </Text>
        <Segmented
          size="small"
          value={negate ? 'not' : 'is'}
          onChange={(v) => onChange(facet.key, { negate: v === 'not' })}
          options={[
            { label: 'is', value: 'is' },
            { label: 'is not', value: 'not' },
          ]}
        />
      </Flex>
      <Select
        mode="multiple"
        allowClear
        showSearch
        size="small"
        style={{ width: '100%' }}
        placeholder={`Any ${facet.label.toLowerCase()}`}
        value={values}
        onChange={(v) => onChange(facet.key, { values: v })}
        options={options}
        optionRender={(opt) => (
          <Flex justify="space-between" gap={8}>
            <span className="opt-label" title={opt.data.value}>
              {opt.data.value}
            </span>
            <Text type="secondary">{opt.data.count}</Text>
          </Flex>
        )}
        maxTagCount="responsive"
        maxTagTextLength={28}
        popupMatchSelectWidth={380}
        status={negate && values.length ? 'warning' : undefined}
      />
    </div>
  );
});

export default function FilterPanel({ filters, onChange, facetOptions, activeCount, onReset }) {
  const set = (patch) => onChange((f) => ({ ...f, ...patch }));
  const setFacet = useCallback(
    (key, patch) =>
      onChange((f) => ({ ...f, facets: { ...f.facets, [key]: { values: [], negate: false, ...f.facets[key], ...patch } } })),
    [onChange],
  );
  const toggleQuick = (key, checked) =>
    onChange((f) => ({ ...f, quick: checked ? [...f.quick, key] : f.quick.filter((k) => k !== key) }));

  const rangeValue = filters.range ? filters.range.map((ms) => (ms === null ? null : dayjs(ms))) : null;

  const collapseItems = FACET_GROUPS.map((group) => {
    const facets = FACETS.filter((f) => f.group === group);
    const selected = facets.reduce((n, f) => n + (filters.facets[f.key]?.values?.length ?? 0), 0);
    return {
      key: group,
      label: (
        <Space size={6}>
          <span>{group}</span>
          {selected > 0 && <Badge count={selected} size="small" color="blue" />}
        </Space>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          {facets.map((facet) => (
            <FacetSelect
              key={facet.key}
              facet={facet}
              state={filters.facets[facet.key]}
              options={facetOptions[facet.key] ?? NO_OPTIONS}
              onChange={setFacet}
            />
          ))}
        </Space>
      ),
    };
  });

  return (
    <Card
      size="small"
      className="filter-card"
      title={
        <Space>
          <FilterOutlined />
          Filters
          {activeCount > 0 && <Badge count={activeCount} color="blue" />}
        </Space>
      }
      extra={
        <Button size="small" onClick={onReset} disabled={!activeCount}>
          Reset all
        </Button>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <Field label="Search (matches anywhere in the log JSON)">
          <DebouncedInput
            allowClear
            prefix={<SearchOutlined />}
            placeholder="frontend_disabled, 6aabcdf2…, /ws"
            value={filters.search}
            onChange={(search) => set({ search })}
          />
        </Field>

        <Field label="Exclude if contains (comma-separated)">
          <DebouncedInput
            allowClear
            prefix={<StopOutlined />}
            placeholder="Canceled, /ws"
            value={filters.exclude}
            onChange={(exclude) => set({ exclude })}
          />
        </Field>

        <Field label="Time range">
          <Space direction="vertical" style={{ width: '100%' }} size={6}>
            <Segmented
              block
              size="small"
              value={filters.timeField}
              onChange={(v) => set({ timeField: v })}
              options={[
                { label: 'Event time (device)', value: 'time' },
                { label: 'Received (server)', value: 'createdAt' },
              ]}
            />
            <RangePicker
              showTime={{ format: 'HH:mm' }}
              format="MM-DD HH:mm"
              allowEmpty={[true, true]}
              presets={rangePresets()}
              value={rangeValue}
              onChange={(v) => set({ range: v && (v[0] || v[1]) ? [v[0]?.valueOf() ?? null, v[1]?.valueOf() ?? null] : null })}
              style={{ width: '100%' }}
            />
          </Space>
        </Field>

        <Field label="Quick filters">
          <Flex wrap gap={6}>
            {QUICK_FILTERS.map((q) => (
              <Tag.CheckableTag
                key={q.key}
                className="quick-tag"
                checked={filters.quick.includes(q.key)}
                onChange={(checked) => toggleQuick(q.key, checked)}
              >
                {q.label}
              </Tag.CheckableTag>
            ))}
          </Flex>
        </Field>

        <Collapse size="small" defaultActiveKey={['Event', 'API', 'Error']} items={collapseItems} />
      </Space>
    </Card>
  );
}
