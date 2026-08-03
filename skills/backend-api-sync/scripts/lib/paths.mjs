import fs from 'node:fs';
import path from 'node:path';

export function getRuntimePaths(projectRoot) {
  const root = path.resolve(projectRoot);
  const runtimeDir = path.join(root, '.rico-skill');
  const configDir = path.join(runtimeDir, 'backend-api-sync');

  return {
    runtimeDir,
    configDir,
    configPath: path.join(configDir, 'config.json'),
    rulesPath: path.join(runtimeDir, 'api-typescript-style.md'),
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
