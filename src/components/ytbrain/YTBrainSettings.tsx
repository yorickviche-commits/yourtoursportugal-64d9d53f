import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Loader2, RefreshCw, Tags, ListTree, Activity } from 'lucide-react';
import { BRAIN_LABEL, CATEGORY_COLORS, categoryColorClass } from '@/lib/ytBrain';
import {
  useYtbCategories, useCategoryMutations, useYtbClassifications,
  useClassificationMutations, useYtbActivity, type YtbCategory,
} from '@/hooks/useYtBrain';

const YTBrainSettings = () => {
  const { toast } = useToast();
  const { data: categories = [] } = useYtbCategories();
  const { upsert, remove } = useCategoryMutations();
  const { data: classifications = [] } = useYtbClassifications();
  const classMut = useClassificationMutations();
  const [page, setPage] = useState(0);
  const { data: activity = [], isLoading: activityLoading } = useYtbActivity(page);

  const [editCat, setEditCat] = useState<Partial<YtbCategory> | null>(null);
  const [deleteCat, setDeleteCat] = useState<YtbCategory | null>(null);
  const [newValue, setNewValue] = useState<Record<string, string>>({});
  const [reindexing, setReindexing] = useState(false);

  const reindex = async () => {
    setReindexing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ytb-ingest', { body: { all: true } });
      if (error) throw error;
      toast({ title: 'Reindexação concluída', description: `${data?.indexed ?? 0} documentos processados.` });
    } catch (e: any) {
      toast({ title: 'Erro na reindexação', description: e.message, variant: 'destructive' });
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{BRAIN_LABEL} — Configuração</CardTitle>
          <Button size="sm" variant="outline" onClick={reindex} disabled={reindexing}>
            {reindexing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Reindexar tudo
          </Button>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-muted-foreground">
            Os acessos ao {BRAIN_LABEL} gerem-se na gestão de utilizadores e permissões existente
            (administrador = tudo, equipa interna = cria/edita, leitor = só consulta).
          </p>

          <Tabs defaultValue="categories">
            <TabsList>
              <TabsTrigger value="categories" className="gap-1.5"><Tags className="h-3.5 w-3.5" />Categorias</TabsTrigger>
              <TabsTrigger value="classifications" className="gap-1.5"><ListTree className="h-3.5 w-3.5" />Classificações</TabsTrigger>
              <TabsTrigger value="activity" className="gap-1.5"><Activity className="h-3.5 w-3.5" />Atividade</TabsTrigger>
            </TabsList>

            <TabsContent value="categories" className="mt-4 space-y-2">
              <Button size="sm" onClick={() => setEditCat({ color: 'blue' })}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />Nova categoria
              </Button>
              <div className="divide-y rounded-md border">
                {categories.map(c => (
                  <div key={c.id} className="flex items-center gap-2 p-2 text-sm">
                    <Badge variant="outline" className={categoryColorClass(c.color)}>{c.name}</Badge>
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{c.description}</span>
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditCat(c)}>Editar</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => setDeleteCat(c)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="classifications" className="mt-4 space-y-4">
              {classifications.map((cl: any) => (
                <div key={cl.id} className="rounded-md border p-3">
                  <p className="mb-2 text-sm font-medium">{cl.name}</p>
                  <div className="space-y-1">
                    {cl.values.map((v: any) => (
                      <div key={v.id} className="flex items-center gap-2">
                        <Input defaultValue={v.value} className="h-8 text-sm"
                          onBlur={e => e.target.value !== v.value &&
                            classMut.renameValue.mutate({ id: v.id, value: e.target.value })} />
                        <Button size="sm" variant="ghost" className="h-8 text-destructive"
                          onClick={() => classMut.removeValue.mutate(v.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Input placeholder="Novo valor" className="h-8 text-sm"
                      value={newValue[cl.id] ?? ''}
                      onChange={e => setNewValue(p => ({ ...p, [cl.id]: e.target.value }))} />
                    <Button size="sm" className="h-8" onClick={() => {
                      const v = (newValue[cl.id] ?? '').trim();
                      if (!v) return;
                      classMut.addValue.mutate({ classification_id: cl.id, value: v, sort_order: cl.values.length + 1 });
                      setNewValue(p => ({ ...p, [cl.id]: '' }));
                    }}>Adicionar</Button>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="activity" className="mt-4 space-y-2">
              {activityLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <div className="divide-y rounded-md border text-xs">
                  {activity.length === 0 && <p className="p-3 text-muted-foreground">Sem atividade registada.</p>}
                  {activity.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-2 p-2">
                      <Badge variant="outline" className="text-[10px]">{a.action}</Badge>
                      <span className="text-muted-foreground">{a.entity_type}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {a.details?.title || a.details?.name || a.entity_id}
                      </span>
                      <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString('pt-PT')}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                <Button size="sm" variant="outline" disabled={activity.length < 25} onClick={() => setPage(p => p + 1)}>Seguinte</Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!editCat} onOpenChange={() => setEditCat(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editCat?.id ? 'Editar categoria' : 'Nova categoria'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input value={editCat?.name ?? ''} onChange={e => setEditCat(p => ({ ...p!, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cor</Label>
              <Select value={editCat?.color ?? 'blue'} onValueChange={v => setEditCat(p => ({ ...p!, color: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_COLORS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Input value={editCat?.description ?? ''}
                onChange={e => setEditCat(p => ({ ...p!, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCat(null)}>Cancelar</Button>
            <Button onClick={async () => {
              if (!editCat?.name?.trim()) return;
              await upsert.mutateAsync(editCat);
              setEditCat(null); toast({ title: 'Categoria guardada' });
            }}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteCat} onOpenChange={() => setDeleteCat(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Eliminar categoria?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            “{deleteCat?.name}” será removida e desassociada dos documentos. Os documentos mantêm-se.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCat(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => {
              if (deleteCat) await remove.mutateAsync(deleteCat.id);
              setDeleteCat(null); toast({ title: 'Categoria eliminada' });
            }}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default YTBrainSettings;
