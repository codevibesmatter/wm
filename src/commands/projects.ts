// kata projects - Multi-project management dispatcher
import { initManager } from './projects/init-manager.js'
import { listProjects } from './projects/list.js'
import { addProject } from './projects/add.js'
import { removeProject } from './projects/remove.js'
import { initProject } from './projects/init.js'
import { doctorProjects } from './projects/doctor.js'
import { upgradeProjects } from './projects/upgrade.js'
import { compareProjects } from './projects/compare.js'
import { syncProjects } from './projects/sync.js'
import { backupProjects } from './projects/backup.js'

const SUBCOMMANDS: Record<string, (args: string[]) => Promise<void>> = {
  'init-manager': initManager,
  list: listProjects,
  add: addProject,
  remove: removeProject,
  init: initProject,
  doctor: doctorProjects,
  upgrade: upgradeProjects,
  compare: compareProjects,
  sync: syncProjects,
  backup: backupProjects,
}

function printUsage(): void {
  // biome-ignore lint/suspicious/noConsole: CLI output
  console.error(`Usage: kata projects <subcommand> [options]

Subcommands:
  init-manager [--force]                    Initialize manager at ~/.kata/manager/
  list [--json] [--refresh]                 List registered projects
  add <path> [--alias=<name>]               Add a project to the registry
  remove <alias-or-path>                    Remove a project from the registry
  init <path> [--alias=<name>]              Initialize new project + register
  doctor [<project>] [--fix] [--json]       Health checks across projects
  upgrade [<project>] [--dry-run]           Bulk batteries update
  compare <a> <b> [--json]                  Compare config between projects
  sync <source> <target> [--dry-run]        Copy config between projects
  backup [<project>] [--list]               Backup/restore project config

Examples:
  kata projects init-manager
  kata projects list
  kata projects add /path/to/project --alias=myproj
  kata projects remove myproj
  kata projects init /path/to/new-project
  kata projects doctor
  kata projects upgrade --dry-run
`)
}

export async function projects(args: string[]): Promise<void> {
  const sub = args[0]
  const handler = sub ? SUBCOMMANDS[sub] : undefined

  if (!handler) {
    printUsage()
    process.exitCode = 1
    return
  }

  await handler(args.slice(1))
}
