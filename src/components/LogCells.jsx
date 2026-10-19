import { Tag, Typography } from 'antd';
import { CATEGORY_COLORS, PLATFORM_COLORS, statusColor } from '../utils/logUtils';

const { Text } = Typography;

export const Dash = () => <Text type="secondary">—</Text>;

/**
 * Single-line text clipped with an ellipsis and a native tooltip. Table cells use this
 * instead of antd Tooltip / Typography ellipsis, which mount a trigger and a
 * ResizeObserver per cell and make large pages hang.
 */
export function Clip({ title, className, style, children }) {
  return (
    <div className={className ? `clip ${className}` : 'clip'} title={title} style={style}>
      {children}
    </div>
  );
}

/** Tag that adds a filter when clicked (without opening the row). */
export function FilterTag({ facetKey, value, color, children, onAddFilter }) {
  if (!value && value !== 0) return <Dash />;
  return (
    <Tag
      color={color}
      className="click-tag"
      title="Click to filter · Alt+click to exclude"
      onClick={(e) => {
        e.stopPropagation();
        onAddFilter(facetKey, String(value), e.altKey);
      }}
    >
      {children ?? value}
    </Tag>
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
  return <Dash />;
}
