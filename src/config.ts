import { env } from './env';

export const allowedOrigins = [
  ...(env.NODE_ENV === 'development' ? ['http://localhost:3000'] : []),
  'https://usul.ai',
  'https://beta.usul.ai',
  'https://staging.usul.ai',
];
