export interface VFSNode {
  type: 'file' | 'dir';
  content?: string;
  children?: string[];
}

export type VFSTree = Record<string, VFSNode>;

export interface VFSInitResult {
  vfs: VFSTree;
  welcomeMessage: string;
}

export function buildVFSFromModules(): VFSInitResult {
  // Removed { dot: true } to fix Vite error
  const modules = import.meta.glob('/src/public_vfs/**/*', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;

  const vfs: VFSTree = {
    '/': { type: 'dir', children: [] },
  };

  let welcomeMessage = '';
  
  const ensureDir = (dirPath: string) => {
    if (!vfs[dirPath]) {
      vfs[dirPath] = { type: 'dir', children: [] };
    }
  };

  Object.entries(modules).forEach(([filePath, content]) => {
    const virtualPath = filePath.replace('/src/public_vfs', '');

    // 1. Capture welcome message from .welcome.txt or welcome.txt
    if (
      virtualPath === '/.welcome.txt' ||
      virtualPath === '/welcome.txt' ||
      virtualPath.endsWith('/.welcome.txt') ||
      virtualPath.endsWith('/welcome.txt')
    ) {
      welcomeMessage = content;
      return; // Do not list in terminal ls
    }

    const segments = virtualPath.split('/').filter(Boolean);

    // 2. Hide dotfiles from terminal directory tree
    if (segments.some((segment) => segment.startsWith('.'))) {
      return;
    }

    let currentPath = '';

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      const parentPath = currentPath === '' ? '/' : currentPath;
      currentPath = `${parentPath === '/' ? '' : parentPath}/${segment}`;

      const isFile = i === segments.length - 1;

      if (vfs[parentPath] && !vfs[parentPath].children?.includes(segment)) {
        vfs[parentPath].children?.push(segment);
      }

      if (isFile) {
        vfs[currentPath] = {
          type: 'file',
          content,
        };
      } else {
        ensureDir(currentPath);
      }
    }
  });

  return { vfs, welcomeMessage };
}