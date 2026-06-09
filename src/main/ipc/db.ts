import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import {
  activeProject,
  getProjectSummary,
  projectsRepo,
  settingsRepo,
  wipeSession
} from '../services/database'
import { safe } from '../utils/result'

export function registerDbIpc(): void {
  ipcMain.handle(IPC.db.listProjects, () => safe('db.listProjects', () => projectsRepo.list()))

  ipcMain.handle(IPC.db.createProject, (_e, raw: unknown) =>
    safe('db.createProject', () => {
      if (typeof raw !== 'string') throw new Error('Project name must be a string')
      return projectsRepo.create(raw)
    })
  )

  ipcMain.handle(IPC.db.deleteProject, (_e, raw: unknown) =>
    safe('db.deleteProject', () => {
      if (typeof raw !== 'string') throw new Error('Project id must be a string')
      projectsRepo.delete(raw)
    })
  )

  ipcMain.handle(IPC.db.renameProject, (_e, id: unknown, name: unknown) =>
    safe('db.renameProject', () => {
      if (typeof id !== 'string') throw new Error('Project id must be a string')
      if (typeof name !== 'string') throw new Error('Project name must be a string')
      return projectsRepo.rename(id, name)
    })
  )

  ipcMain.handle(IPC.db.getActiveProject, () =>
    safe('db.getActiveProject', () => activeProject.get())
  )

  ipcMain.handle(IPC.db.setActiveProject, (_e, raw: unknown) =>
    safe('db.setActiveProject', () => {
      if (typeof raw !== 'string') throw new Error('Project id must be a string')
      activeProject.set(raw)
    })
  )

  ipcMain.handle(IPC.db.listSettings, () => safe('db.listSettings', () => settingsRepo.list()))

  ipcMain.handle(IPC.db.getSetting, (_e, raw: unknown) =>
    safe('db.getSetting', () => {
      if (typeof raw !== 'string') throw new Error('Setting key must be a string')
      return settingsRepo.get(raw)
    })
  )

  ipcMain.handle(IPC.db.setSetting, (_e, key: unknown, value: unknown) =>
    safe('db.setSetting', () => {
      if (typeof key !== 'string') throw new Error('Setting key must be a string')
      if (typeof value !== 'string') throw new Error('Setting value must be a string')
      settingsRepo.set(key, value)
    })
  )

  ipcMain.handle(IPC.db.getProjectSummary, (_e, raw: unknown) =>
    safe('db.getProjectSummary', () => {
      const projectId =
        typeof raw === 'string' && raw.length > 0 ? raw : activeProject.ensure().id
      return getProjectSummary(projectId)
    })
  )

  ipcMain.handle(IPC.db.wipeSession, (_e, raw: unknown) =>
    safe('db.wipeSession', () => {
      const projectId =
        typeof raw === 'string' && raw.length > 0 ? raw : activeProject.ensure().id
      wipeSession(projectId)
    })
  )
}
