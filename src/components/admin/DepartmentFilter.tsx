import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";

export const ALL_DEPARTMENTS = "all";

type Department = {
  id: string;
  code: string;
  name: string;
};

/**
 * Department scoping uses the authoritative Supabase departments table
 * through a SuperAdmin-only RPC. This avoids depending on direct REST
 * table permissions/RLS for the selector.
 */
export function DepartmentFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const departments = useQuery({
    queryKey: ["departments", "filter"],
    queryFn: async (): Promise<Department[]> => {
      const { data, error } = await supabase.rpc("superadmin_list_departments");
      if (error) throw new Error(error.message);
      return (data ?? []) as Department[];
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="tap-target w-full rounded-xl sm:w-64" aria-label="Department">
        <SelectValue placeholder="All departments" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_DEPARTMENTS}>All departments</SelectItem>
        {departments.isError ? (
          <SelectItem value="departments-error" disabled>
            Departments unavailable
          </SelectItem>
        ) : (
          departments.data?.map((department) => (
            <SelectItem key={department.id} value={department.id}>
              {department.code} · {department.name}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
