import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortalHeader } from "@/components/PortalHeader";
import { ExamCard } from "@/components/exam/ExamCard";
import { StudentIdentityCard } from "@/components/student/StudentIdentityCard";
import { ExamInstructions } from "@/components/student/ExamInstructions";
import { CardSkeletonGrid, EmptyState, ErrorState } from "@/components/states";
import { NotConnectedState } from "@/components/ServiceState";
import { BackendNotConnectedError, examService, profileService } from "@/services";
import { EXAM_CONTEXT_LABELS, type ExamContext } from "@/lib/exam-types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Student Dashboard | College of Health CBT Portal" },
      {
        name: "description",
        content:
          "View available Regular, Pharmacy PreNational and Continuous computer-based tests and start your exam.",
      },
      { property: "og:title", content: "Student Dashboard | College of Health CBT Portal" },
      {
        property: "og:description",
        content: "Your available College of Health computer-based examinations at a glance.",
      },
    ],
  }),
  component: Dashboard,
});

type Filter = "all" | ExamContext;

const FILTERS: Filter[] = ["all", "regular", "pharmacy-prenational", "continuous"];

function Dashboard() {
  const [filter, setFilter] = useState<Filter>("all");
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => profileService.getMyProfile(),
    retry: false,
  });
  const exams = useQuery({
    queryKey: ["exams"],
    queryFn: () => examService.listExams(),
    retry: false,
  });

  const visible = useMemo(
    () =>
      (exams.data ?? []).filter((exam) => filter === "all" || exam.context === filter),
    [exams.data, filter],
  );

  return (
    <div className="min-h-screen bg-background">
      <PortalHeader
        actions={
          <Button asChild variant="outline" className="tap-target rounded-xl">
            <Link to="/auth">Sign in</Link>
          </Button>
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="animate-rise grid gap-5">
          <StudentIdentityCard profile={profile.data ?? null} loading={profile.isPending} />
          <ExamInstructions />
        </div>

        <section className="mt-8">
          <h2 className="font-display text-xl font-bold sm:text-2xl">Your exams</h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Everything scheduled for you, across all three examination contexts.
          </p>
        </section>

        <Tabs
          value={filter}
          onValueChange={(value) => setFilter(value as Filter)}
          className="mt-6"
        >
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl p-1 sm:w-auto">
            {FILTERS.map((value) => (
              <TabsTrigger
                key={value}
                value={value}
                className="tap-target rounded-lg px-3 text-xs sm:text-sm"
              >
                {value === "all" ? "All" : EXAM_CONTEXT_LABELS[value]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <section className="mt-6">
          {exams.isPending ? (
            <CardSkeletonGrid />
          ) : exams.isError ? (
            exams.error instanceof BackendNotConnectedError ? (
              <NotConnectedState
                operation={exams.error.message}
                description="Your papers will appear here as soon as the examination server is connected."
                onRetry={() => exams.refetch()}
              />
            ) : (
            <ErrorState
              title="Exams unavailable"
              description={
                exams.error instanceof Error
                  ? exams.error.message
                  : "We couldn't load your exams."
              }
              onRetry={() => exams.refetch()}
            />
            )
          ) : visible.length === 0 ? (
            <EmptyState
              title="No exams here yet"
              description="When your department schedules an assessment it will appear in this list."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((exam) => (
                <ExamCard key={exam.id} exam={exam} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
