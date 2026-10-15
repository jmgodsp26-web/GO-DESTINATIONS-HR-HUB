import { createContext, useContext } from 'react';
export const NavigationContext = createContext({ query: '', navigate: (_target: string) => {} });
export function useNavigation() { const context = useContext(NavigationContext); return { ...context, params: new URLSearchParams(context.query) }; }
