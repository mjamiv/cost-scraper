import { lazy, Suspense } from 'react';
import { HealthScorecard } from '../components/HealthScorecard';
import { SCurveChart } from '../components/SCurveChart';
import { useAppStore } from '../store/appStore';
import { CostDataRowWithTags } from '../utils/wbsDataMerger';

const CostCharts = lazy(() => import('../components/CostCharts').then(m => ({ default: m.CostCharts })));
const SpendTrendChart = lazy(() => import('../components/ChatCharts').then(m => ({ default: m.SpendTrendChart })));
const EarnedValueChart = lazy(() => import('../components/ChatCharts').then(m => ({ default: m.EarnedValueChart })));
const ProjectComparisonChart = lazy(() => import('../components/ChatCharts').then(m => ({ default: m.ProjectComparisonChart })));
const BudgetPieChart = lazy(() => import('../components/ChatCharts').then(m => ({ default: m.BudgetPieChart })));
const VarianceChart = lazy(() => import('../components/ChatCharts').then(m => ({ default: m.VarianceChart })));
const ManhoursTrendChart = lazy(() => import('../components/ChatCharts').then(m => ({ default: m.ManhoursTrendChart })));
const FTETrendChart = lazy(() => import('../components/ChatCharts').then(m => ({ default: m.FTETrendChart })));
const DisciplineBreakdownChart = lazy(() => import('../components/ChatCharts').then(m => ({ default: m.DisciplineBreakdownChart })));
const DataTable = lazy(() => import('../components/DataTable').then(m => ({ default: m.DataTable })));

function WidgetLoading() {
  return (
    <div className="flex items-center justify-center h-full min-h-[120px]">
      <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export interface WidgetWrapperProps {
  data: CostDataRowWithTags[];
  isLoading: boolean;
}

export function HealthScorecardWidget() {
  const projectNumbers = useAppStore(s => s.filters.projectNumbers);
  const startMonth = useAppStore(s => s.filters.startMonth);
  return <HealthScorecard projectNumbers={projectNumbers} startMonth={startMonth} />;
}

export function SCurveWidget() {
  const projectNumbers = useAppStore(s => s.filters.projectNumbers);
  const startMonth = useAppStore(s => s.filters.startMonth);
  return <SCurveChart projectNumbers={projectNumbers} startMonth={startMonth} />;
}

export function CostChartsWidget({ data }: WidgetWrapperProps) {
  const activeFilters = useAppStore(s => s.filters.wbsTags);
  return (
    <Suspense fallback={<WidgetLoading />}>
      <CostCharts data={data} activeFilters={activeFilters} />
    </Suspense>
  );
}

export function SpendTrendWidget({ data }: WidgetWrapperProps) {
  return (
    <Suspense fallback={<WidgetLoading />}>
      <SpendTrendChart data={data} excludeCurrentMonth />
    </Suspense>
  );
}

export function EarnedValueWidget({ data }: WidgetWrapperProps) {
  return (
    <Suspense fallback={<WidgetLoading />}>
      <EarnedValueChart data={data} excludeCurrentMonth />
    </Suspense>
  );
}

export function ProjectComparisonWidget({ data }: WidgetWrapperProps) {
  return (
    <Suspense fallback={<WidgetLoading />}>
      <ProjectComparisonChart data={data} excludeCurrentMonth />
    </Suspense>
  );
}

export function BudgetPieWidget({ data }: WidgetWrapperProps) {
  return (
    <Suspense fallback={<WidgetLoading />}>
      <BudgetPieChart data={data} excludeCurrentMonth />
    </Suspense>
  );
}

export function VarianceWidget({ data }: WidgetWrapperProps) {
  return (
    <Suspense fallback={<WidgetLoading />}>
      <VarianceChart data={data} excludeCurrentMonth />
    </Suspense>
  );
}

export function ManhoursTrendWidget({ data }: WidgetWrapperProps) {
  return (
    <Suspense fallback={<WidgetLoading />}>
      <ManhoursTrendChart data={data} excludeCurrentMonth />
    </Suspense>
  );
}

export function FTETrendWidget({ data }: WidgetWrapperProps) {
  return (
    <Suspense fallback={<WidgetLoading />}>
      <FTETrendChart data={data} excludeCurrentMonth />
    </Suspense>
  );
}

export function DisciplineBreakdownWidget({ data }: WidgetWrapperProps) {
  return (
    <Suspense fallback={<WidgetLoading />}>
      <DisciplineBreakdownChart data={data} excludeCurrentMonth />
    </Suspense>
  );
}

export function DataTableWidget({ data, isLoading }: WidgetWrapperProps) {
  return (
    <Suspense fallback={<WidgetLoading />}>
      <DataTable data={data} isLoading={isLoading} />
    </Suspense>
  );
}

export const WIDGET_COMPONENTS: Record<string, React.ComponentType<WidgetWrapperProps>> = {
  'health-scorecard': HealthScorecardWidget as unknown as React.ComponentType<WidgetWrapperProps>,
  's-curve': SCurveWidget as unknown as React.ComponentType<WidgetWrapperProps>,
  'cost-charts': CostChartsWidget,
  'spend-trend': SpendTrendWidget,
  'earned-value': EarnedValueWidget,
  'project-comparison': ProjectComparisonWidget,
  'budget-pie': BudgetPieWidget,
  'variance': VarianceWidget,
  'manhours-trend': ManhoursTrendWidget,
  'fte-trend': FTETrendWidget,
  'discipline-breakdown': DisciplineBreakdownWidget,
  'data-table': DataTableWidget,
};
