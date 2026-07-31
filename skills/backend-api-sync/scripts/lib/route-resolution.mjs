import { readConfig } from './config.mjs';
import { parseJavaSpring } from './java-cst.mjs';

export function resolveConfiguredRoute(frontendRoot, route) {
  const config = readConfig(frontendRoot);
  const skippedProjects = config.projects.filter((project) => project.language !== 'java').map((project) => project.name);
  const candidates = config.projects
    .filter((project) => project.language === 'java')
    .flatMap((project) => {
      const contract = parseJavaSpring(project.path, route);
      return contract.matches.length ? [{ project: project.name, contract }] : [];
    });
  if (candidates.length === 1) return { status: 'unique', candidate: candidates[0] };
  if (candidates.length > 1) return { status: 'multiple', candidates };
  return {
    status: 'not_found',
    searchedProjects: config.projects.filter((project) => project.language === 'java').map((project) => project.name),
    skippedProjects,
  };
}
