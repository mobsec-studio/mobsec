import { motion, AnimatePresence } from 'framer-motion'
import { FileDown, Package, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useEmulatorStore } from '@/stores/useEmulatorStore'
import { toast } from 'sonner'

/**
 * Window-level drag-and-drop handler for APK installation.
 *
 * Listens on the document for drag events; while a file is hovering we render
 * a full-screen overlay describing the drop target. On drop we resolve the
 * absolute path via `window.api.app.getFilePath(file)` (using Electron's
 * `webUtils.getPathForFile` under the hood), validate the extension, and
 * push it through `emulator.installApk`.
 */
export function ApkDropZone(): JSX.Element {
  const [dragging, setDragging] = useState(false)
  const status = useEmulatorStore((s) => s.status)
  const emulatorRunning = status.state === 'running'

  useEffect(() => {
    let depth = 0

    function onDragEnter(e: DragEvent): void {
      // Ignore drags that aren't carrying files.
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return
      e.preventDefault()
      depth += 1
      setDragging(true)
    }

    function onDragOver(e: DragEvent): void {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return
      e.preventDefault()
      e.dataTransfer.dropEffect = emulatorRunning ? 'copy' : 'none'
    }

    function onDragLeave(e: DragEvent): void {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return
      e.preventDefault()
      depth -= 1
      if (depth <= 0) {
        depth = 0
        setDragging(false)
      }
    }

    async function onDrop(e: DragEvent): Promise<void> {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return
      e.preventDefault()
      depth = 0
      setDragging(false)

      if (!emulatorRunning) {
        toast.warning('Emulator not running', {
          description: 'Start the emulator before installing an APK.'
        })
        return
      }

      const files = Array.from(e.dataTransfer.files)
      const apks = files.filter((f) => f.name.toLowerCase().endsWith('.apk'))
      if (apks.length === 0) {
        toast.error('No APK in drop', {
          description: 'Drop a .apk file to install it on the emulator.'
        })
        return
      }

      for (const file of apks) {
        const filePath = window.api.app.getFilePath(file)
        if (!filePath) {
          toast.error(`Could not resolve path for ${file.name}`)
          continue
        }
        const id = toast.loading(`Installing ${file.name}…`)
        const res = await window.api.emulator.installApk(filePath)
        if (res.ok) {
          toast.success(`Installed ${res.value.packageName}`, { id })
        } else {
          toast.error(`Install failed: ${file.name}`, {
            id,
            description: res.error
          })
        }
      }
    }

    const onDropWrapped = (e: DragEvent): void => {
      void onDrop(e)
    }

    document.addEventListener('dragenter', onDragEnter)
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('dragleave', onDragLeave)
    document.addEventListener('drop', onDropWrapped)
    return () => {
      document.removeEventListener('dragenter', onDragEnter)
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('dragleave', onDragLeave)
      document.removeEventListener('drop', onDropWrapped)
    }
  }, [emulatorRunning])

  return (
    <AnimatePresence>
      {dragging && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center"
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />
          <motion.div
            initial={{ scale: 0.96 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.96 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="relative flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-primary/60 bg-surface-overlay/80 px-12 py-10 shadow-[0_0_40px_-6px_hsl(var(--primary)/0.6)]"
          >
            <div className="relative">
              <Package className="h-14 w-14 text-primary" strokeWidth={1.25} />
              <FileDown className="absolute -bottom-2 -right-3 h-7 w-7 text-primary" />
            </div>
            <div className="space-y-1 text-center">
              <div className="text-base font-semibold tracking-tight">Drop APK to install</div>
              {emulatorRunning ? (
                <div className="text-xs text-muted-foreground">
                  Will be installed via <span className="font-mono">adb install</span> on the running emulator.
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-warning">
                  <Smartphone className="h-3.5 w-3.5" /> Start the emulator first
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
