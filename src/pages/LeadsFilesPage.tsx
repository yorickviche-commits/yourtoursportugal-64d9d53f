import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { mockLeads, mockFiles } from '@/data/mockLeads';
import { cn } from '@/lib/utils';
import { Sparkles, Search, Filter, FileText, Image, Table2, File, ExternalLink, User, Calendar, MapPin, Tag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/StatusBadge';
import AISimulationForm from '@/components/leads/AISimulationForm';

type Tab = 'leads' | 'files' | 'all';
type LeadFilter = 'all' | 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'negotiation';

const LEAD_FILTERS: { value: LeadFilter; label: string }[] = [
  { value: 'all', label: 'All Leads' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'negotiation', label: 'Negotiation' },
];

const fileIcon = (type: string) => {
  switch (type) {
    case 'pdf': return <FileText className="h-4 w-4 text-[hsl(var(--destructive))]" />;
    case 'doc': return <FileText className="h-4 w-4 text-[hsl(var(--info))]" />;
    case 'image': return <Image className="h-4 w-4 text-[hsl(var(--success))]" />;
    case 'spreadsheet': return <Table2 className="h-4 w-4 text-[hsl(var(--success))]" />;
    default: return <File className="h-4 w-4 text-muted-foreground" />;
  }
};

const leadStatusColor = (status: string) => {
  switch (status) {
    case 'new': return 'bg-[hsl(var(--info-muted))] text-[hsl(var(--info))]';
    case 'contacted': return 'bg-[hsl(var(--warning-muted))] text-[hsl(var(--warning-foreground))]';
    case 'qualified': return 'bg-[hsl(var(--success-muted))] text-[hsl(var(--success))]';
    case 'proposal_sent': return 'bg-[hsl(var(--urgent-muted))] text-[hsl(var(--urgent))]';
    case 'negotiation': return 'bg-purple-100 text-purple-700';
    default: return 'bg-muted text-muted-foreground';
  }
};

const LeadsFilesPage = () => {
  const [activeTab, setActiveTab] = useState<Tab>('leads');
  const [leadFilter, setLeadFilter] = useState<LeadFilter>('all');
  const [search, setSearch] = useState('');
  const [simulationOpen, setSimulationOpen] = useState(false);

  const filteredLeads = mockLeads.filter(l => {
    if (leadFilter !== 'all' && l.status !== leadFilter) return false;
    if (search && !l.clientName.toLowerCase().includes(search.toLowerCase()) &&
        !l.destination.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredFiles = mockFiles.filter(f => {
    if (search && !f.name.toLowerCase().includes(search.toLowerCase()) &&
        !f.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Leads & Files</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Open leads, proposals and file management</p>
          </div>
          <Button onClick={() => setSimulationOpen(true)}
            className="bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--urgent)/0.8)] hover:opacity-90 text-white gap-2">
            <Sparkles className="h-4 w-4" />
            New AI Simulation
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          {([
            { key: 'leads' as Tab, label: 'Leads', count: mockLeads.length },
            { key: 'files' as Tab, label: 'Files', count: mockFiles.length },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                activeTab === tab.key
                  ? "border-[hsl(var(--info))] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}>
              {tab.label}
              <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Search + Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm" />
          </div>
          {activeTab === 'leads' && (
            <div className="flex gap-1">
              {LEAD_FILTERS.map(f => (
                <button key={f.value} onClick={() => setLeadFilter(f.value)}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded-md font-medium transition-colors",
                    leadFilter === f.value
                      ? "bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))]"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  )}>
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Leads Tab */}
        {activeTab === 'leads' && (
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Client</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Destination</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Dates</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Pax</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Budget</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Owner</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Source</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Last Contact</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map(lead => (
                  <tr key={lead.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-[hsl(var(--info-muted))] flex items-center justify-center">
                          <User className="h-3.5 w-3.5 text-[hsl(var(--info))]" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-xs">{lead.clientName}</p>
                          <p className="text-[10px] text-muted-foreground">{lead.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-xs text-foreground">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {lead.destination}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{lead.travelDates}</td>
                    <td className="px-4 py-3 text-xs text-center text-foreground">{lead.pax}</td>
                    <td className="px-4 py-3 text-xs font-medium text-foreground">{lead.budgetLevel}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase", leadStatusColor(lead.status))}>
                        {lead.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{lead.salesOwner}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {lead.source.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {lead.lastContact ? new Date(lead.lastContact).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
                {filteredLeads.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">No leads found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Files Tab */}
        {activeTab === 'files' && (
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">File</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Tags</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Uploaded By</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Size</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Drive</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map(file => (
                  <tr key={file.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {fileIcon(file.type)}
                        <span className="text-xs font-medium text-foreground">{file.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {file.tags.map(tag => (
                          <span key={tag} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Tag className="h-2.5 w-2.5" />{tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{file.uploadedBy}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(file.uploadedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{file.size}</td>
                    <td className="px-4 py-3 text-center">
                      {file.driveUrl && (
                        <a href={file.driveUrl} className="inline-flex items-center text-[hsl(var(--info))] hover:underline">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredFiles.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No files found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AISimulationForm open={simulationOpen} onOpenChange={setSimulationOpen} />
    </AppLayout>
  );
};

export default LeadsFilesPage;
