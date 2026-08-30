import { useState } from 'react';
import { Pencil, Plus, Trash2, Loader2, Check, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import {
  DbLeadVersion, useCreateLeadVersion, useDeleteLeadVersion, useRenameLeadVersion,
} from '@/hooks/useLeadVersions';

interface Props {
  leadId: string;
  versions: DbLeadVersion[];
  liveVersion: number;
  selectedVersion: number;
  onSelect: (v: number) => void;
  editingArchived: boolean;
  onToggleEditArchived: (v: boolean) => void;
  extraActions?: React.ReactNode;
}

/** Shared version selector shown on Dados Gerais / Travel Planner / Custos. */
const LeadVersionBar = ({
  leadId, versions, liveVersion, selectedVersion, onSelect,
  editingArchived, onToggleEditArchived, extraActions,
}: Props) => {
  const { toast } = useToast();
  const createVersion = useCreateLeadVersion();
  const renameVersion = useRenameLeadVersion();
  const deleteVersion = useDeleteLeadVersion();
  const [renaming, setRenaming] = useState<number | null>(null);
  const [draftName, setDraftName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const list = versions.length
    ? versions
    : [{ id: 'tmp', lead_id: leadId, version: liveVersion, name: `V${liveVersion}`, general_data: {}, created_at: '' } as DbLeadVersion];
  const maxVersion = list.reduce((m, v) => Math.max(m, v.version), 0);
  const isArchived = selectedVersion !== liveVersion;
  const selected = list.find(v => v.version === selectedVersion);

  const commitRename = async (version: number) => {
    const name = draftName.trim();
    setRenaming(null);
    if (!name) return;
    try {
      await renameVersion.mutateAsync({ leadId, version, name });
      toast({ title: 'Versão renomeada', description: name });
    } catch (e: any) {
      toast({ title: 'Erro ao renomear', description: e.message, variant: 'destructive' });
    }
  };

  const handleNewVersion = async () => {
    try {
      const v = await createVersion.mutateAsync({ leadId, fromVersion: liveVersion });
      onSelect(v);
      onToggleEditArchived(false);
      toast({ title: `Versão V${v} criada`, description: 'Cópia integral da versão anterior (dados gerais, travel plan e custos).' });
    } catch (e: any) {
      toast({ title: 'Erro ao criar versão', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    try {
      const prev = await deleteVersion.mutateAsync({ leadId, version: maxVersion });
      onSelect(prev);
      onToggleEditArchived(false);
      toast({ title: `Versão V${maxVersion} apagada`, description: `A versão ${prev} voltou a ser LIVE.` });
    } catch (e: any) {
      toast({ title: 'Erro ao apagar versão', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {list.map(v => {
            const active = v.version === selectedVersion;
            const isLive = v.version === liveVersion;
            if (renaming === v.version) {
              return (
                <div key={v.version} className="flex items-center gap-1">
                  <Input
                    autoFocus
                    className="h-7 w-28 text-xs"
                    value={draftName}
                    onChange={e => setDraftName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename(v.version);
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                  />
                  <button className="p-1 text-emerald-600" onClick={() => commitRename(v.version)} title="Guardar nome">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            }
            return (
              <div key={v.version} className="flex items-center">
                <button
                  onClick={() => { onSelect(v.version); onToggleEditArchived(false); }}
                  onDoubleClick={() => { setRenaming(v.version); setDraftName(v.name); }}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-l border transition-colors inline-flex items-center gap-1.5',
                    active
                      ? 'bg-[hsl(var(--info))] text-white border-[hsl(var(--info))]'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                  title="Clicar para consultar · duplo clique para renomear"
                >
                  {v.name || `V${v.version}`}
                  {isLive && (
                    <span className={cn(
                      'text-[9px] font-bold px-1 rounded',
                      active ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700',
                    )}>LIVE</span>
                  )}
                </button>
                <button
                  onClick={() => { setRenaming(v.version); setDraftName(v.name || `V${v.version}`); }}
                  className={cn(
                    'px-1.5 py-1 border border-l-0 rounded-r transition-colors',
                    active
                      ? 'bg-[hsl(var(--info))] text-white border-[hsl(var(--info))]'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                  title="Renomear versão"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>

        <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleNewVersion} disabled={createVersion.isPending}>
          {createVersion.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Nova Versão
        </Button>
        {maxVersion > 0 && (
          <Button variant="ghost" size="sm" className="text-xs gap-1 text-destructive" onClick={() => setConfirmDelete(true)} disabled={deleteVersion.isPending}>
            <Trash2 className="h-3 w-3" /> Apagar V{maxVersion}
          </Button>
        )}
        {extraActions}
      </div>

      {isArchived && (
        <div className={cn(
          'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs',
          editingArchived ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-muted/60 border-border text-muted-foreground',
        )}>
          <span className="inline-flex items-center gap-1.5">
            {editingArchived ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {editingArchived
              ? `A editar a versão arquivada — ${selected?.name || `V${selectedVersion}`}. As alterações ficam só nesta versão.`
              : `🔒 Versão arquivada — ${selected?.name || `V${selectedVersion}`} (só consulta)`}
          </span>
          {!editingArchived && (
            <Button variant="outline" size="sm" className="h-6 text-[11px]" onClick={() => onToggleEditArchived(true)}>
              Editar esta versão
            </Button>
          )}
        </div>
      )}

      <AlertDialog open={confirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar versão V{maxVersion}?</AlertDialogTitle>
            <AlertDialogDescription>
              Vai remover os dados gerais, travel plan e custos desta versão. A versão V{maxVersion - 1} volta a ser LIVE.
              Esta ação não pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Apagar versão</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LeadVersionBar;
