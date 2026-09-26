import { VFS } from './data/pages';

let pwd = '/';
let inViewerMode = false;

const terminalOutput = document.getElementById('terminal-output')!;
const commandInput = document.getElementById('command-input') as HTMLInputElement;
const promptEl = document.getElementById('prompt')!;
const viewerContainer = document.getElementById('viewer-container')!;
const viewerContent = document.getElementById('viewer-content')!;
const terminalContainer = document.getElementById('terminal-container')!;

function print(text: string) {
  const line = document.createElement('div');
  line.textContent = text;
  terminalOutput.appendChild(line);
  
  // Auto-scroll the container to the bottom so the prompt stays visible
  terminalContainer.scrollTop = terminalContainer.scrollHeight;
}

function updatePrompt() {
  promptEl.textContent = `user@portfolio:${pwd}$ `;
}

function resolvePath(target: string): string {
  if (target === '/') return '/';
  if (target.startsWith('/')) return target;
  return pwd === '/' ? `/${target}` : `${pwd}/${target}`;
}

function openViewer(content: string) {
  inViewerMode = true;
  viewerContent.innerHTML = content;
  viewerContainer.classList.remove('hidden');
}

function closeViewer() {
  inViewerMode = false;
  viewerContainer.classList.add('hidden');
  commandInput.focus();
}

// Shell Input Listener
commandInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const rawInput = commandInput.value.trim();
    commandInput.value = '';

    if (!rawInput) return;

    print(`${promptEl.textContent}${rawInput}`);

    const parts = rawInput.split(' ');
    const cmd = parts[0];
    const arg = parts[1] || '';

    if (cmd === 'pwd') {
      print(pwd);
    } else if (cmd === 'ls') {
      const node = VFS[pwd];
      if (node && node.type === 'dir' && node.children) {
        print(node.children.join('  '));
      }
    } else if (cmd === 'cd') {
      if (!arg || arg === '~') {
        pwd = '/';
      } else if (arg === '..') {
        if (pwd !== '/') {
          const parts = pwd.split('/').filter(Boolean);
          parts.pop();
          pwd = parts.length === 0 ? '/' : '/' + parts.join('/');
        }
      } else {
        const targetPath = resolvePath(arg);
        const node = VFS[targetPath];
        if (node && node.type === 'dir') {
          pwd = targetPath;
        } else {
          print(`cd: no such directory: ${arg}`);
        }
      }
      updatePrompt();
    } else if (cmd === 'show') {
      const targetPath = arg ? resolvePath(arg) : pwd;
      const node = VFS[targetPath];

      if (node && node.type === 'file' && node.content) {
        openViewer(node.content);
      } else {
        print(`show: cannot view path '${arg || pwd}'`);
      }
    } else {
      print(`command not found: ${cmd}`);
    }
  }

  terminalContainer.scrollTop = terminalContainer.scrollHeight;
});

// Exit Listener for Vim / Nano Mode
window.addEventListener('keydown', (e) => {
  if (!inViewerMode) return;

  // Ctrl+X to exit
  if (e.ctrlKey && e.key.toLowerCase() === 'x') {
    e.preventDefault();
    closeViewer();
  }
  
  // Vim-style :q exit sequence
  if (e.key === 'q') {
    closeViewer();
  }
});