import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiService } from '@/utils/api';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Plus, Trash2 } from 'lucide-react';

type DraftItem = {
  type: 'medicine' | 'medical_device';
  id: string;
  name: string;
  quantity: number;
};

type RequisitionItem = {
  type: string;
  id: string;
  name: string;
  quantity: number;
};

type Requisition = {
  id: string;
  branch_id: string;
  employee_id?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  comment?: string | null;
  processed_by?: string | null;
  processed_at?: string | null;
  created_at: string;
  items: RequisitionItem[];
};

const STATUS_LABELS: Record<Requisition['status'], string> = {
  pending: 'В ожидании',
  approved: 'Принята',
  rejected: 'Отклонена',
};

const STATUS_VARIANTS: Record<Requisition['status'], 'secondary' | 'default' | 'destructive'> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
};

const BranchRequisitions: React.FC = () => {
  const [itemType, setItemType] = useState<'medicine' | 'medical_device'>('medicine');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [comment, setComment] = useState('');
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);

  const [medicines, setMedicines] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);

  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  const [filters, setFilters] = useState({
    status: 'ALL',
    dateFrom: '',
    dateTo: '',
  });

  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [selectedRequisition, setSelectedRequisition] = useState<Requisition | null>(null);

  const availableItems = useMemo(
    () => (itemType === 'medicine' ? medicines : devices),
    [devices, itemType, medicines],
  );

  const loadCatalogs = useCallback(async () => {
    try {
      const medsRes = await apiService.getMedicines();
      const meds = Array.isArray(medsRes?.data?.data)
        ? medsRes.data.data
        : Array.isArray(medsRes?.data)
          ? medsRes.data
          : [];
      setMedicines(meds || []);

      const devRes = await apiService.getMedicalDevices?.();
      const devs = Array.isArray(devRes?.data?.data)
        ? devRes.data.data
        : Array.isArray(devRes?.data)
          ? devRes.data
          : [];
      setDevices(devs || []);
    } catch (error) {
      console.error('Failed to load catalog items', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить список товаров',
        variant: 'destructive',
      });
    }
  }, []);

  const loadRequisitions = useCallback(async () => {
    setLoadingList(true);
    try {
      const params: Record<string, string> = {};
      if (filters.status !== 'ALL' && filters.status) {
        params.status = filters.status;
      }
      if (filters.dateFrom) {
        params.date_from = filters.dateFrom;
      }
      if (filters.dateTo) {
        params.date_to = filters.dateTo;
      }

      const res = await apiService.getBranchRequisitions(params);
      if ((res as any)?.error) {
        throw new Error((res as any).error);
      }
      const data = Array.isArray(res?.data?.data)
        ? (res?.data?.data as Requisition[])
        : Array.isArray(res?.data)
          ? (res?.data as Requisition[])
          : [];
      setRequisitions(data || []);
    } catch (error) {
      console.error('Failed to load requisitions', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось получить список заявок',
        variant: 'destructive',
      });
    } finally {
      setLoadingList(false);
    }
  }, [filters.dateFrom, filters.dateTo, filters.status]);

  useEffect(() => {
    loadCatalogs();
  }, [loadCatalogs]);

  useEffect(() => {
    loadRequisitions();
  }, [loadRequisitions]);

  const handleAddItem = () => {
    if (!selectedItemId) {
      toast({
        title: 'Выберите товар',
        description: 'Пожалуйста, выберите позицию для добавления',
        variant: 'destructive',
      });
      return;
    }

    if (quantity <= 0) {
      toast({
        title: 'Некорректное количество',
        description: 'Количество должно быть больше нуля',
        variant: 'destructive',
      });
      return;
    }

    const source = availableItems.find((item: any) => item.id === selectedItemId);
    if (!source) {
      toast({
        title: 'Товар не найден',
        description: 'Выбранная позиция недоступна',
        variant: 'destructive',
      });
      return;
    }

    setDraftItems((prev) => {
      const existingIndex = prev.findIndex(
        (it) => it.id === selectedItemId && it.type === itemType,
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        };
        return updated;
      }

      return [
        ...prev,
        {
          id: selectedItemId,
          type: itemType,
          name: source.name,
          quantity,
        },
      ];
    });

    setSelectedItemId('');
    setQuantity(1);
  };

  const handleRemoveItem = (id: string, type: DraftItem['type']) => {
    setDraftItems((prev) => prev.filter((item) => !(item.id === id && item.type === type)));
  };

  const handleCreateRequisition = async () => {
    if (draftItems.length === 0) {
      toast({
        title: 'Добавьте товары',
        description: 'Заявка не может быть пустой',
        variant: 'destructive',
      });
      return;
    }

    setLoadingCreate(true);
    try {
      const payload = {
        comment: comment.trim() ? comment.trim() : undefined,
        items: draftItems.map((item) => ({
          type: item.type,
          id: item.id,
          quantity: item.quantity,
        })),
      };

      const res = await apiService.createBranchRequisition(payload);
      if ((res as any)?.error) {
        throw new Error((res as any).error);
      }

      toast({
        title: 'Заявка отправлена',
        description: 'Заявка успешно создана и отправлена на склад',
      });

      setDraftItems([]);
      setComment('');
      await loadRequisitions();
    } catch (error) {
      console.error('Failed to create requisition', error);
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось создать заявку',
        variant: 'destructive',
      });
    } finally {
      setLoadingCreate(false);
    }
  };

  const formatDate = (iso: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    return date.toLocaleString('ru-RU');
  };

  const summarizeItems = (items: RequisitionItem[]) =>
    items.map((item) => `${item.name} — ${item.quantity} шт.`).join('; ');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Заявки</h1>
        <p className="text-muted-foreground">Создание и отслеживание заявок вашего филиала</p>
      </div>

      <section className="bg-white rounded-lg shadow p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Новая заявка</h2>
          <p className="text-sm text-muted-foreground">
            Выберите позиции и отправьте заявку на главный склад
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Тип позиции</label>
            <Select
              value={itemType}
              onValueChange={(value) => {
                setItemType(value as DraftItem['type']);
                setSelectedItemId('');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите тип" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="medicine">Лекарство</SelectItem>
                <SelectItem value="medical_device">ИМН</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Позиция</label>
            <Select value={selectedItemId} onValueChange={setSelectedItemId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите товар" />
              </SelectTrigger>
              <SelectContent>
                {availableItems.map((item: any) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Количество</label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={handleAddItem}>
            <Plus className="h-4 w-4 mr-2" />
            Добавить позицию
          </Button>
        </div>

        {draftItems.length > 0 && (
          <div className="border rounded-lg divide-y">
            {draftItems.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {item.type === 'medicine' ? 'Лекарство' : 'ИМН'} • {item.quantity} шт.
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveItem(item.id, item.type)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий</label>
          <Textarea
            placeholder="Дополнительная информация или пожелания"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={handleCreateRequisition} disabled={loadingCreate}>
            {loadingCreate && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Отправить заявку
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Мои заявки</h2>
            <p className="text-sm text-muted-foreground">
              Просматривайте историю заявок и отслеживайте их статус
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <div className="w-full md:w-40">
              <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Все</SelectItem>
                  <SelectItem value="pending">В ожидании</SelectItem>
                  <SelectItem value="approved">Принятые</SelectItem>
                  <SelectItem value="rejected">Отклонённые</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Дата с</label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Дата по</label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, dateTo: event.target.value }))
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Позиции</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingList ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
                    Загрузка заявок...
                  </TableCell>
                </TableRow>
              ) : requisitions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Заявок пока нет
                  </TableCell>
                </TableRow>
              ) : (
                requisitions.map((requisition) => (
                  <TableRow key={requisition.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(requisition.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[requisition.status]}>
                        {STATUS_LABELS[requisition.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-lg truncate">
                      {summarizeItems(requisition.items)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedRequisition(requisition)}
                      >
                        Подробнее
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <Dialog open={!!selectedRequisition} onOpenChange={(open) => !open && setSelectedRequisition(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Заявка #{selectedRequisition?.id.slice(0, 8)}</DialogTitle>
            <DialogDescription>
              {selectedRequisition && STATUS_LABELS[selectedRequisition.status]}
            </DialogDescription>
          </DialogHeader>

          {selectedRequisition && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANTS[selectedRequisition.status]}>
                  {STATUS_LABELS[selectedRequisition.status]}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Создана: {formatDate(selectedRequisition.created_at)}
                </span>
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Позиция</TableHead>
                      <TableHead className="w-32 text-right">Количество</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedRequisition.items.map((item) => (
                      <TableRow key={`${item.type}-${item.id}`}>
                        <TableCell>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.type === 'medicine' ? 'Лекарство' : 'ИМН'}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.quantity} шт.</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {selectedRequisition.comment && (
                <div>
                  <h3 className="text-sm font-semibold mb-1">Комментарий</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedRequisition.comment}
                  </p>
                </div>
              )}

              {selectedRequisition.processed_at && (
                <div className="text-sm text-muted-foreground">
                  Обработано: {formatDate(selectedRequisition.processed_at)}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BranchRequisitions;
