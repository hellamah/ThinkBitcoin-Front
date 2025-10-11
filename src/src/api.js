const defaultPort = window.location.protocol === 'https:' ? '13501' : '13500';
const hostUrl = `${window.location.protocol}//${window.location.hostname}:${defaultPort}`;
export const API_URL = import.meta.env.VITE_API_URL || hostUrl;
