import { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { YtbFolder, useFolderMutations } from '@/hooks/useYtBrain';

interface Props {
  folders: YtbFolder[];
  value: string | null;
  onChange: (id: string | null) => void;
  allowCreate?: boolean;
  rootLabel?: string;
  className?: string;
}

/** Compact navigable folder tree used by the "Adicionar" and "Mover para..." dialogs. */
const FolderTreeSelect = ({ folders, value, onChange, allowCreate, rootLabel = 'Raiz', className }: Props) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [creatingIn, setCreatingIn] = useState<string | null | undefined>(undefined);
  const [newName, setNewName] = useState('');
  const { create } = useFolderMutations();

  const children = (parent: string | null) => folders.filter(f => f.parent_folder_id === parent);

  const submitNew = async (parent: string | null) => {
    if (!newName.trim()) return;
    const created = await create.mutateAsync({ name: newName.trim(), parent_folder_id: parent });
    setNewName('');
    setCreatingIn(undefined);
    onChange(created.id);
  };

  const renderNode = (folder: YtbFolder, depth: number) => {
    const kids = children(folder.id);
    const open = expanded[folder.id];
    return (
      <div key={folder.id}>
        <div
          className={cn(
            'flex items-center gap-1 rounded px-1.5 py-1 text-sm cursor-pointer hover:bg-muted',
            value === folder.id && 'bg-primary/10 text-primary font-medium',
          )}
          style={{ paddingLeft: depth * 12 + 4 }}
          onClick={() => onChange(folder.id)}
        >
          <button
            type="button"
            className="shrink-0 text-muted-foreground"
            onClick={e => { e.stopPropagation(); setExpanded(p => ({ ...p, [folder.id]: !open })); }}
          >
            {kids.length ? (open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <span className="inline-block w-3.5" />}
          </button>
          <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{folder.name}</span>
          {allowCreate && (
            <button
              type="button"
              title="Criar subpasta aqui"
              className="ml-auto text-muted-foreground hover:text-primary"
              onClick={e => { e.stopPropagation(); setCreatingIn(folder.id); }}
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {creatingIn === folder.id && (
          <div className="flex gap-1 py-1" style={{ paddingLeft: depth * 12 + 24 }}>
            <Input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Nome da pasta" className="h-7 text-xs" />
            <Button size="sm" className="h-7 px-2 text-xs" onClick={() => submitNew(folder.id)}>Criar</Button>
          </div>
        )}
        {open && kids.map(k => renderNode(k, depth + 1))}
      </div>
    );
  };

  return (
    <div className={cn('max-h-64 overflow-auto rounded-md border p-1', className)}>
      <div
        className={cn('flex items-center gap-1 rounded px-1.5 py-1 text-sm cursor-pointer hover:bg-muted',
          value === null && 'bg-primary/10 text-primary font-medium')}
        onClick={() => onChange(null)}
      >
        <Folder className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{rootLabel}</span>
        {allowCreate && (
          <button type="button" title="Criar pasta na raiz" className="ml-auto text-muted-foreground hover:text-primary"
            onClick={e => { e.stopPropagation(); setCreatingIn(null); }}>
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {creatingIn === null && (
        <div className="flex gap-1 py-1 pl-6">
          <Input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Nome da pasta" className="h-7 text-xs" />
          <Button size="sm" className="h-7 px-2 text-xs" onClick={() => submitNew(null)}>Criar</Button>
        </div>
      )}
      {children(null).map(f => renderNode(f, 0))}
    </div>
  );
};

export default FolderTreeSelect;
