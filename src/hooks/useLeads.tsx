import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Lead } from '@/types/leads';
import { mockLeads as initialLeads } from '@/data/mockLeads';

interface LeadsContextType {
  leads: Lead[];
  addLead: (lead: Lead) => void;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  removeLead: (id: string) => void;
  generateId: () => string;
}

const LeadsContext = createContext<LeadsContextType | null>(null);

export const LeadsProvider = ({ children }: { children: ReactNode }) => {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);

  const generateId = useCallback(() => {
    const maxNum = leads.reduce((max, l) => {
      const match = l.id.match(/YT(\d+)/);
      return match ? Math.max(max, parseInt(match[1])) : max;
    }, 0);
    return `YT${maxNum + 1}`;
  }, [leads]);

  const addLead = useCallback((lead: Lead) => {
    setLeads(prev => [lead, ...prev]);
  }, []);

  const updateLead = useCallback((id: string, updates: Partial<Lead>) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  }, []);

  const removeLead = useCallback((id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
  }, []);

  return (
    <LeadsContext.Provider value={{ leads, addLead, updateLead, removeLead, generateId }}>
      {children}
    </LeadsContext.Provider>
  );
};

export const useLeads = () => {
  const ctx = useContext(LeadsContext);
  if (!ctx) throw new Error('useLeads must be used within LeadsProvider');
  return ctx;
};
