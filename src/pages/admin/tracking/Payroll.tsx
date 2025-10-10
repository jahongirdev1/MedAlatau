import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BranchSelect from '@/components/BranchSelect';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import api from '@/utils/api';

const moneyFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface BranchOption {
  label: string;
  value: string;
}

interface PayrollRow {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  branch_id: string | null;
  amount: number;
  date: string;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

const Payroll: React.FC = () => {
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([
    { label: 'Главный склад', value: 'warehouse' },
  ]);
  const [entries, setEntries] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    role: '',
    branch_id: 'warehouse',
    amount: '',
    date: todayIso(),
  });
  const [filters, setFilters] = useState<{ date_from: string; date_to: string; branch_id: string | undefined }>({
    date_from: '',
    date_to: '',
    branch_id: undefined,
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
      const res = await api.getPayroll({
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
        description: 'Не удалось загрузить записи',
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
      const res = await api.getBranches();
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
    if (!form.first_name.trim() || !form.last_name.trim() || !form.role.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Заполните имя, фамилию и должность',
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
        description: 'Выберите дату выплаты',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        role: form.role.trim(),
        branch_id: form.branch_id && form.branch_id !== 'warehouse' ? form.branch_id : null,
        amount: amountValue,
        date: form.date,
      };
      const res = await api.createPayroll(payload);
      if (res.error) {
        toast({
          title: 'Ошибка',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Успех', description: 'Запись о зарплате добавлена' });
      setForm((prev) => ({
        ...prev,
        first_name: '',
        last_name: '',
        role: '',
        amount: '',
      }));
      await loadEntries();
    } catch (error) {
      console.error(error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить запись',
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
        <h1 className="text-3xl font-bold text-gray-900">Зарплата</h1>
        <p className="text-gray-600 mt-2">
          Добавляйте записи о начислении заработной платы и отслеживайте выплаты по филиалам.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Добавить запись</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="first_name">Имя</Label>
                <Input
                  id="first_name"
                  value={form.first_name}
                  onChange={(event) => setForm((prev) => ({ ...prev, first_name: event.target.value }))}
                  placeholder="Имя сотрудника"
                />
              </div>
              <div>
                <Label htmlFor="last_name">Фамилия</Label>
                <Input
                  id="last_name"
                  value={form.last_name}
                  onChange={(event) => setForm((prev) => ({ ...prev, last_name: event.target.value }))}
                  placeholder="Фамилия сотрудника"
                />
              </div>
              <div>
                <Label htmlFor="role">Роль</Label>
                <Input
                  id="role"
                  value={form.role}
                  onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
                  placeholder="Должность"
                />
              </div>
              <div>
                <Label>Филиал</Label>
                <BranchSelect
                  value={form.branch_id}
                  onChange={(value) => setForm((prev) => ({ ...prev, branch_id: value }))}
                  includeWarehouse
                  placeholder="Филиал"
                />
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
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Сохранение…' : 'Добавить запись'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>История выплат</CardTitle>
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
              <BranchSelect
                value={filters.branch_id}
                onChange={(value) =>
                  setFilters((prev) => ({ ...prev, branch_id: value }))
                }
                includeWarehouse
                placeholder="Все филиалы"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-gray-500">Загрузка…</div>
          ) : entries.length === 0 ? (
            <div className="py-10 text-center text-gray-500">Нет записей за выбранный период</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Дата</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Сотрудник</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Роль</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Филиал</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-700">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-t">
                      <td className="px-4 py-2 whitespace-nowrap">{entry.date}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {entry.last_name} {entry.first_name}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">{entry.role}</td>
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

export default Payroll;
