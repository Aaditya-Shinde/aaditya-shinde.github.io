export const VFS: Record<string, { type: 'file' | 'dir'; content?: string; children?: string[] }> = {
  '/': { type: 'dir', children: ['about.txt', 'projects'] },
  '/about.txt': { type: 'file', content: '<h1>About Me</h1><p>Welcome to my portfolio!</p>' },
  '/projects': { type: 'dir', children: ['project1.txt'] },
  '/projects/project1.txt': { type: 'file', content: '<h1>Project 1</h1><p>Details about project 1.</p>' }
};