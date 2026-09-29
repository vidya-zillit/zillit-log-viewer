import { Typography } from 'antd';
import { tryParseJson } from '../utils/logUtils';

const { Paragraph } = Typography;

/** Pretty JSON (or plain text) in a scrollable, copyable block. */
export default function JsonBlock({ value, maxHeight = 360 }) {
  const parsed = tryParseJson(value);
  const text = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
  return (
    <div className="json-wrap">
      <Paragraph copyable={{ text }} className="json-copy" />
      <pre className="json-block" style={{ maxHeight }}>
        {text}
      </pre>
    </div>
  );
}
