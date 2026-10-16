import { createContext, useContext } from 'react';
export const AcademicDataContext = createContext(null);
export function useAcademicData() {
  const context = useContext(AcademicDataContext);
  if (!context) throw new Error('AcademicDataProvider is required.');
  return context;
}
