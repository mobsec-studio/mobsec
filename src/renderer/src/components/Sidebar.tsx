import { motion } from 'framer-motion'
import {
  Cpu,
  FileCode2,
  FileSearch,
  LayoutDashboard,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Repeat,
  ScrollText,
  Settings2,
  Wrench,
  type LucideIcon
} from 'lucide-react'
import { useUIStore, type ToolId } from '@/stores/useUIStore'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

interface ToolDef {
  id: ToolId
  label: string
  icon: LucideIcon
  shortcut?: string
}

const TOOLS: ToolDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, shortcut: 'Ctrl+1' },
  { id: 'proxy', label: 'Proxy', icon: Network, shortcut: 'Ctrl+2' },
  { id: 'repeater', label: 'Repeater', icon: Repeat, shortcut: 'Ctrl+3' },
  { id: 'frida', label: 'Frida', icon: Cpu, shortcut: 'Ctrl+4' },
  { id: 'apk', label: 'APK Analyzer', icon: FileSearch, shortcut: 'Ctrl+5' },
  { id: 'jadx', label: 'JADX', icon: FileCode2, shortcut: 'Ctrl+6' },
  { id: 'logcat', label: 'Logcat', icon: ScrollText, shortcut: 'Ctrl+7' },
  { id: 'tools', label: 'Other Tools', icon: Wrench, shortcut: 'Ctrl+8' }
]

export function Sidebar(): JSX.Element {
  const activeTool = useUIStore((s) => s.activeTool)
  const setActiveTool = useUIStore((s) => s.setActiveTool)
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 60 : 220 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="flex h-full shrink-0 flex-col border-r border-border bg-surface/40 backdrop-blur"
    >
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {TOOLS.map((tool) => (
          <SidebarItem
            key={tool.id}
            tool={tool}
            collapsed={collapsed}
            active={activeTool === tool.id}
            onClick={() => setActiveTool(tool.id)}
          />
        ))}

        <div className="my-1 h-px bg-border" />

        <SidebarItem
          tool={{ id: 'settings', label: 'Settings', icon: Settings2, shortcut: 'Ctrl+,' }}
          collapsed={collapsed}
          active={activeTool === 'settings'}
          onClick={() => setActiveTool('settings')}
        />
      </nav>

      <button
        type="button"
        onClick={toggleSidebar}
        className={cn(
          'mx-2 mb-2 flex h-8 items-center gap-3 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground',
          collapsed ? 'justify-center' : 'justify-start'
        )}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-4 w-4" />
        ) : (
          <>
            <PanelLeftClose className="h-4 w-4" />
            <span>Collapse</span>
          </>
        )}
      </button>
    </motion.aside>
  )
}

interface SidebarItemProps {
  tool: ToolDef
  collapsed: boolean
  active: boolean
  onClick: () => void
}

function SidebarItem({ tool, collapsed, active, onClick }: SidebarItemProps): JSX.Element {
  const Icon = tool.icon
  const content = (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-sm transition-colors',
        active
          ? 'bg-surface-raised text-foreground shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.04)]'
          : 'text-muted-foreground hover:bg-surface-raised/60 hover:text-foreground',
        collapsed && 'justify-center'
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active-indicator"
          className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-full bg-primary shadow-[0_0_8px_0_hsl(var(--primary)/0.6)]"
        />
      )}
      <Icon
        className={cn(
          'h-4 w-4 shrink-0',
          active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
        )}
      />
      {!collapsed && (
        <>
          <span className="truncate">{tool.label}</span>
          {tool.shortcut && (
            <span className="ml-auto rounded border border-border bg-background/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/80">
              {tool.shortcut}
            </span>
          )}
        </>
      )}
    </button>
  )

  if (!collapsed) return content
  return (
    <Tooltip delayDuration={400}>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="right" className="flex items-center gap-2">
        <span>{tool.label}</span>
        {tool.shortcut && (
          <span className="rounded border border-border bg-background/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {tool.shortcut}
          </span>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
