import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PaperAssignment } from "@/services";

/** Assigned-paper selector shared by the admin monitoring and attendance pages. */
export function PaperPicker({
  papers,
  value,
  onChange,
}: {
  papers: PaperAssignment[];
  value: string | undefined;
  onChange: (paperId: string) => void;
}) {
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger className="tap-target w-full rounded-xl sm:w-72">
        <SelectValue placeholder="Select an assigned paper" />
      </SelectTrigger>
      <SelectContent>
        {papers.map((paper) => (
          <SelectItem key={paper.paperId} value={paper.paperId}>
            {paper.courseCode} · {paper.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
