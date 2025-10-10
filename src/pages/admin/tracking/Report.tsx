import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { apiService } from '@/utils/api';

interface BranchOption {
  label: string;
  value: string;
}

interface TrackingReportResult {
  period: { from: string; to: string };
  branch_id: string | null;
  kind: 'payroll' | 'expenses' | 'combined';
  payroll_sum: number;
  expenses_sum: number;
  sent_value: number;
  total: number;
}

const moneyFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const todayIso = () => new Date().toISOString().slice(0, 10);

const Report: React.FC = () => {
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([
    { label: 'Главный склад', value: 'warehouse' },
  ]);
  const [form, setForm] = useState({
    date_from: todayIso(),
    date_to: todayIso(),
    branch_id: 'warehouse',
    kind: 'combined' as 'payroll' | 'expenses' | 'combined',
  });
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<TrackingReportResult | null>(null);

  const branchLabelMap = useMemo(() => {
    const map: Record<string, string> = { warehouse: 'Главный склад' };
    branchOptions.forEach((option) => {
      map[option.value] = option.label;
    });
    return map;
  }, [branchOptions]);

  useEffect(() => {
    void fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const res = await apiService.getBranches();
      const list = Array.isArray(res.data)
        ? res.data
        : Array.isArray((res.data as any)?.data)
        ? (res.data as any).data
        : [];
      const options = [
        { label: 'Главный склад', value: 'warehouse' },
        ...list.map((branch: any) => ({ label: branch.name, value: branch.id })),
      ];
      setBranchOptions(options);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить список филиалов',
        variant: 'destructive',
      });
    }
  };

  const handleGenerate = async () => {
    if (!form.date_from || !form.date_to) {
      toast({
        title: 'Ошибка',
        description: 'Выберите период отчёта',
        variant: 'destructive',
      });
      return;
    }
    if (form.date_from > form.date_to) {
      toast({
        title: 'Ошибка',
        description: 'Дата начала не может быть позже даты окончания',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await apiService.getTrackingReport({
        date_from: form.date_from,
        date_to: form.date_to,
        branch_id: form.branch_id,
        kind: form.kind,
      });
      if (res.error) {
        toast({
          title: 'Ошибка',
          description: res.error,
          variant: 'destructive',
        });
        setReport(null);
        return;
      }
      const data = res.data as TrackingReportResult | undefined;
      if (!data) {
        toast({
          title: 'Ошибка',
          description: 'Не удалось получить данные отчёта',
          variant: 'destructive',
        });
        setReport(null);
        return;
      }
      setReport(data);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось сформировать отчёт',
        variant: 'destructive',
      });
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const branchLabel = (id: string | null | undefined) => {
    if (!id || id === 'warehouse') {
      return branchLabelMap['warehouse'] ?? 'Главный склад';
    }
    return branchLabelMap[id] ?? '—';
  };

  const kindLabel = (kind: 'payroll' | 'expenses' | 'combined') => {
    switch (kind) {
      case 'payroll':
        return 'По зарплатам';
      case 'expenses':
        return 'По расходам';
      default:
        return 'Общий отчёт';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Отчёт</h1>
        <p className="text-gray-600 mt-2">
          Сформируйте отчёт по зарплатам и расходам за выбранный период и филиал.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Параметры отчёта</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="date_from">Дата с</Label>
              <Input
                id="date_from"
                type="date"
                value={form.date_from}
                onChange={(event) => setForm((prev) => ({ ...prev, date_from: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="date_to">Дата по</Label>
              <Input
                id="date_to"
                type="date"
                value={form.date_to}
                onChange={(event) => setForm((prev) => ({ ...prev, date_to: event.target.value }))}
              />
            </div>
            <div>
              <Label>Филиал</Label>
              <Select
                value={form.branch_id}
                onValueChange={(value) => setForm((prev) => ({ ...prev, branch_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите филиал" />
                </SelectTrigger>
                <SelectContent>
                  {branchOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Тип отчёта</Label>
              <Select
                value={form.kind}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, kind: value as 'payroll' | 'expenses' | 'combined' }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите тип" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="combined">Общий</SelectItem>
                  <SelectItem value="payroll">По зарплатам</SelectItem>
                  <SelectItem value="expenses">По расходам</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? 'Формирование…' : 'Сгенерировать отчёт'}
          </Button>
        </CardContent>
      </Card>

      {report && (
        <Card>
          <CardHeader>
            <CardTitle>Результаты</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-gray-500">Период</p>
                <p className="text-lg font-semibold">
                  {report.period.from} — {report.period.to}
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-gray-500">Филиал</p>
                <p className="text-lg font-semibold">{branchLabel(report.branch_id)}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-gray-500">Тип отчёта</p>
                <p className="text-lg font-semibold">{kindLabel(report.kind)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-gray-500">Итог по зарплатам</p>
                <p className="text-2xl font-semibold">
                  {moneyFormatter.format(report.payroll_sum ?? 0)} ₸
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-gray-500">Итог по расходам</p>
                <p className="text-2xl font-semibold">
                  {moneyFormatter.format(report.expenses_sum ?? 0)} ₸
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-gray-500">Стоимость отправленных товаров</p>
                <p className="text-2xl font-semibold">
                  {moneyFormatter.format(report.sent_value ?? 0)} ₸
                </p>
              </div>
              <div className="rounded-lg border p-4 bg-blue-50 border-blue-200">
                <p className="text-sm text-blue-700">Итого</p>
                <p className="text-2xl font-semibold text-blue-800">
                  {moneyFormatter.format(report.total ?? 0)} ₸
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Report;
