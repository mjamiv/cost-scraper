import React, { useCallback, useMemo } from 'react';
import {
  ResponsiveGridLayout,
  useContainerWidth,
  verticalCompactor,
} from 'react-grid-layout';
import type { Layout, LayoutItem, ResponsiveLayouts } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useAppStore } from '../store/appStore';
import { DashboardToolbar } from './DashboardToolbar';
import { DashboardWidget } from './DashboardWidget';
import { WIDGET_COMPONENTS, WidgetWrapperProps } from './widgetWrappers';
import { CostDataRowWithTags } from '../utils/wbsDataMerger';

interface DashboardViewProps {
  data: CostDataRowWithTags[];
  isLoading: boolean;
}

export function DashboardView({ data, isLoading }: DashboardViewProps) {
  const widgets = useAppStore(s => s.dashboardWidgets);
  const layouts = useAppStore(s => s.dashboardLayouts);
  const locked = useAppStore(s => s.dashboardLocked);
  const setDashboardLayouts = useAppStore(s => s.setDashboardLayouts);
  const removeWidget = useAppStore(s => s.removeWidget);

  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 1200 });

  const onLayoutChange = useCallback((layout: Layout, allLayouts: ResponsiveLayouts) => {
    if (!locked) {
      setDashboardLayouts({
        lg: (allLayouts.lg || layout) as LayoutItem[],
        md: (allLayouts.md || []) as LayoutItem[],
        sm: (allLayouts.sm || []) as LayoutItem[],
      });
    }
  }, [locked, setDashboardLayouts]);

  const handleRemove = useCallback((id: string) => {
    removeWidget(id);
  }, [removeWidget]);

  const lgLayout = useMemo<LayoutItem[]>(() => layouts.lg || [], [layouts.lg]);
  const mdLayout = useMemo<LayoutItem[]>(() => {
    if (layouts.md && layouts.md.length > 0) return layouts.md;
    return lgLayout.map(l => ({ ...l, w: Math.min(l.w, 6), x: 0 }));
  }, [layouts.md, lgLayout]);
  const smLayout = useMemo<LayoutItem[]>(() => {
    if (layouts.sm && layouts.sm.length > 0) return layouts.sm;
    return lgLayout.map(l => ({ ...l, w: 1, x: 0 }));
  }, [layouts.sm, lgLayout]);

  const responsiveLayouts = useMemo<ResponsiveLayouts>(() => ({
    lg: lgLayout,
    md: mdLayout,
    sm: smLayout,
  }), [lgLayout, mdLayout, smLayout]);

  const wrapperProps: WidgetWrapperProps = { data, isLoading };

  if (widgets.length === 0) {
    return (
      <div className="dashboard-view">
        <DashboardToolbar />
        <div className="dashboard-empty">
          <svg className="w-12 h-12 text-neutral-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
          <p className="text-neutral-400">No widgets added. Select a preset or add widgets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-view">
      <DashboardToolbar />
      <div className="dashboard-grid-container" ref={containerRef as React.RefObject<HTMLDivElement>}>
        {mounted && (
          <ResponsiveGridLayout
            className="dashboard-grid"
            width={width}
            layouts={responsiveLayouts}
            breakpoints={{ lg: 1200, md: 768, sm: 0 }}
            cols={{ lg: 12, md: 6, sm: 1 }}
            rowHeight={80}
            dragConfig={{ enabled: !locked, handle: '.dashboard-widget-drag-handle' }}
            resizeConfig={{ enabled: !locked }}
            compactor={verticalCompactor}
            margin={[12, 12] as const}
            containerPadding={[16, 16] as const}
            onLayoutChange={onLayoutChange}
          >
            {widgets.map((widgetId) => {
              const WidgetComponent = WIDGET_COMPONENTS[widgetId];
              if (!WidgetComponent) return null;

              return (
                <div key={widgetId}>
                  <DashboardWidget
                    widgetId={widgetId}
                    locked={locked}
                    onRemove={handleRemove}
                  >
                    <WidgetComponent {...wrapperProps} />
                  </DashboardWidget>
                </div>
              );
            })}
          </ResponsiveGridLayout>
        )}
      </div>
    </div>
  );
}
