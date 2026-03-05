export type {
  TapAuthenticatedRequest,
  TapLambdaEvent,
  TapLambdaHandler,
  TapLambdaResponse,
} from './middleware/types';
export { withTapAuth } from './middleware/withTapAuth';

export {
  TapApiError,
  badRequest,
  forbidden,
  internalError,
  notFound,
} from './helpers/errors';

export { createLogger } from './helpers/logger';
export { errorResponse, jsonResponse } from './helpers/response';

export {
  TapServiceClient,
  type TapInstallation,
  type TapServiceClientConfig,
} from './TapServiceClient';
