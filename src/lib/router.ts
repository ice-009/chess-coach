import { useEffect, useState } from 'react';

function current() {
  return window.location.hash.replace(/^#\/?/, '');
}

/** Hash-based routing: "#/openings/italian?mode=drill" → { parts: ['openings','italian'], query } */
export function useRoute() {
  const [hash, setHash] = useState(current);
  useEffect(() => {
    const onChange = () => {
      setHash(current());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const [path, qs = ''] = hash.split('?');
  return {
    parts: path.split('/').filter(Boolean).map(decodeURIComponent),
    query: new URLSearchParams(qs),
  };
}

export function navigate(path: string) {
  window.location.hash = '#/' + path.replace(/^\//, '');
}
