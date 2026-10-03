// True in the hosted (static) build, where there is no local server: no master database (its sources are
// licensed for personal use only), no AI coach (it would expose an API key), and puzzles come from static files.
export const STATIC_HOST = import.meta.env.VITE_STATIC_HOST === '1';
