export const MAP_STYLES = {
  liberty: {
    name: 'Calles Clásico',
    url: 'https://tiles.openfreemap.org/styles/liberty',
  },
  bright: {
    name: 'Claro Brillante',
    url: 'https://tiles.openfreemap.org/styles/bright',
  },
  dark: {
    name: 'Modo Oscuro',
    url: 'https://tiles.openfreemap.org/styles/dark',
  },
  positron: {
    name: 'Carto Positron',
    url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  },
} as const;

export type MapStyleKey = keyof typeof MAP_STYLES;
