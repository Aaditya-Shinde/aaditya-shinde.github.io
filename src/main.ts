import { buildVFSFromModules } from './core/vfsLoader';
import type { VFSTree } from './core/vfsLoader';

// Initialize the Virtual File System and load the welcome message
const { vfs: VFS, welcomeMessage } = buildVFSFromModules();

let pwd = '/';
let inViewerMode = false;

// Command History State
const commandHistory: string[] = [];
let historyIndex = -1;

const terminalContainer = document.getElementById('terminal-container')!;
const terminalOutput = document.getElementById('terminal-output')!;
const commandInput = document.getElementById('command-input') as HTMLInputElement;
const promptPathEl = document.getElementById('prompt-path')!;
const viewerContainer = document.getElementById('viewer-container')!;
const viewerContent = document.getElementById('viewer-content')!;
const viewerFilename = document.getElementById('viewer-filename')!;
const viewerStatus = document.getElementById('viewer-status')!;
const viewerContentWrapper = document.getElementById('viewer-content-wrapper')!;

const AVAILABLE_COMMANDS = ['ls', 'cd', 'pwd', 'show', 'clear'];

function getFormattedPath(): string {
  return pwd === '/' ? '~' : pwd;
}

function updatePrompt() {
  promptPathEl.textContent = getFormattedPath();
}

function printText(text: string) {
  const line = document.createElement('div');
  line.textContent = text;
  terminalOutput.appendChild(line);
  terminalContainer.scrollTop = terminalContainer.scrollHeight;
}

function printHTML(htmlString: string) {
  const line = document.createElement('div');
  line.innerHTML = htmlString;
  terminalOutput.appendChild(line);
  terminalContainer.scrollTop = terminalContainer.scrollHeight;
}

function printExecutedCommand(cmdText: string) {
  const path = getFormattedPath();
  const html = `<span class="prompt-user">user@raspberrypi</span><span class="prompt-colon">:</span><span class="prompt-path">${path}</span><span class="prompt-symbol">$ </span>${cmdText}`;
  printHTML(html);
}

function resolvePath(target: string): string {
  if (!target || target === '.' || target === './') return pwd;
  if (target === '/' || target === '~') return '/';

  let path = target.startsWith('/') ? target : pwd === '/' ? `/${target}` : `${pwd}/${target}`;

  // Normalize path segments (handles .. and .)
  const parts = path.split('/').filter(Boolean);
  const stack: string[] = [];

  for (const part of parts) {
    if (part === '..') {
      stack.pop();
    } else if (part !== '.') {
      stack.push(part);
    }
  }

  return '/' + stack.join('/');
}

function openViewer(content: string, filename: string) {
  inViewerMode = true;
  commandInput.blur(); // Remove focus from terminal input field
  viewerContent.innerHTML = content;
  viewerFilename.textContent = `File: ${filename}`;
  viewerStatus.textContent = ''; // Clear status on load
  viewerContainer.classList.remove('hidden');
}

function closeViewer() {
  inViewerMode = false;
  viewerContainer.classList.add('hidden');
  commandInput.focus(); // Refocus terminal input field
}

// Display welcome banner immediately on terminal startup
if (welcomeMessage) {
  printText(welcomeMessage);
} else {
  console.warn('Welcome message file was not found or was empty.');
}

// Autocomplete Helper Logic
function handleTabAutocomplete() {
  const inputVal = commandInput.value;
  const parts = inputVal.split(' ');

  // 1. Autocomplete initial command (e.g., "sh" -> "show")
  if (parts.length === 1) {
    const query = parts[0];
    const matches = AVAILABLE_COMMANDS.filter((cmd) => cmd.startsWith(query));

    if (matches.length === 1) {
      commandInput.value = `${matches[0]} `;
    } else if (matches.length > 1) {
      printExecutedCommand(inputVal);
      printText(matches.join('  '));
    }
    return;
  }

  // 2. Autocomplete file/directory arguments for commands
  if (parts.length >= 2) {
    const cmd = parts[0];
    const rawArg = parts[1];
    const lastSlash = rawArg.lastIndexOf('/');

    let searchDir = pwd;
    let query = rawArg;

    if (lastSlash !== -1) {
      searchDir = resolvePath(rawArg.substring(0, lastSlash));
      query = rawArg.substring(lastSlash + 1);
    }

    const currentNode = VFS[searchDir];

    if (currentNode && currentNode.type === 'dir' && currentNode.children) {
      const matches = currentNode.children.filter((child) => child.startsWith(query));

      if (matches.length === 1) {
        const match = matches[0];
        const fullMatchPath = resolvePath(`${searchDir}/${match}`);
        const isDir = VFS[fullMatchPath]?.type === 'dir';
        const prefix = lastSlash !== -1 ? rawArg.substring(0, lastSlash + 1) : '';
        const suffix = isDir ? '/' : ' ';

        commandInput.value = `${cmd} ${prefix}${match}${suffix}`;
      } else if (matches.length > 1) {
        printExecutedCommand(inputVal);
        printText(matches.join('  '));
      }
    }
  }
}

// Click anywhere on the terminal to focus the input prompt
terminalContainer.addEventListener('click', () => {
  // Only focus if not in viewer mode and the user isn't actively highlighting text
  if (!inViewerMode && window.getSelection()?.toString() === '') {
    commandInput.focus();
  }
});

