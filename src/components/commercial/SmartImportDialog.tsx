import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Upload, FileText, Loader2, ClipboardPaste } from 'lucide-react';

interface SmartImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'supplier' | 'partner';
  onImportComplete: (data: any) => void;
}

const SmartImportDialog = ({ open, onOpenChange, entityType, onImportComplete }: SmartImportDialogProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<string>('paste');
  const [text, setText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [pdfExtracting, setPdfExtracting] = useState(false);

  const handleExtractFromText = async () => {
    if (text.trim().length < 10) return;
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-supplier-data', {
        body: { text, entity_type: entityType },
      });
      if (error || !data?.success) {
        toast({ title: 'Erro na extração', description: data?.error || error?.message, variant: 'destructive' });
        setExtracting(false);
        return;
      }
      toast({
        title: 'Dados extraídos com sucesso',
        description: `${data.data?.services?.length || 0} serviço(s) encontrado(s)`,
      });
      onImportComplete(data.data);
      onOpenChange(false);
      setText('');
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setExtracting(false);
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Read PDF as text using FileReader
    setPdfExtracting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // For PDF files, we extract raw text content
      // Simple text extraction from PDF binary
      let extractedText = '';

      // Convert binary to string and extract readable text
      const binaryStr = Array.from(uint8Array).map(b => String.fromCharCode(b)).join('');

      // Extract text between BT and ET markers (PDF text objects)
      const textMatches = binaryStr.match(/\(([^)]+)\)/g);
      if (textMatches) {
        extractedText = textMatches
          .map(m => m.slice(1, -1))
          .filter(t => t.length > 1 && /[a-zA-ZÀ-ÿ0-9]/.test(t))
          .join(' ');
      }

      // If we couldn't extract much text, try reading as plain text
      if (extractedText.length < 50) {
        const textDecoder = new TextDecoder('utf-8', { fatal: false });
        const rawText = textDecoder.decode(uint8Array);
        // Filter to readable characters
        extractedText = rawText.replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, ' ')
          .replace(/\s{3,}/g, ' ')
          .trim();
      }

      if (extractedText.length < 20) {
        toast({
          title: 'PDF não legível',
          description: 'Não foi possível extrair texto deste PDF. Tente copiar e colar o conteúdo manualmente.',
          variant: 'destructive',
        });
        setPdfExtracting(false);
        return;
      }

      // Send extracted text to AI
      const { data, error } = await supabase.functions.invoke('extract-supplier-data', {
        body: { text: extractedText.slice(0, 15000), entity_type: entityType },
      });

      if (error || !data?.success) {
        toast({ title: 'Erro na extração', description: data?.error || error?.message, variant: 'destructive' });
        setPdfExtracting(false);
        return;
      }

      toast({
        title: 'PDF processado com sucesso',
        description: `${data.data?.services?.length || 0} serviço(s) extraído(s)`,
      });
      onImportComplete(data.data);
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Erro no processamento do PDF', description: err.message, variant: 'destructive' });
    }
    setPdfExtracting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const label = entityType === 'partner' ? 'parceiro' : 'fornecedor';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Smart Import — {entityType === 'partner' ? 'Parceiro' : 'Fornecedor'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="paste" className="flex-1 gap-1.5">
              <ClipboardPaste className="h-3.5 w-3.5" />Copy-Paste
            </TabsTrigger>
            <TabsTrigger value="pdf" className="flex-1 gap-1.5">
              <FileText className="h-3.5 w-3.5" />Import PDF
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="space-y-3 mt-3">
            <p className="text-xs text-muted-foreground">
              Cole o conteúdo de um email, protocolo, contrato ou proposta. A IA vai extrair automaticamente
              os dados do {label} e todos os serviços protocolados com preços, condições e políticas.
            </p>
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={14}
              placeholder={`Cole aqui o texto do email, protocolo ou contrato do ${label}...`}
              className="text-sm font-mono"
            />
            <Button
              onClick={handleExtractFromText}
              disabled={extracting || text.trim().length < 10}
              className="w-full"
            >
              {extracting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />A extrair dados...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" />Extrair Dados com IA</>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="pdf" className="space-y-3 mt-3">
            <p className="text-xs text-muted-foreground">
              Faça upload de um PDF de protocolo, contrato ou tabela de preços.
              A IA vai processar o documento e extrair automaticamente toda a informação do {label} e serviços.
            </p>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center space-y-3">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">Arraste um PDF ou clique para selecionar</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.doc,.docx"
                className="hidden"
                onChange={handlePdfUpload}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={pdfExtracting}
              >
                {pdfExtracting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />A processar PDF...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" />Selecionar Ficheiro</>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default SmartImportDialog;
