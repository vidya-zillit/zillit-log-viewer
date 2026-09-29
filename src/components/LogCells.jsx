import { Tag, Tooltip, Typography } from 'antd';
import { CATEGORY_COLORS, PLATFORM_COLORS, statusColor } from '../utils/logUtils';

const { Text } = Typography;

/** Tag that adds a filter when clicked (without opening the row). */
export function FilterTag({ facetKey, value, color, children, onAddFilter }) {
  if (!value && value !== 0) return <Text type="secondary">—</Text>;
  return (
    <Tooltip title="Click to filter · Alt+click to exclude" mouseEnterDelay={0.6}>
      <Tag
        color={color}
        className="click-tag"
        onClick={(e) => {
          e.stopPropagation();
          onAddFilter(facetKey, String(value), e.altKey);
        }}
      >
        {children ?? value}
      </Tag>
    </Tooltip>
  );
}

export const PlatformTag = ({ log, onAddFilter }) => (
  <FilterTag facetKey="platform" value={log.platform} color={PLATFORM_COLORS[log.platform]} onAddFilter={onAddFilter} />
);

export const CategoryTag = ({ log, onAddFilter }) => (
  <FilterTag facetKey="category" value={log.category} color={CATEGORY_COLORS[log.category]} onAddFilter={onAddFilter} />
);

export function StatusTag({ log, onAddFilter }) {
  if (log.apiStatus !== null) {
    return (
      <FilterTag facetKey="apiStatus" value={log.apiStatus} color={statusColor(log.apiStatus)} onAddFilter={onAddFilter} />
    );
  }
  if (log.statusGroup === 'canceled') {
    return (
      <FilterTag facetKey="statusGroup" value="canceled" onAddFilter={onAddFilter}>
        CANCELED
      </FilterTag>
    );
  }
  if (log.statusGroup === 'no response') {
    return (
      <FilterTag facetKey="statusGroup" value="no response" color="magenta" onAddFilter={onAddFilter}>
        NO RESP
      </FilterTag>
    );
  }
  return <Text type="secondary">—</Text>;
}
