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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, FileDown, Printer, AlertTriangle, CheckCircle2 } from 'lucide-react';

type RequisitionItem = {
  type: 'medicine' | 'medical_device';
  id: string;
  name: string;
  quantity: number;
};

type AvailabilityItem = {
  item_type: 'medicine' | 'medical_device';
  item_id: string;
  name: string;
  requested_qty: number;
  available_qty: number;
  shortage: number;
};

type WarehouseRequest = {
  id: string;
  branch_id: string;
  branch_name?: string | null;
  employee_id?: string | null;
  status: string;
  comment?: string | null;
  processed_by?: string | null;
  processed_at?: string | null;
  created_at?: string | null;
  shipment_id?: string | null;
  items: RequisitionItem[];
  availability: AvailabilityItem[];
  shortage_total?: number;
  can_fulfill?: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'В ожидании',
  approved: 'Одобрена',
  accepted: 'Отгружена',
  rejected: 'Отклонена',
};

const STATUS_VARIANTS: Record<string, 'secondary' | 'default' | 'destructive'> = {
  pending: 'secondary',
  approved: 'default',
  accepted: 'default',
  rejected: 'destructive',
};

const TYPE_LABEL: Record<'medicine' | 'medical_device', string> = {
  medicine: 'Лекарство',
  medical_device: 'ИМН',
};

