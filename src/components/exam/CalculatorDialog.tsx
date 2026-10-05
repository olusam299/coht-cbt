import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface CalculatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Op = "+" | "-" | "×" | "÷";

const KEYS: string[] = [
  "C", "±", "%", "÷",
  "7", "8", "9", "×",
  "4", "5", "6", "-",
  "1", "2", "3", "+",
  "0", ".", "=",
];

function apply(a: number, b: number, op: Op) {
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  if (op === "×") return a * b;
  return b === 0 ? NaN : a / b;
}

/** Basic four-function calculator permitted during the sitting. */
export function CalculatorDialog({ open, onOpenChange }: CalculatorDialogProps) {
  const [display, setDisplay] = useState("0");
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [fresh, setFresh] = useState(true);

  const press = (key: string) => {
    if (key === "C") {
      setDisplay("0");
      setAcc(null);
      setOp(null);
      setFresh(true);
      return;
    }
    if (key === "±") {
      setDisplay((d) => (d.startsWith("-") ? d.slice(1) : d === "0" ? d : `-${d}`));
      return;
    }
    if (key === "%") {
      setDisplay((d) => String(Number(d) / 100));
      setFresh(true);
      return;
    }
    if (key === "=") {
      if (op !== null && acc !== null) {
        const result = apply(acc, Number(display), op);
        setDisplay(Number.isFinite(result) ? String(result) : "Error");
        setAcc(null);
        setOp(null);
        setFresh(true);
      }
      return;
    }
    if (["+", "-", "×", "÷"].includes(key)) {
      const current = Number(display);
      const next = op !== null && acc !== null && !fresh ? apply(acc, current, op) : current;
      setAcc(Number.isFinite(next) ? next : 0);
      setDisplay(Number.isFinite(next) ? String(next) : "Error");
      setOp(key as Op);
      setFresh(true);
      return;
    }
    if (key === "." && display.includes(".") && !fresh) return;
    setDisplay((d) => {
      if (fresh) return key === "." ? "0." : key;
      return d === "0" && key !== "." ? key : d + key;
    });
    setFresh(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs rounded-2xl">
        <DialogHeader>
          <DialogTitle>Calculator</DialogTitle>
        </DialogHeader>
        <output
          aria-live="polite"
          className="block truncate rounded-xl bg-secondary px-4 py-3 text-right font-display text-2xl font-bold tabular-nums text-secondary-foreground"
        >
          {display}
        </output>
        <div className="grid grid-cols-4 gap-2">
          {KEYS.map((key) => (
            <Button
              key={key}
              type="button"
              variant={
                ["÷", "×", "-", "+", "="].includes(key)
                  ? "default"
                  : ["C", "±", "%"].includes(key)
                    ? "secondary"
                    : "outline"
              }
              onClick={() => press(key)}
              className={key === "=" ? "tap-target col-span-2 rounded-xl" : "tap-target rounded-xl"}
            >
              {key}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}