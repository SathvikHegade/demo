declare module 'react' {
  export function useState<T>(initialState: T | (() => T)): [T, (state: T | ((prevState: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useRef<T>(initialValue: T | null): { current: T | null };
  export const useMemo: any;
  export const useCallback: any;
  export const useContext: any;
  export const useReducer: any;
  const React: any;
  export default React;
}

declare module 'zustand' {
  export function create<T>(initializer: (set: any, get: any, api: any) => T): any;
}

declare module 'react-router-dom' {
  export const useNavigate: any;
  export const useParams: any;
  export const useLocation: any;
  export const BrowserRouter: any;
  export const Routes: any;
  export const Route: any;
  export const Link: any;
}

declare module 'framer-motion' {
  export const motion: any;
  export const AnimatePresence: any;
}

declare module 'recharts' {
  export const ResponsiveContainer: any;
  export const RadarChart: any;
  export const PolarGrid: any;
  export const PolarAngleAxis: any;
  export const PolarRadiusAxis: any;
  export const Radar: any;
  export const PieChart: any;
  export const Pie: any;
  export const Cell: any;
  export const Tooltip: any;
  export const Legend: any;
  export const BarChart: any;
  export const Bar: any;
  export const XAxis: any;
  export const YAxis: any;
  export const CartesianGrid: any;
  export const Treemap: any;
}

declare module 'd3' {
  const d3: any;
  export default d3;
  export const select: any;
  export const forceSimulation: any;
  export const forceLink: any;
  export const forceManyBody: any;
  export const forceCenter: any;
  export const drag: any;
  export const zoom: any;
  export const scaleLinear: any;
  export const scaleBand: any;
  export const scaleOrdinal: any;
  export const schemeCategory10: any;
  export const axisBottom: any;
  export const axisLeft: any;
  export const line: any;
  export const pie: any;
  export const arc: any;
  export const q1: any;
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
