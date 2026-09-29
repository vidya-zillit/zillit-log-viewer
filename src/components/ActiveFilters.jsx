import { Button, Flex, Tag } from 'antd';
import { facetLabel, formatTime, QUICK_FILTERS } from '../utils/logUtils';

/** Removable chips summarising every active filter. */
export default function ActiveFilters({ filters, onChange, onReset }) {
  const chips = [];

  if (filters.search.trim()) {
    chips.push({ key: 'search', text: `contains “${filters.search.trim()}”`, remove: (f) => ({ ...f, search: '' }) });
  }
  if (filters.exclude.trim()) {
    chips.push({ key: 'exclude', text: `excludes “${filters.exclude.trim()}”`, color: 'orange', remove: (f) => ({ ...f, exclude: '' }) });
  }
  if (filters.range) {
    const [from, to] = filters.range;
    const field = filters.timeField === 'createdAt' ? 'received' : 'event';
    chips.push({
      key: 'range',
      text: `${field} ${from ? formatTime(from, 'MM-DD HH:mm') : '…'} → ${to ? formatTime(to, 'MM-DD HH:mm') : '…'}`,
      remove: (f) => ({ ...f, range: null }),
    });
  }
  for (const key of filters.quick) {
    const q = QUICK_FILTERS.find((x) => x.key === key);
    chips.push({ key: `q-${key}`, text: q?.label ?? key, color: 'purple', remove: (f) => ({ ...f, quick: f.quick.filter((k) => k !== key) }) });
  }
  for (const [key, state] of Object.entries(filters.facets)) {
    for (const value of state?.values ?? []) {
      chips.push({
        key: `f-${key}-${value}`,
        text: `${facetLabel(key)} ${state.negate ? '≠' : '='} ${value}`,
        color: state.negate ? 'red' : 'blue',
        remove: (f) => ({
          ...f,
          facets: { ...f.facets, [key]: { ...f.facets[key], values: f.facets[key].values.filter((v) => v !== value) } },
        }),
      });
    }
  }

  if (!chips.length) return null;

  return (
    <Flex wrap gap={6} align="center" style={{ marginBottom: 8 }}>
      {chips.map((c) => (
        <Tag
          key={c.key}
          color={c.color}
          closable
          onClose={(e) => {
            e.preventDefault();
            onChange(c.remove);
          }}
          className="chip"
        >
          {c.text}
        </Tag>
      ))}
      <Button size="small" type="link" onClick={onReset}>
        Clear all
      </Button>
    </Flex>
  );
}
