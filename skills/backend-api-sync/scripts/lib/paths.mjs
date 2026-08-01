import fs from 'node:fs';
import path from 'node:path';

export function getRuntimePaths(projectRoot) {
  const root = path.resolve(projectRoot);
  const runtimeDir = path.join(root, '.rico-skill');

  return {
    runtimeDir,
    configPath: path.join(runtimeDir, 'backend-api-sync.config'),
  };
}

export function isAbsoluteExistingDirectory(directory) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory)) {
    return false;
  }

  try {
    return fs.statSync(directory).isDirectory();
  } catch {
    return false;
  }
}
