import { useMemo } from 'react';
import { Card, Col, Row, Statistic, Tooltip } from 'antd';

export default function StatsBar({ logs, loadedCount, total, onQuickFilter }) {
  const stats = useMemo(() => {
    const users = new Set();
    const devices = new Set();
    let errors = 0;
    let http4xx = 0;
    let http5xx = 0;
    let noResponse = 0;
    let crashes = 0;
    for (const l of logs) {
      if (l.userId) users.add(l.userId);
      if (l.deviceId) devices.add(l.deviceId);
      if (l.isError) errors += 1;
      if (l.apiStatus !== null && l.apiStatus >= 400 && l.apiStatus < 500) http4xx += 1;
      if (l.apiStatus !== null && l.apiStatus >= 500) http5xx += 1;
      if (l.statusGroup === 'no response') noResponse += 1;
      if (l.category === 'crash') crashes += 1;
    }
    return { users: users.size, devices: devices.size, errors, http4xx, http5xx, noResponse, crashes };
  }, [logs]);

  const items = [
    { title: 'On server', value: total ?? '—' },
    { title: 'Loaded', value: loadedCount },
    { title: 'Matching', value: logs.length, color: '#1677ff' },
    { title: 'With error', value: stats.errors, color: stats.errors ? '#cf1322' : undefined, quick: 'hasError' },
    { title: 'HTTP 4xx', value: stats.http4xx, color: stats.http4xx ? '#d4380d' : undefined },
    { title: 'HTTP 5xx', value: stats.http5xx, color: stats.http5xx ? '#cf1322' : undefined, quick: 'http5xx' },
    { title: 'No response', value: stats.noResponse, color: stats.noResponse ? '#c41d7f' : undefined, quick: 'noResponse' },
    { title: 'Crashes', value: stats.crashes, color: stats.crashes ? '#cf1322' : undefined, quick: 'crash' },
    { title: 'Users', value: stats.users },
    { title: 'Devices', value: stats.devices },
  ];

  return (
    <Row gutter={[8, 8]}>
      {items.map((item) => {
        const card = (
          <Card
            size="small"
            hoverable={Boolean(item.quick)}
            onClick={item.quick ? () => onQuickFilter(item.quick) : undefined}
            styles={{ body: { padding: '8px 12px' } }}
          >
            <Statistic title={item.title} value={item.value} valueStyle={{ fontSize: 20, color: item.color }} />
          </Card>
        );
        return (
          <Col key={item.title} xs={12} sm={8} md={6} lg={4} xxl={2} flex="auto">
            {item.quick ? <Tooltip title="Click to toggle this quick filter">{card}</Tooltip> : card}
          </Col>
        );
      })}
    </Row>
  );
}