const AdminRequisitions: React.FC = () => {
  const [branches, setBranches] = useState<any[]>([]);
  const [requisitions, setRequisitions] = useState<WarehouseRequest[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<WarehouseRequest | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptComment, setAcceptComment] = useState('');
  const [lastShipmentId, setLastShipmentId] = useState<string | null>(null);

  const [filters, setFilters] = useState({ branch: 'ALL', status: 'ALL', dateFrom: '', dateTo: '' });

  const branchMap = useMemo(() => {
    const map: Record<string, string> = {};
    branches.forEach((branch: any) => {
      if (branch?.id) {
        map[branch.id] = branch.name;
      }
    });
    return map;
  }, [branches]);

  const getShortageTotal = useCallback((req: WarehouseRequest) => {
    if (typeof req.shortage_total === 'number') {
      return req.shortage_total;
    }
    return Array.isArray(req.availability)
      ? req.availability.reduce((sum, item) => sum + (item.shortage ?? 0), 0)
      : 0;
  }, []);

  const hasEnoughStock = useCallback(
    (req: WarehouseRequest) => {
      if (typeof req.can_fulfill === 'boolean') {
        return req.can_fulfill;
      }
      return getShortageTotal(req) === 0;
    },
    [getShortageTotal],
  );

  const summarizeItems = useCallback((req: WarehouseRequest) => {
    const items = Array.isArray(req.items) ? req.items : [];
    if (items.length === 0) return 'Позиции не указаны';
    return items.map((item) => `${item.name} — ${item.quantity} шт.`).join('; ');
  }, []);

  const parseErrorMessage = useCallback((error: unknown) => {
    if (error instanceof Error) {
      try {
        const parsed = JSON.parse(error.message);
        if (parsed?.message) {
          return parsed.message as string;
        }
      } catch {
        /* ignore */
      }
      return error.message;
    }
    return 'Неизвестная ошибка';
  }, []);

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

  const loadRequests = useCallback(async () => {
    setLoadingList(true);
    try {
      const params: Record<string, string> = {};
      if (filters.branch && filters.branch !== 'ALL') {
        params.branch_id = filters.branch;
      }
      if (filters.status && filters.status !== 'ALL') {
        params.status = filters.status;
      }
      if (filters.dateFrom) {
        params.date_from = filters.dateFrom;
      }
      if (filters.dateTo) {
        params.date_to = filters.dateTo;
      }

      const res = await apiService.getWarehouseRequests(params);
      if (res.error) {
        throw new Error(res.error);
      }
      const data = Array.isArray(res?.data?.data)
        ? (res.data.data as WarehouseRequest[])
        : Array.isArray(res?.data)
          ? (res.data as WarehouseRequest[])
          : [];
      setRequisitions(data ?? []);
    } catch (error) {
      console.error('Failed to load requests', error);
      toast({
        title: 'Ошибка',
        description: parseErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoadingList(false);
    }
  }, [filters.branch, filters.dateFrom, filters.dateTo, filters.status, parseErrorMessage]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const formatDate = useCallback((iso?: string | null) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('ru-RU');
  }, []);

  const openDetail = useCallback(
    async (request: WarehouseRequest) => {
      setSelectedRequest(request);
      setLastShipmentId(request.shipment_id ?? null);
      setAcceptComment('');
      setDetailOpen(true);
      setDetailLoading(true);
      try {
        const res = await apiService.getWarehouseRequestById(request.id);
        if (res.error) {
          throw new Error(res.error);
        }
        const data = (res?.data?.data ?? res?.data) as WarehouseRequest | undefined;
        if (data) {
          setSelectedRequest(data);
          setLastShipmentId(data.shipment_id ?? null);
        }
      } catch (error) {
        console.error('Failed to load request detail', error);
        toast({
          title: 'Ошибка',
          description: parseErrorMessage(error),
          variant: 'destructive',
        });
      } finally {
        setDetailLoading(false);
      }
    },
    [parseErrorMessage],
  );

  const closeDetail = useCallback(() => {
    setDetailOpen(false);
    setSelectedRequest(null);
    setAcceptComment('');
    setLastShipmentId(null);
  }, []);

  const refreshDetail = useCallback(async (id: string) => {
    const detail = await apiService.getWarehouseRequestById(id);
    if (!detail.error) {
      const data = (detail.data?.data ?? detail.data) as WarehouseRequest | undefined;
      if (data) {
        setSelectedRequest(data);
        setLastShipmentId(data.shipment_id ?? null);
      }
    }
  }, []);

  const handleAccept = useCallback(async () => {
    if (!selectedRequest) return;

    const shortage = getShortageTotal(selectedRequest);
    if (shortage > 0 || selectedRequest.status === 'accepted') {
      return;
    }

    setAccepting(true);
    try {
      const comment = acceptComment.trim();
      const res = await apiService.acceptWarehouseRequest(
        selectedRequest.id,
        comment ? { comment } : undefined,
      );
      if (res.error) {
        throw new Error(res.error);
      }
      const payload = res.data as { shipment_id?: string };
      const shipmentId = payload?.shipment_id ?? null;
      setLastShipmentId(shipmentId);
      toast({
        title: 'Отгрузка создана',
        description: 'Заявка принята и отгрузка сформирована',
      });
      setAcceptComment('');
      await loadRequests();
      await refreshDetail(selectedRequest.id);
    } catch (error) {
      console.error('Failed to accept request', error);
      toast({
        title: 'Ошибка',
        description: parseErrorMessage(error),
        variant: 'destructive',
      });
      await refreshDetail(selectedRequest.id);
    } finally {
      setAccepting(false);
    }
  }, [acceptComment, getShortageTotal, loadRequests, parseErrorMessage, refreshDetail, selectedRequest]);

  const downloadShipmentWaybill = useCallback(
    async (shipmentId: string) => {
      try {
        const blob = await apiService.getShipmentWaybillPDF(shipmentId);
        const filename = `waybill_${shipmentId}.pdf`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } catch (error) {
        console.error('Failed to download waybill', error);
        toast({
          title: 'Ошибка',
          description: parseErrorMessage(error),
          variant: 'destructive',
        });
      }
    },
    [parseErrorMessage],
  );

  const printShipmentWaybill = useCallback(
    async (shipmentId: string) => {
      try {
        const blob = await apiService.getShipmentWaybillPDF(shipmentId);
        const url = URL.createObjectURL(blob);
        const cleanup = () => {
          setTimeout(() => URL.revokeObjectURL(url), 4000);
        };
        const win = window.open(url);
        if (win) {
          win.onload = () => {
            win.focus();
            win.print();
            cleanup();
          };
        } else {
          const iframe = document.createElement('iframe');
          iframe.style.position = 'fixed';
          iframe.style.width = '0';
          iframe.style.height = '0';
          iframe.style.border = '0';
          iframe.src = url;
          document.body.appendChild(iframe);
          iframe.onload = () => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            cleanup();
            setTimeout(() => iframe.remove(), 4000);
          };
        }
      } catch (error) {
        console.error('Failed to print waybill', error);
        toast({
          title: 'Ошибка',
          description: parseErrorMessage(error),
          variant: 'destructive',
        });
      }
    },
    [parseErrorMessage],
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Заявки филиалов</h1>
        <p className="text-muted-foreground">
          Проверяйте доступность позиций на главном складе и создавайте отгрузки по готовым заявкам
        </p>
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
                <SelectItem value="accepted">Отгружена</SelectItem>
                <SelectItem value="approved">Одобрена</SelectItem>
                <SelectItem value="rejected">Отклонена</SelectItem>
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
              <TableHead>Наличие</TableHead>
              <TableHead>Позиции</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingList ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
                  Загрузка заявок...
                </TableCell>
              </TableRow>
            ) : requisitions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Заявок не найдено
                </TableCell>
              </TableRow>
            ) : (
              requisitions.map((req) => {
                const branchName = req.branch_name ?? branchMap[req.branch_id] ?? req.branch_id;
                const statusLabel = STATUS_LABELS[req.status] ?? req.status;
                const statusVariant = STATUS_VARIANTS[req.status] ?? 'secondary';
                const shortage = getShortageTotal(req);
                const enough = hasEnoughStock(req);

                return (
                  <TableRow key={req.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(req.created_at)}</TableCell>
                    <TableCell>{branchName}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant}>{statusLabel}</Badge>
                    </TableCell>
                    <TableCell>
                      {enough ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-transparent">
                          Хватает
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 border-transparent">
                          Недостаточно: -{shortage}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xl truncate">{summarizeItems(req)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openDetail(req)}
                      >
                        Подробнее
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </section>

      <Dialog open={detailOpen} onOpenChange={(open) => (open ? setDetailOpen(true) : closeDetail())}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedRequest ? `Заявка #${selectedRequest.id.slice(0, 8)}` : 'Заявка'}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-10 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Загрузка...
            </div>
          ) : selectedRequest ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={STATUS_VARIANTS[selectedRequest.status] ?? 'secondary'}>
                  {STATUS_LABELS[selectedRequest.status] ?? selectedRequest.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Филиал:{' '}
                  {selectedRequest.branch_name ??
                    branchMap[selectedRequest.branch_id] ??
                    selectedRequest.branch_id}
                </span>
                <span className="text-sm text-muted-foreground">
                  Создана: {formatDate(selectedRequest.created_at)}
                </span>
                {selectedRequest.processed_at && (
                  <span className="text-sm text-muted-foreground">
                    Обработана: {formatDate(selectedRequest.processed_at)}
                  </span>
                )}
              </div>

              {!hasEnoughStock(selectedRequest) && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Недостаточно остатков</AlertTitle>
                  <AlertDescription>
                    Суммарный дефицит по заявке: -{getShortageTotal(selectedRequest)} шт.
                  </AlertDescription>
                </Alert>
              )}

              {(selectedRequest.status === 'accepted' || lastShipmentId) && (
                <Alert className="bg-emerald-50 border-emerald-200 text-emerald-900">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Отгрузка создана</AlertTitle>
                  <AlertDescription>
                    Номер отгрузки: {(selectedRequest.shipment_id ?? lastShipmentId ?? '').slice(0, 8)}
                  </AlertDescription>
                </Alert>
              )}

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Позиция</TableHead>
                      <TableHead className="text-right">Запрошено / Доступно</TableHead>
                      <TableHead className="text-right">Дефицит</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedRequest.availability ?? []).map((item) => (
                      <TableRow key={`${item.item_type}-${item.item_id}`}>
                        <TableCell>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-xs text-muted-foreground">{TYPE_LABEL[item.item_type]}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium">{item.requested_qty}</span>
                          <span className="text-muted-foreground"> / </span>
                          <span className="font-medium">{item.available_qty}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.shortage > 0 ? (
                            <span className="text-destructive font-medium">
                              -{item.shortage}
                              <span className="ml-1 text-xs font-normal">Не хватает</span>
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-medium">0</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {selectedRequest.comment && (
                <div>
                  <h3 className="text-sm font-semibold mb-1">Комментарий</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedRequest.comment}
                  </p>
                </div>
              )}

              {selectedRequest.status !== 'accepted' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Комментарий к отгрузке (опционально)
                  </label>
                  <Textarea
                    placeholder="Укажите дополнительные инструкции для отгрузки"
                    value={acceptComment}
                    onChange={(event) => setAcceptComment(event.target.value)}
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-3 justify-end">
                <Button type="button" variant="secondary" onClick={closeDetail} disabled={accepting}>
                  Закрыть
                </Button>
                <Button
                  type="button"
                  className="gap-2"
                  onClick={handleAccept}
                  disabled={
                    accepting ||
                    !hasEnoughStock(selectedRequest) ||
                    selectedRequest.status === 'accepted'
                  }
                  title={
                    !hasEnoughStock(selectedRequest)
                      ? 'Недостаточно остатков для отгрузки'
                      : selectedRequest.status === 'accepted'
                        ? 'Отгрузка уже создана'
                        : undefined
                  }
                >
                  {accepting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Принять и отгрузить
                </Button>
              </div>

              {selectedRequest.shipment_id && (
                <div className="flex flex-wrap gap-3 border-t pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => downloadShipmentWaybill(selectedRequest.shipment_id!)}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Скачать накладную (PDF)
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => printShipmentWaybill(selectedRequest.shipment_id!)}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Печать
                  </Button>
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
