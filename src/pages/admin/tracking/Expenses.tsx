import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { apiService } from '@/utils/api';

const moneyFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface BranchOption {
  label: string;
  value: string;
}

interface ExpenseRow {
  id: string;
  title: string;
  description: string | null;
  branch_id: string | null;
  amount: number;
  date: string;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

const Expenses: React.FC = () => {
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([
    { label: 'Главный склад', value: 'warehouse' },
  ]);
  const [entries, setEntries] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    branch_id: 'warehouse',
    amount: '',
    date: todayIso(),
  });
  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    branch_id: '',
  });

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

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getExpenses({
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        branch_id: filters.branch_id || undefined,
      });
      if (res.error) {
        toast({
          title: 'Ошибка',
          description: res.error,
          variant: 'destructive',
        });
        setEntries([]);
        return;
      }
      const data = (res.data as any)?.data ?? [];
      setEntries(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить расходы',
        variant: 'destructive',
      });
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [filters.branch_id, filters.date_from, filters.date_to]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

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

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите название расхода',
        variant: 'destructive',
      });
      return;
    }
    const amountValue = Number(form.amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      toast({
        title: 'Ошибка',
        description: 'Сумма должна быть больше нуля',
        variant: 'destructive',
      });
      return;
    }
    if (!form.date) {
      toast({
        title: 'Ошибка',
        description: 'Выберите дату расхода',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const res = await apiService.createExpense({
        title: form.title.trim(),
        description: form.description.trim() ? form.description.trim() : undefined,
        branch_id: form.branch_id || undefined,
        amount: amountValue,
        date: form.date,
      });
      if (res.error) {
        toast({
          title: 'Ошибка',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Успех', description: 'Расход добавлен' });
      setForm((prev) => ({
        ...prev,
        title: '',
        description: '',
        amount: '',
      }));
      await loadEntries();
    } catch (error) {
      console.error(error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить расход',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const branchLabel = (id: string | null | undefined) => {
    if (!id) return branchLabelMap['warehouse'] ?? 'Главный склад';
    return branchLabelMap[id] ?? '—';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Расходы</h1>
        <p className="text-gray-600 mt-2">
          Фиксируйте расходы и контролируйте затраты по каждому филиалу.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Добавить расход</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="md:col-span-2 lg:col-span-1">
                <Label htmlFor="title">Название</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Например, аренда офиса"
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
                <Label htmlFor="amount">Сумма</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label htmlFor="date">Дата</Label>
                <Input
                  id="date"
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Дополнительные детали (необязательно)"
                  rows={3}
                />
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Сохранение…' : 'Добавить расход'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>История расходов</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="filter_date_from">Дата с</Label>
              <Input
                id="filter_date_from"
                type="date"
                value={filters.date_from}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, date_from: event.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="filter_date_to">Дата по</Label>
              <Input
                id="filter_date_to"
                type="date"
                value={filters.date_to}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, date_to: event.target.value }))
                }
              />
            </div>
            <div>
              <Label>Филиал</Label>
              <Select
                value={filters.branch_id}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, branch_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Все филиалы" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Все филиалы</SelectItem>
                  {branchOptions.map((option) => (
                    <SelectItem key={`filter-${option.value}`} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-gray-500">Загрузка…</div>
          ) : entries.length === 0 ? (
            <div className="py-10 text-center text-gray-500">Нет расходов за выбранный период</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Дата</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Название</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Описание</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Филиал</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-700">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-t">
                      <td className="px-4 py-2 whitespace-nowrap">{entry.date}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{entry.title}</td>
                      <td className="px-4 py-2">
                        {entry.description ? entry.description : '—'}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">{branchLabel(entry.branch_id)}</td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        {moneyFormatter.format(entry.amount ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Expenses;
