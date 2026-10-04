/** Injected by Vite from the shipped asset paths and contents, without Git metadata. */
declare const __ASSET_VERSION__: string;

/** Keep logical asset names while separating changed art from browser/CDN caches. */
export function assetUrl(path: string, revision: string = __ASSET_VERSION__): string {
  const fragmentAt = path.indexOf('#');
  const fragment = fragmentAt < 0 ? '' : path.slice(fragmentAt);
  const base = fragmentAt < 0 ? path : path.slice(0, fragmentAt);
  const version = encodeURIComponent(revision);
  if (/[?&]v=/.test(base)) return base.replace(/([?&])v=[^&]*/, `$1v=${version}`) + fragment;
  const separator = !base.includes('?') ? '?' : /[?&]$/.test(base) ? '' : '&';
  return `${base}${separator}v=${version}${fragment}`;
}
