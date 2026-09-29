import LogViewerApp from '../components/LogViewerApp';
import { getEnvironments } from '../config/environments';

export const dynamic = 'force-dynamic';

export default function Home() {
  return <LogViewerApp environments={getEnvironments()} />;
}
