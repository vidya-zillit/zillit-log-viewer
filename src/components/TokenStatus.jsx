import { useEffect, useMemo, useState } from 'react';
import { Space, Tag, Tooltip, Typography } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { decodeJwt } from '../utils/jwt';
import { formatDuration, formatTime } from '../utils/logUtils';

const { Text } = Typography;

/** Decodes the JWT locally and shows a live expiry countdown (these tokens live ~5 min). */
export default function TokenStatus({ token }) {
  const payload = useMemo(() => (token ? decodeJwt(token) : null), [token]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!payload?.exp) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [payload]);

  if (!token) return <Text type="secondary">No token</Text>;
  if (!payload) return <Tag color="default">Not a JWT — sent as-is</Tag>;

  const expMs = payload.exp ? payload.exp * 1000 : null;
  const left = expMs ? expMs - now : null;
  let color = 'green';
  if (left !== null && left <= 0) color = 'red';
  else if (left !== null && left < 60_000) color = 'orange';

  return (
    <Space size={4} wrap>
      <Tooltip title={<pre className="tooltip-pre">{JSON.stringify(payload, null, 2)}</pre>}>
        <Tag icon={<ClockCircleOutlined />} color={color}>
          {left === null ? 'No expiry' : left <= 0 ? `Expired ${formatDuration(-left)} ago` : `Expires in ${formatDuration(left)}`}
        </Tag>
      </Tooltip>
      {expMs && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          exp {formatTime(expMs, 'HH:mm:ss')}
        </Text>
      )}
      {payload.typ && <Tag>{payload.typ}</Tag>}
      {payload.uid && (
        <Text type="secondary" style={{ fontSize: 12 }} copyable={{ text: payload.uid }}>
          uid {payload.uid}
        </Text>
      )}
      {payload.pid && (
        <Text type="secondary" style={{ fontSize: 12 }} copyable={{ text: payload.pid }}>
          pid {payload.pid}
        </Text>
      )}
    </Space>
  );
}
