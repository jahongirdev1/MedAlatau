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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Check, X } from 'lucide-react';

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

const AdminRequisitions: React.FC = () => {
  const [branches, setBranches] = useState<any[]>([]);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [processingStatus, setProcessingStatus] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedRequisition, setSelectedRequisition] = useState<Requisition | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [filters, setFilters] = useState({
    branch: 'ALL',
    status: 'ALL',
    dateFrom: '',
    dateTo: '',
  });

  const branchMap = useMemo(() => {
    const map: Record<string, string> = {};
    branches.forEach((branch: any) => {
      if (branch?.id) {
        map[branch.id] = branch.name;
      }
    });
    return map;
  }, [branches]);

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return '';
    const date = new Date(iso);
    return date.toLocaleString('ru-RU');
  };

  const summarizeItems = (items: RequisitionItem[]) =>
    items.map((item) => `${item.name} — ${item.quantity} шт.`).join('; ');

  const loadBranches = useCallback(async () => {
    try {
      const res = await apiService.getBranches();
      const data = Array.isArray(res?.data?.data)
        ? res.data.data
        : Array.isArray(res?.data)
          ? res.data
          : [];
      setBranches(data || []);
    } catch (error) {
      console.error('Failed to load branches', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить список филиалов',
        variant: 'destructive',
      });
    }
  }, []);

  const loadRequisitions = useCallback(async () => {
    setLoadingList(true);
    try {
      const params: Record<string, string> = {};
      if (filters.branch !== 'ALL' && filters.branch) {
        params.branch_id = filters.branch;
      }
      if (filters.status !== 'ALL' && filters.status) {
        params.status = filters.status;
      }
      if (filters.dateFrom) {
        params.date_from = filters.dateFrom;
      }
      if (filters.dateTo) {
        params.date_to = filters.dateTo;
      }

      const res = await apiService.getAdminRequisitions(params);
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
        description: error instanceof Error ? error.message : 'Не удалось загрузить заявки',
        variant: 'destructive',
      });
    } finally {
      setLoadingList(false);
    }
  }, [filters.branch, filters.dateFrom, filters.dateTo, filters.status]);

  const refreshSelected = useCallback(
    (updated?: Requisition | null) => {
      if (updated) {
        setSelectedRequisition(updated);
      } else if (selectedRequisition) {
        const fresh = requisitions.find((req) => req.id === selectedRequisition.id);
        if (fresh) {
          setSelectedRequisition(fresh);
        }
      }
    },
    [requisitions, selectedRequisition],
  );

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    loadRequisitions();
  }, [loadRequisitions]);

  const openDetail = async (requisition: Requisition) => {
    setSelectedRequisition(requisition);
    setRejectReason('');
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await apiService.getAdminRequisitionById(requisition.id);
      if ((res as any)?.error) {
        throw new Error((res as any).error);
      }
      const data = (res?.data?.data ?? res?.data) as Requisition | undefined;
      if (data) {
        setSelectedRequisition(data);
      }
    } catch (error) {
      console.error('Failed to load requisition detail', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить детали заявки',
        variant: 'destructive',
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setSelectedRequisition(null);
    setRejectReason('');
  };

  const handleStatusChange = async (
    id: string,
    status: 'approved' | 'rejected',
    reason?: string,
  ) => {
    setProcessingStatus(true);
    try {
      const payload: { status: 'approved' | 'rejected'; reason?: string } = { status };
      if (reason) {
        payload.reason = reason;
      }
      const res = await apiService.updateAdminRequisitionStatus(id, payload);
      if ((res as any)?.error) {
        throw new Error((res as any).error);
      }
      const data = (res?.data?.data ?? res?.data) as Requisition | undefined;
      toast({
        title: status === 'approved' ? 'Заявка принята' : 'Заявка отклонена',
        description:
          status === 'approved'
            ? 'Заявка успешно утверждена'
            : 'Заявка отклонена. Филиал будет уведомлён',
      });
      await loadRequisitions();
      refreshSelected(data ?? null);
      if (status === 'approved') {
        setRejectReason('');
      }
    } catch (error) {
      console.error('Failed to change status', error);
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось изменить статус заявки',
        variant: 'destructive',
      });
    } finally {
      setProcessingStatus(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Заявки филиалов</h1>
        <p className="text-muted-foreground">Просматривайте и обрабатывайте заявки от филиалов</p>
      </div>

      <section className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-xl font-semibold">Фильтры</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Филиал</label>
            <Select
              value={filters.branch}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, branch: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Все" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Все филиалы</SelectItem>
                {branches.map((branch: any) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
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
      </section>

      <section className="bg-white rounded-lg shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Филиал</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Позиции</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingList ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
                  Загрузка заявок...
                </TableCell>
              </TableRow>
            ) : requisitions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Заявок не найдено
                </TableCell>
              </TableRow>
            ) : (
              requisitions.map((requisition) => (
                <TableRow key={requisition.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(requisition.created_at)}</TableCell>
                  <TableCell>{branchMap[requisition.branch_id] ?? requisition.branch_id}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[requisition.status]}>
                      {STATUS_LABELS[requisition.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xl truncate">
                    {summarizeItems(requisition.items)}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openDetail(requisition)}
                    >
                      Подробнее
                    </Button>
                    {requisition.status === 'pending' && (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={processingStatus}
                          onClick={() => handleStatusChange(requisition.id, 'approved')}
                        >
                          <Check className="h-4 w-4 mr-1" /> Принять
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => openDetail(requisition)}
                        >
                          <X className="h-4 w-4 mr-1" /> Отклонить
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      <Dialog open={detailOpen} onOpenChange={(open) => (open ? setDetailOpen(true) : closeDetail())}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedRequisition ? `Заявка #${selectedRequisition.id.slice(0, 8)}` : 'Заявка'}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-10 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Загрузка...
            </div>
          ) : selectedRequisition ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={STATUS_VARIANTS[selectedRequisition.status]}>
                  {STATUS_LABELS[selectedRequisition.status]}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Филиал: {branchMap[selectedRequisition.branch_id] ?? selectedRequisition.branch_id}
                </span>
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
                  Обработано: {formatDate(selectedRequisition.processed_at)} (пользователь {selectedRequisition.processed_by})
                </div>
              )}

              {selectedRequisition.status === 'pending' && (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Причина отклонения</h3>
                    <Textarea
                      placeholder="Укажите причину, если отклоняете заявку"
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-3 justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={processingStatus}
                      onClick={() => handleStatusChange(selectedRequisition.id, 'approved')}
                    >
                      {processingStatus ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Принять
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={processingStatus}
                      onClick={() => handleStatusChange(selectedRequisition.id, 'rejected', rejectReason.trim() || undefined)}
                    >
                      {processingStatus ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <X className="h-4 w-4 mr-2" />
                      )}
                      Отклонить
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-6 text-center text-muted-foreground">Заявка не выбрана</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRequisitions;
