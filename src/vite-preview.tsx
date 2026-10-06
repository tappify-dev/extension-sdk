import { createRoot } from 'react-dom/client';
import { LocalPreview, type LocalPreviewOptions } from './vite/preview/client';

export {
  componentFromModule,
  loadContribution,
  LocalPreview,
} from './vite/preview/client';
export type {
  LocalPreviewOptions,
  LocalPreviewProps,
  PreviewLoadRequest,
  PreviewModuleLoader,
} from './vite/preview/client';

export function mountLocalPreview({
  manifest,
  remote,
  mount,
}: LocalPreviewOptions): () => void {
  const root = createRoot(mount);
  root.render(<LocalPreview manifest={manifest} remote={remote} />);
  return () => root.unmount();
}
