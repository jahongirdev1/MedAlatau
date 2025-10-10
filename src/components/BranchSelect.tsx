import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/utils/api";

type Branch = { id: string; name: string };

type BranchSelectProps = {
  value: string | undefined;
  onChange: (value: string) => void;
  includeWarehouse?: boolean;
  placeholder?: string;
};

export default function BranchSelect({
  value,
  onChange,
  includeWarehouse = true,
  placeholder = "Выберите филиал",
}: BranchSelectProps) {
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await api.getBranches?.();
        if (!ignore) {
          const list = Array.isArray(res?.data)
            ? res.data
            : Array.isArray((res as any)?.data?.data)
            ? (res as any).data.data
            : [];
          setBranches(Array.isArray(list) ? list : []);
        }
      } catch {
        if (!ignore) {
          setBranches([]);
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {includeWarehouse && (
          <SelectItem value="warehouse">Главный склад</SelectItem>
        )}
        {branches
          .filter((branch) => !!branch?.id)
          .map((branch) => (
            <SelectItem key={branch.id} value={String(branch.id)}>
              {branch.name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