// Terminal Key Listener (Handles input, enter, up/down history, tab completion)
commandInput.addEventListener('keydown', (e) => {
  // CRITICAL: Ignore any input if viewer mode is active
  if (inViewerMode) {
    e.preventDefault();
    return;
  }

  if (e.key === 'Tab') {
    e.preventDefault();
    handleTabAutocomplete();
    return;
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (commandHistory.length === 0) return;

    if (historyIndex === -1) {
      historyIndex = commandHistory.length - 1;
    } else if (historyIndex > 0) {
      historyIndex--;
    }

    commandInput.value = commandHistory[historyIndex];
    setTimeout(() => {
      commandInput.selectionStart = commandInput.selectionEnd = commandInput.value.length;
    }, 0);
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (historyIndex === -1) return;

    if (historyIndex < commandHistory.length - 1) {
      historyIndex++;
      commandInput.value = commandHistory[historyIndex];
    } else {
      historyIndex = -1;
      commandInput.value = '';
    }
    return;
  }

  if (e.key === 'Enter') {
    const rawInput = commandInput.value.trim();
    commandInput.value = '';

    if (!rawInput) return;

    // Save to history and reset index pointer
    commandHistory.push(rawInput);
    historyIndex = -1;

    printExecutedCommand(rawInput);

    const parts = rawInput.split(' ');
    const cmd = parts[0];
    const arg = parts[1] || '';

    if (cmd === 'clear') {
      terminalOutput.innerHTML = '';
    } else if (cmd === 'pwd') {
      printText(pwd);
    } else if (cmd === 'ls') {
      // Resolve path argument if provided, default to current pwd
      const targetPath = arg ? resolvePath(arg) : pwd;
      const node = VFS[targetPath];

      if (node && node.type === 'dir' && node.children) {
        const formattedItems = node.children.map((childName) => {
          const childPath = resolvePath(`${targetPath}/${childName}`);
          const childNode = VFS[childPath];
          const isDir = childNode && childNode.type === 'dir';
          const className = isDir ? 'ls-dir' : 'ls-file';
          return `<span class="${className}">${childName}</span>`;
        });

        printHTML(`<div class="ls-output-line">${formattedItems.join('  ')}</div>`);

        // Suggest using show to view files
        const hasFiles = node.children.some((child) => {
          const childPath = resolvePath(`${targetPath}/${child}`);
          return VFS[childPath]?.type === 'file';
        });

        if (hasFiles) {
          printHTML(`<span style="color: #8b949e; font-style: italic; display: block; margin-top: 4px;">Tip: Use 'show &lt;file.html&gt;' to open a webpage.</span>`);
        }
      } else if (node && node.type === 'file') {
        printHTML(`<span class="ls-file">${arg}</span>`);
      } else {
        printText(`ls: cannot access '${arg}': No such file or directory`);
      }
    } else if (cmd === 'cd') {
      if (!arg || arg === '~') {
        pwd = '/';
      } else {
        const targetPath = resolvePath(arg);
        const node = VFS[targetPath];
        if (node && node.type === 'dir') {
          pwd = targetPath;
        } else {
          printText(`cd: no such directory: ${arg}`);
        }
      }
      updatePrompt();
    } else if (cmd === 'show') {
      let targetPath = arg ? resolvePath(arg) : pwd;

      // Automatic fallback: try appending .html if exact match fails
      if (!VFS[targetPath] && !targetPath.endsWith('.html')) {
        if (VFS[`${targetPath}.html`]) {
          targetPath = `${targetPath}.html`;
        }
      }

      const node = VFS[targetPath];

      if (node && node.type === 'file' && node.content) {
        openViewer(node.content, targetPath);
      } else {
        printText(`show: cannot view path '${arg || pwd}'`);
      }
    } else {
      printText(`command not found: ${cmd}`);
    }

    terminalContainer.scrollTop = terminalContainer.scrollHeight;
  }
});

// Window Key Listener for Viewer Commands
window.addEventListener('keydown', (e) => {
  if (!inViewerMode) return;

  // Handle Ctrl shortcuts for the Pico editor
  if (e.ctrlKey) {
    const key = e.key.toLowerCase();
    
    const activeKeys = ['x', 'g', 'y', 'v', 'c'];
    const inactiveKeys = ['o', 'r', 'k', 'j', 'w', 'u', 't'];

    if (activeKeys.includes(key) || inactiveKeys.includes(key)) {
      e.preventDefault(); 
      e.stopPropagation();

      if (key === 'x') {
        closeViewer();
      } 
      else if (key === 'g') {
        viewerStatus.textContent = 'Help: Use ^X to exit, ^Y/^V to scroll pages.';
      } 
      else if (key === 'y') {
        // Prev Pg (Scroll Up)
        viewerContentWrapper.scrollTop -= viewerContentWrapper.clientHeight;
        viewerStatus.textContent = '';
      } 
      else if (key === 'v') {
        // Next Pg (Scroll Down)
        viewerContentWrapper.scrollTop += viewerContentWrapper.clientHeight;
        viewerStatus.textContent = '';
      } 
      else if (key === 'c') {
        // Cur Pos
        const maxScroll = Math.max(1, viewerContentWrapper.scrollHeight - viewerContentWrapper.clientHeight);
        const pct = Math.round((viewerContentWrapper.scrollTop / maxScroll) * 100);
        viewerStatus.textContent = `Current Position: ${pct}% of document`;
      }
      else if (inactiveKeys.includes(key)) {
        // Catch all non-working footer commands
        viewerStatus.textContent = `[ ^${key.toUpperCase()} is disabled in read-only web mode ]`;
      }
      return;
    }
  }

  // Fallback :q to quit
  if (e.key === 'q') {
    closeViewer();
  }
}, true);