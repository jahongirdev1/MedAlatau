import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import apiService from '@/utils/api';
import { formatDateTimeAlmaty } from '@/utils/datetime';

type ReportType = 'stock' | 'dispensings' | 'arrivals';

type BranchOption = {
  id: string;
  name: string;
};

type ReportRow = Record<string, any>;

export default function BranchReports() {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchId, setBranchId] = useState('');
  const [type, setType] = useState<ReportType>('stock');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const res = await apiService.getBranches();
        if ((res as any)?.error) {
          throw new Error((res as any).error);
        }
        const data = Array.isArray(res.data)
          ? res.data
          : Array.isArray((res.data as any)?.data)
            ? (res.data as any).data
            : [];
        setBranches(data);
      } catch (err) {
        console.error(err);
        toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: 'Не удалось загрузить филиалы',
        });
      }
    };

    loadBranches();
  }, []);

  useEffect(() => {
    setRows([]);
    setError('');
    setLoading(false);
  }, [branchId, type]);

  const canGenerate = useMemo(() => branchId !== '', [branchId]);

  async function generate() {
    if (!canGenerate) {
      toast({ variant: 'destructive', title: 'Выберите филиал' });
      return;
    }

    setLoading(true);
    setError('');

    try {
      const common = {
        branch_id: branchId,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      };

      let res: { data?: ReportRow[]; error?: string } | undefined;

      if (type === 'stock') {
        res = await apiService.getBranchStock(common);
      } else if (type === 'dispensings') {
        res = await apiService.getBranchDispensings(common);
      } else if (type === 'arrivals') {
        res = await apiService.getBranchArrivals(common);
      }

      if (res?.error) {
        throw new Error(res.error);
      }

      const data = Array.isArray(res?.data) ? res?.data : [];
      setRows(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка формирования отчёта';
      setError(message);
      toast({
        variant: 'destructive',
        title: 'Ошибка формирования отчёта',
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }

  async function exportExcel() {
    if (!canGenerate) {
      toast({ variant: 'destructive', title: 'Выберите филиал' });
      return;
    }

    const common = {
      branch_id: branchId,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    };

    try {
      if (type === 'stock') {
        await apiService.exportBranchStockExcel(common);
      } else if (type === 'dispensings') {
        await apiService.exportBranchDispensingsExcel(common);
      } else if (type === 'arrivals') {
        await apiService.exportBranchArrivalsExcel(common);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка экспорта';
      toast({
        variant: 'destructive',
        title: 'Ошибка экспорта',
        description: message,
      });
    }
  }

  const showEmptyState = !loading && rows.length === 0 && !error;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Отчёты филиалов</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <div className="text-sm font-medium">Филиал</div>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите филиал" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium">Тип отчёта</div>
            <Select value={type} onValueChange={(value) => setType(value as ReportType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stock">Отчёт по остаткам</SelectItem>
                <SelectItem value="dispensings">Отчёт по выдачам</SelectItem>
                <SelectItem value="arrivals">Отчёт по поступлениям</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium">Дата с</div>
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium">Дата по</div>
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </div>

          <div className="col-span-4 flex gap-3">
            <Button disabled={!canGenerate || loading} onClick={generate}>
              Сформировать отчёт
            </Button>
            <Button variant="outline" onClick={exportExcel} disabled={loading}>
              Экспорт в Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-6">
          {error && <div className="text-sm text-destructive mb-3">{error}</div>}
          {loading && <div className="text-sm text-muted-foreground">Загрузка...</div>}
          {showEmptyState && <div className="text-sm text-muted-foreground">Нет данных</div>}

          {!loading && rows.length > 0 && type === 'stock' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-2 font-medium">Наименование</th>
                  <th className="font-medium">Тип</th>
                  <th className="font-medium">Количество</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id ?? index} className="border-t">
                    <td className="py-2">{row.name}</td>
                    <td>{row.type === 'medical_device' ? 'ИМН' : 'Лекарство'}</td>
                    <td>{row.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && rows.length > 0 && type === 'dispensings' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-2 font-medium">Дата и время</th>
                  <th className="font-medium">Пациент</th>
                  <th className="font-medium">Сотрудник</th>
                  <th className="font-medium">Выдано</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id ?? row.datetime} className="border-t">
                    <td className="py-2">{row.datetime ? formatDateTimeAlmaty(row.datetime) : '—'}</td>
                    <td>{row.patient_name ?? '—'}</td>
                    <td>{row.employee_name ?? '—'}</td>
                    <td>
                      {(row.items ?? []).map((item: any) => `${item.name} — ${item.quantity}`).join('; ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && rows.length > 0 && type === 'arrivals' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-2 font-medium">Дата и время</th>
                  <th className="font-medium">Поступило</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id ?? row.datetime} className="border-t">
                    <td className="py-2">{row.datetime ? formatDateTimeAlmaty(row.datetime) : '—'}</td>
                    <td>
                      {(row.items ?? []).map((item: any) => `${item.name} — ${item.quantity}`).join('; ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
