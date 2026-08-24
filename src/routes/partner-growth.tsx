import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  LogOut,
  Plus,
  ShieldAlert,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createPartnerGrowthTask,
  loadPartnerGrowthDashboard,
  loadPartnerGrowthPortfolio,
  loadPartnerGrowthPriorityAlerts,
  loadPartnerGrowthTasks,
  sortPartnerGrowthTasks,
  updatePartnerGrowthTaskStatus,
  type CreatePartnerGrowthTaskInput,
  type PartnerGrowthAccessState,
  type PartnerGrowthAssignment,
  type PartnerGrowthDashboard,
  type PartnerGrowthPriorityAlert,
  type PartnerGrowthTask,
  type PartnerGrowthTaskPriority,
  type PartnerGrowthTaskSourceSignal,
  type PartnerGrowthTaskStatus,
} from "@/lib/partner-growth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/partner-growth")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({
        to: "/auth",
        search: { mode: undefined } as { mode: string | undefined },
      });
    }

    const portfolio = await loadPartnerGrowthPortfolio(data.user.id);
    return { user: data.user, portfolio };
  },
  component: PartnerGrowthPage,
});

function PartnerGrowthPage() {
  const { user, portfolio } = Route.useRouteContext() as {
    user: { id: string; email?: string };
    portfolio: {
      access: PartnerGrowthAccessState;
      assignments: PartnerGrowthAssignment[];
    };
  };
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<PartnerGrowthDashboard | null>(null);
  const [priorityAlerts, setPriorityAlerts] = useState<PartnerGrowthPriorityAlert[]>([]);
  const [tasks, setTasks] = useState<PartnerGrowthTask[]>([]);
  const [isLoading, setIsLoading] = useState(portfolio.access === "allowed");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (portfolio.access !== "allowed") {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    Promise.all([loadPartnerGrowthDashboard(), loadPartnerGrowthPriorityAlerts(), loadPartnerGrowthTasks()])
      .then(([dashboardData, alertsData, tasksData]) => {
        if (!cancelled) {
          setDashboard(dashboardData);
          setPriorityAlerts(alertsData);
          setTasks(tasksData);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("Nao foi possivel carregar os dados agregados e prioridades da carteira.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [portfolio.access]);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({
      to: "/auth",
      replace: true,
      search: { mode: undefined } as { mode: string | undefined },
    });
  }

  async function handleCreateTask(input: CreatePartnerGrowthTaskInput) {
    const created = await createPartnerGrowthTask(input, user.id);
    setTasks((current) => sortPartnerGrowthTasks([created, ...current]));
  }

  async function handleUpdateTaskStatus(taskId: string, status: PartnerGrowthTaskStatus) {
    const updated = await updatePartnerGrowthTaskStatus(taskId, status);
    setTasks((current) =>
      sortPartnerGrowthTasks(current.map((task) => (task.id === taskId ? updated : task))),
    );
  }

  if (portfolio.access === "forbidden") {
    return (
      <PartnerGrowthShell userEmail={user.email} onLogout={handleLogout}>
        <ControlledState
          title="Acesso negado"
          description="Seu usuario nao possui o role partner_growth."
        />
      </PartnerGrowthShell>
    );
  }

  if (portfolio.access === "no_active_assignment") {
    return (
      <PartnerGrowthShell userEmail={user.email} onLogout={handleLogout}>
        <ControlledState
          title="Sem carteira"
          description="Sua carteira ainda nao possui parceiros ativos atribuidos."
        />
      </PartnerGrowthShell>
    );
  }

  return (
    <PartnerGrowthShell userEmail={user.email} onLogout={handleLogout}>
      {isLoading && <LoadingDashboard />}
      {!isLoading && loadError && <DashboardError message={loadError} />}
      {!isLoading && !loadError && dashboard && dashboard.restaurants.length === 0 && (
        <ControlledState
          title="Sem carteira"
          description="Nenhum parceiro ativo foi retornado para sua carteira."
        />
      )}
      {!isLoading && !loadError && dashboard && dashboard.restaurants.length > 0 && (
        <DashboardContent
          dashboard={dashboard}
          priorityAlerts={priorityAlerts}
          tasks={tasks}
          assignments={portfolio.assignments}
          onCreateTask={handleCreateTask}
          onUpdateTaskStatus={handleUpdateTaskStatus}
        />
      )}
    </PartnerGrowthShell>
  );
}

function DashboardContent({
  dashboard,
  priorityAlerts,
  tasks,
  assignments,
  onCreateTask,
  onUpdateTaskStatus,
}: {
  dashboard: PartnerGrowthDashboard;
  priorityAlerts: PartnerGrowthPriorityAlert[];
  tasks: PartnerGrowthTask[];
  assignments: PartnerGrowthAssignment[];
  onCreateTask: (input: CreatePartnerGrowthTaskInput) => Promise<void>;
  onUpdateTaskStatus: (taskId: string, status: PartnerGrowthTaskStatus) => Promise<void>;
}) {
  const restaurants = assignments
    .filter((assignment) => assignment.active && assignment.restaurant)
    .map((assignment) => ({
      id: assignment.restaurantId,
      name: assignment.restaurant?.name ?? "Restaurante indisponivel",
    }));
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [isSavingTask, setIsSavingTask] = useState(false);

  function openManualTask() {
    setTaskError(null);
    setTaskDraft({
      restaurantId: restaurants[0]?.id ?? "",
      sourceSignal: null,
      title: "",
      priority: "MEDIA",
      dueDate: "",
      notes: "",
    });
  }

  function openAlertTask(alert: PartnerGrowthPriorityAlert) {
    setTaskError(null);
    setTaskDraft({
      restaurantId: alert.restaurantId,
      sourceSignal: alert.signal === "BAIXA_RECORRENCIA" ? null : alert.signal,
      title: alert.suggestedAction,
      priority: alert.priority,
      dueDate: "",
      notes: "",
    });
  }

  async function submitTask() {
    if (!taskDraft) return;
    if (!taskDraft.restaurantId || taskDraft.title.trim().length === 0) {
      setTaskError("Informe restaurante e titulo.");
      return;
    }

    setIsSavingTask(true);
    setTaskError(null);

    try {
      await onCreateTask({
        restaurantId: taskDraft.restaurantId,
        sourceSignal: taskDraft.sourceSignal,
        title: taskDraft.title.trim(),
        notes: taskDraft.notes.trim() ? taskDraft.notes.trim() : null,
        priority: taskDraft.priority,
        dueAt: taskDraft.dueDate ? new Date(`${taskDraft.dueDate}T23:59:00`).toISOString() : null,
      });
      setTaskDraft(null);
    } catch {
      setTaskError("Nao foi possivel salvar a tarefa.");
    } finally {
      setIsSavingTask(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={openManualTask}>
          <Plus className="h-4 w-4" />
          Nova tarefa
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={<BriefcaseBusiness className="h-4 w-4" />}
          label="Parceiros ativos"
          value={dashboard.summary.partnersCount}
        />
        <SummaryCard
          icon={<ShoppingBag className="h-4 w-4" />}
          label="Pedidos no mes"
          value={dashboard.summary.currentMonthOrders}
          detail={`${dashboard.summary.previousPeriodOrders} no periodo anterior`}
        />
        <SummaryCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Variacao"
          value={formatVariation(dashboard.summary.variationPercent)}
        />
        <SummaryCard
          icon={<CalendarDays className="h-4 w-4" />}
          label="Sem venda 7 dias"
          value={dashboard.summary.partnersWithoutSale7d}
        />
        <SummaryCard
          icon={<Users className="h-4 w-4" />}
          label="Clientes com compra"
          value={dashboard.summary.customersWithRealizedSale}
        />
        <SummaryCard
          icon={<Users className="h-4 w-4" />}
          label="Clientes recorrentes"
          value={dashboard.summary.recurringCustomers}
        />
        <SummaryCard
          icon={<Users className="h-4 w-4" />}
          label="Inativos 30+"
          value={dashboard.summary.inactive30dCustomers}
        />
      </div>

      <PriorityAlertsSection alerts={priorityAlerts} onCreateTask={openAlertTask} />

      <TasksSection tasks={tasks} onUpdateStatus={onUpdateTaskStatus} />

      <Card className="rounded-lg shadow-sm">
        <CardHeader className="gap-1">
          <CardTitle>Carteira</CardTitle>
          <p className="text-sm text-muted-foreground">
            Periodo atual: {formatDate(dashboard.period.currentStart)} ate{" "}
            {formatDate(dashboard.period.currentEnd)}.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parceiro</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="text-right">Variacao</TableHead>
                <TableHead>Ultima venda</TableHead>
                <TableHead className="text-right">Recorrentes</TableHead>
                <TableHead className="text-right">Inativos 30+</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboard.restaurants.map((restaurant) => (
                <TableRow key={restaurant.restaurantId}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{restaurant.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {restaurant.restaurantId}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-medium">{restaurant.currentPeriodOrders}</div>
                    <div className="text-xs text-muted-foreground">
                      {restaurant.previousPeriodOrders} anterior
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <VariationBadge value={restaurant.variationPercent} />
                  </TableCell>
                  <TableCell>{formatDate(restaurant.lastRealizedSaleAt)}</TableCell>
                  <TableCell className="text-right">{restaurant.recurringCustomers}</TableCell>
                  <TableCell className="text-right">{restaurant.inactive30dCustomers}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TaskDialog
        draft={taskDraft}
        restaurants={restaurants}
        tasks={tasks}
        isSaving={isSavingTask}
        error={taskError}
        onChange={setTaskDraft}
        onClose={() => setTaskDraft(null)}
        onSubmit={submitTask}
      />
    </div>
  );
}

type TaskDraft = {
  restaurantId: string;
  sourceSignal: PartnerGrowthTaskSourceSignal | null;
  title: string;
  priority: PartnerGrowthTaskPriority;
  dueDate: string;
  notes: string;
};

function PriorityAlertsSection({
  alerts,
  onCreateTask,
}: {
  alerts: PartnerGrowthPriorityAlert[];
  onCreateTask: (alert: PartnerGrowthPriorityAlert) => void;
}) {
  const hasOnlyOpportunities =
    alerts.length > 0 && alerts.every((alert) => alert.type === "OPORTUNIDADE");

  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader className="gap-1">
        <CardTitle>Prioridades da carteira</CardTitle>
        {alerts.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Carteira sem alertas provados pelos dados atuais.
          </p>
        )}
        {hasOnlyOpportunities && (
          <p className="text-sm text-muted-foreground">
            Somente oportunidades foram identificadas para esta carteira.
          </p>
        )}
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            Nenhuma prioridade operacional no momento.
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={`${alert.restaurantId}-${alert.signal}`}
                className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{alert.restaurantName}</p>
                    <PriorityBadge alert={alert} />
                  </div>
                  <p className="text-sm text-slate-700">{alert.reason}</p>
                  <p className="text-sm text-muted-foreground">{alert.suggestedAction}</p>
                </div>
                <div className="flex items-start gap-2 md:flex-col md:items-end">
                  <div className="text-xs font-medium text-muted-foreground">
                    {formatSignal(alert.signal)}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => onCreateTask(alert)}>
                    <ClipboardList className="h-4 w-4" />
                    Criar tarefa
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TasksSection({
  tasks,
  onUpdateStatus,
}: {
  tasks: PartnerGrowthTask[];
  onUpdateStatus: (taskId: string, status: PartnerGrowthTaskStatus) => Promise<void>;
}) {
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  async function updateStatus(taskId: string, status: PartnerGrowthTaskStatus) {
    setUpdatingTaskId(taskId);
    try {
      await onUpdateStatus(taskId, status);
    } finally {
      setUpdatingTaskId(null);
    }
  }

  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader className="gap-1">
        <CardTitle>Minhas tarefas</CardTitle>
        {tasks.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma tarefa manual criada.</p>
        )}
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <ClipboardList className="h-4 w-4" />
            Carteira sem tarefas no momento.
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="grid gap-3 rounded-lg border bg-white p-4 lg:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{task.title}</p>
                    <Badge variant={task.status === "CONCLUIDA" ? "secondary" : "outline"}>
                      {formatTaskStatus(task.status)}
                    </Badge>
                    <TaskPriorityBadge priority={task.priority} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>{task.restaurantName}</span>
                    <span>Prazo: {formatDueDate(task.dueAt)}</span>
                    {task.sourceSignal && <span>Origem: {formatSignal(task.sourceSignal)}</span>}
                  </div>
                </div>
                <TaskActions
                  task={task}
                  disabled={updatingTaskId === task.id}
                  onUpdateStatus={updateStatus}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TaskDialog({
  draft,
  restaurants,
  tasks,
  isSaving,
  error,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: TaskDraft | null;
  restaurants: Array<{ id: string; name: string }>;
  tasks: PartnerGrowthTask[];
  isSaving: boolean;
  error: string | null;
  onChange: (draft: TaskDraft | null) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const duplicateOpenTask = Boolean(
    draft?.sourceSignal &&
      tasks.some(
        (task) =>
          task.restaurantId === draft.restaurantId &&
          task.sourceSignal === draft.sourceSignal &&
          (task.status === "PENDENTE" || task.status === "EM_ANDAMENTO"),
      ),
  );

  return (
    <Dialog open={!!draft} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{draft?.sourceSignal ? "Criar tarefa do alerta" : "Nova tarefa"}</DialogTitle>
        </DialogHeader>
        {draft && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Restaurante</label>
              <Select
                value={draft.restaurantId}
                onValueChange={(restaurantId) => onChange({ ...draft, restaurantId })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {restaurants.map((restaurant) => (
                    <SelectItem key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Titulo</label>
              <Input
                maxLength={160}
                value={draft.title}
                onChange={(event) => onChange({ ...draft, title: event.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Prioridade</label>
                <Select
                  value={draft.priority}
                  onValueChange={(priority: PartnerGrowthTaskPriority) =>
                    onChange({ ...draft, priority })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALTA">Alta</SelectItem>
                    <SelectItem value="MEDIA">Media</SelectItem>
                    <SelectItem value="BAIXA">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Prazo opcional</label>
                <Input
                  type="date"
                  value={draft.dueDate}
                  onChange={(event) => onChange({ ...draft, dueDate: event.target.value })}
                />
              </div>
            </div>
            {draft.sourceSignal && (
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-muted-foreground">
                Origem: {formatSignal(draft.sourceSignal)}
              </div>
            )}
            {duplicateOpenTask && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Tarefa aberta existente</AlertTitle>
                <AlertDescription>
                  Ja existe uma tarefa aberta para este restaurante e sinal.
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Observacao opcional</label>
              <Textarea
                maxLength={1000}
                rows={4}
                value={draft.notes}
                onChange={(event) => onChange({ ...draft, notes: event.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Nao inclua dados pessoais de clientes nas observacoes.
              </p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={isSaving || !draft}>
            Confirmar e salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskActions({
  task,
  disabled,
  onUpdateStatus,
}: {
  task: PartnerGrowthTask;
  disabled: boolean;
  onUpdateStatus: (taskId: string, status: PartnerGrowthTaskStatus) => Promise<void>;
}) {
  if (task.status === "CONCLUIDA" || task.status === "DESCARTADA") {
    return (
      <div className="flex items-center justify-end text-sm text-muted-foreground">
        Sem novas transicoes
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-start justify-end gap-2">
      {task.status === "PENDENTE" && (
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onUpdateStatus(task.id, "EM_ANDAMENTO")}
        >
          Iniciar
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => onUpdateStatus(task.id, "CONCLUIDA")}
      >
        Concluir
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => onUpdateStatus(task.id, "DESCARTADA")}
      >
        Descartar
      </Button>
    </div>
  );
}

function TaskPriorityBadge({ priority }: { priority: PartnerGrowthTaskPriority }) {
  if (priority === "ALTA") {
    return <Badge variant="destructive">Alta</Badge>;
  }

  if (priority === "MEDIA") {
    return <Badge variant="default">Media</Badge>;
  }

  return <Badge variant="outline">Baixa</Badge>;
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  detail?: string;
}) {
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{value}</div>
        {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}

function VariationBadge({ value }: { value: number | null }) {
  if (value === null) {
    return <Badge variant="secondary">Sem base</Badge>;
  }

  return (
    <Badge variant={value >= 0 ? "default" : "destructive"}>
      {formatVariation(value)}
    </Badge>
  );
}

function PriorityBadge({ alert }: { alert: PartnerGrowthPriorityAlert }) {
  if (alert.type === "OPORTUNIDADE") {
    return <Badge variant="secondary">Oportunidade</Badge>;
  }

  if (alert.priority === "ALTA") {
    return <Badge variant="destructive">Alta</Badge>;
  }

  if (alert.priority === "MEDIA") {
    return <Badge variant="default">Media</Badge>;
  }

  return <Badge variant="outline">Baixa</Badge>;
}

function LoadingDashboard() {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4" aria-label="Carregando">
      {Array.from({ length: 7 }).map((_, index) => (
        <Card key={index} className="rounded-lg shadow-sm">
          <CardHeader>
            <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
          </CardHeader>
          <CardContent>
            <div className="h-9 w-16 animate-pulse rounded bg-slate-200" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DashboardError({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Erro controlado</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function PartnerGrowthShell({
  userEmail,
  onLogout,
  children,
}: {
  userEmail?: string;
  onLogout: () => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-950 text-white">
              <BriefcaseBusiness className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold">Partner Growth</h1>
              {userEmail && <p className="truncate text-xs text-muted-foreground">{userEmail}</p>}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

function ControlledState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[55vh] items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100">
          <ShieldAlert className="h-6 w-6 text-slate-700" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function formatVariation(value: number | null) {
  if (value === null) return "Sem base";
  return `${value > 0 ? "+" : ""}${value.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  })}%`;
}

function formatTaskStatus(status: PartnerGrowthTaskStatus) {
  const labels: Record<PartnerGrowthTaskStatus, string> = {
    PENDENTE: "Pendente",
    EM_ANDAMENTO: "Em andamento",
    CONCLUIDA: "Concluida",
    DESCARTADA: "Descartada",
  };

  return labels[status];
}

function formatDueDate(value: string | null) {
  if (!value) return "Sem prazo";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatSignal(signal: PartnerGrowthPriorityAlert["signal"]) {
  const labels: Record<PartnerGrowthPriorityAlert["signal"], string> = {
    SEM_VENDA_7D: "Sem venda 7d",
    QUEDA_PEDIDOS: "Queda pedidos",
    CLIENTES_INATIVOS_30D: "Inativos 30+",
    BAIXA_RECORRENCIA: "Baixa recorrencia",
    BOA_EVOLUCAO: "Boa evolucao",
  };

  return labels[signal];
}

function formatDate(value: string | null) {
  if (!value) return "Sem venda";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}
