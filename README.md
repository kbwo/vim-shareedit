# vim-shareedit

## Overview

A Neovim plugin that shares open files and cursor positions between Neovim and VSCode

![demo-shareedit](https://github.com/user-attachments/assets/3d486643-4226-4396-9c7a-a955013940de)


## Motivation
I have been using Neovim for a long time, but recently I've started using editors like Cursor Editor and Cline more frequently, which means I often need to switch between different editors for development and testing.

As I continued working this way, frequently switching between Neovim and other editors became cumbersome.

Therefore, to make switching between Neovim and VSCode smoother, I created this plugin that shares files and cursor positions between Neovim and VSCode.

## Requirements

- Visual Studio Code with [vscode-shareedit](https://marketplace.visualstudio.com/items?itemName=kbwo.shareedit) plugin installed

## Installation
Install with your preferred plugin manager.


### vim-plug
```
Plug 'vim-denops/denops.vim'
Plug 'kbwo/vim-shareedit'
```

## Usage

In Vim
```
:ShareEditStart
```

In VSCode, you can connect to vim-shareedit by `Connect to vim-shareedit` command from command palette (Cmd/Ctrl+Shift+P).
See [VSCode Extension](https://marketplace.visualstudio.com/items?itemName=kbwo.shareedit) for more details.

## TODO

- Share cursor position
    - [x] Vim <-> VSCode bidirectional cursor position syncing
- [x] Session management
- [ ] Share visual mode selection range
- [ ] Share unsaved file edits

